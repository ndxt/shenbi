import { createSchemaDigest } from '@shenbi/ai-contracts';
import { buildRuntimeContext } from '../context/build-context';
import { classifyIntentByRules } from '../intent/rule-classifier';
import { chatOrchestrator } from '../orchestrators/chat-orchestrator';
import { modifyOrchestrator } from '../orchestrators/modify-orchestrator';
import { pageBuilderOrchestrator } from '../orchestrators/page-builder-orchestrator';
import { createOrchestratorRegistry, type OrchestratorFunction } from '../orchestrators/registry';
import type { AgentEvent, AgentIntent, AgentOperation, AgentRuntimeContext, AgentRuntimeDeps, RunMetadata, RunRequest } from '../types';

function createSessionId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function hasPageBuilderTools(deps: AgentRuntimeDeps): boolean {
  return ['planPage', 'buildSkeletonSchema', 'generateBlock', 'assembleSchema'].every((name) => Boolean(deps.tools.get(name)));
}

function hasModifyTool(deps: AgentRuntimeDeps): boolean {
  return Boolean(deps.tools.get('modifySchema'));
}

async function classifyIntent(
  request: RunRequest,
  context: AgentRuntimeContext,
  deps: AgentRuntimeDeps,
): Promise<{ intent: AgentIntent; confidence: number }> {
  if (request.intent === 'schema.modify' && request.context.schemaJson && hasModifyTool(deps)) {
    return { intent: 'schema.modify', confidence: 1 };
  }
  if (request.intent === 'schema.create' && hasPageBuilderTools(deps)) {
    return { intent: 'schema.create', confidence: 1 };
  }
  if (request.intent === 'chat') {
    return { intent: 'chat', confidence: 1 };
  }
  const classifyIntentTool = deps.tools.get('classifyIntent');
  if (classifyIntentTool) {
    try {
      const result = await classifyIntentTool.execute({ request, context });
      if (
        result
        && typeof result === 'object'
        && 'intent' in result
        && 'confidence' in result
      ) {
        const candidate = result as { intent: AgentIntent; confidence: number };
        if (
          (candidate.intent === 'schema.create' || candidate.intent === 'schema.modify' || candidate.intent === 'chat')
          && Number.isFinite(candidate.confidence)
        ) {
          return candidate;
        }
      }
      deps.logger?.info('runAgentStream.classify_intent_invalid_result', {});
    } catch (error) {
      deps.logger?.error('runAgentStream.classify_intent_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return classifyIntentByRules(context);
}

function createDefaultRegistry() {
  const registry = createOrchestratorRegistry();
  registry.register({
    id: 'page-builder',
    intents: ['schema.create'],
    canHandle: (_context, deps) => hasPageBuilderTools(deps),
    orchestrate: pageBuilderOrchestrator,
  });
  registry.register({
    id: 'page-modifier',
    intents: ['schema.modify'],
    canHandle: (context, deps) => context.document.exists && hasModifyTool(deps),
    orchestrate: modifyOrchestrator,
  });
  registry.register({
    id: 'chat',
    intents: ['chat'],
    orchestrate: chatOrchestrator,
  });
  return registry;
}

function resolveFallbackOrchestrator(
  intent: AgentIntent,
  deps: AgentRuntimeDeps,
): { intent: AgentIntent; orchestrator: OrchestratorFunction } {
  if (intent === 'schema.create' && hasPageBuilderTools(deps)) {
    return { intent: 'schema.create', orchestrator: pageBuilderOrchestrator };
  }
  if (intent === 'schema.modify' && hasModifyTool(deps)) {
    return { intent: 'schema.modify', orchestrator: modifyOrchestrator };
  }
  return { intent: 'chat', orchestrator: chatOrchestrator };
}

function getFinalSchemaDigest(events: AgentEvent[]): string | undefined {
  const finalSchemaEvent = [...events]
    .reverse()
    .find((event): event is Extract<AgentEvent, { type: 'schema:done' }> => event.type === 'schema:done');
  return createSchemaDigest(finalSchemaEvent?.data.schema);
}

function getOperationSchemaDigest(operations: AgentOperation[]): string | undefined {
  if (operations.length !== 1 || operations[0]?.op !== 'schema.replace') {
    return undefined;
  }
  return createSchemaDigest(operations[0].schema);
}

export async function* runAgentStream(
  request: RunRequest,
  deps: AgentRuntimeDeps,
): AsyncGenerator<AgentEvent> {
  const startedAt = Date.now();
  const sessionId = createSessionId();
  const conversationId = request.conversationId ?? sessionId;
  const metadata: RunMetadata = {
    sessionId,
    ...(conversationId ? { conversationId } : {}),
    ...(request.plannerModel ? { plannerModel: request.plannerModel } : {}),
    ...(request.blockModel ? { blockModel: request.blockModel } : {}),
  };

  try {
    const [conversation, lastRunMetadata, lastBlockIds] = await Promise.all([
      deps.memory.getConversation(conversationId),
      deps.memory.getLastRunMetadata(conversationId),
      deps.memory.getLastBlockIds(conversationId),
    ]);

    const context = buildRuntimeContext({
      request,
      conversation,
      ...(lastRunMetadata ? { lastRunMetadata } : {}),
      lastBlockIds,
    });

    await deps.memory.appendConversationMessage(conversationId, {
      role: 'user',
      text: request.prompt,
    });

    yield { type: 'run:start', data: { sessionId, conversationId } };

    const classifiedIntent = await classifyIntent(request, context, deps);
    const registry = createDefaultRegistry();
    const resolved = registry.resolve(classifiedIntent.intent, context, deps);
    const fallback = resolved
      ? undefined
      : resolveFallbackOrchestrator(classifiedIntent.intent, deps);
    const resolvedIntent = fallback
      ? { intent: fallback.intent, confidence: classifiedIntent.confidence }
      : classifiedIntent;
    if (resolvedIntent.intent !== classifiedIntent.intent) {
      deps.logger?.info('runAgentStream.intent_downgraded', {
        requestedIntent: request.intent,
        classifiedIntent: classifiedIntent.intent,
        effectiveIntent: resolvedIntent.intent,
        hasSchema: Boolean(request.context.schemaJson),
        hasModifyTool: hasModifyTool(deps),
        hasPageBuilderTools: hasPageBuilderTools(deps),
      });
    }
    yield {
      type: 'intent',
      data: resolvedIntent,
    };

    const events: AgentEvent[] = [];
    const assistantDeltas: string[] = [];
    const operations: AgentOperation[] = [];
    const orchestrator = resolved ?? fallback?.orchestrator ?? chatOrchestrator;
    const generator = orchestrator(request, context, deps, metadata);

    for await (const event of generator) {
      events.push(event);
      if (event.type === 'message:delta') {
        assistantDeltas.push(event.data.text);
      }
      if (event.type === 'modify:op') {
        operations.push(event.data.operation);
      }
      yield event;
    }

    metadata.durationMs = Date.now() - startedAt;
    const finalSchemaDigest = getFinalSchemaDigest(events) ?? getOperationSchemaDigest(operations);
    const finalSchemaBlocks = events
      .filter((event): event is Extract<AgentEvent, { type: 'schema:block' }> => event.type === 'schema:block')
      .map((event) => event.data.blockId);

    const assistantText = assistantDeltas.join('');
    await Promise.all([
      ...(assistantText || resolvedIntent.intent !== 'chat' || operations.length > 0
        ? [
            deps.memory.appendConversationMessage(conversationId, {
              role: 'assistant',
              text: assistantText,
              meta: {
                sessionId,
                intent: resolvedIntent.intent,
                ...(operations.length > 0 ? { operations } : {}),
                ...(finalSchemaDigest ? { schemaDigest: finalSchemaDigest } : {}),
              },
            }),
          ]
        : []),
      deps.memory.setLastRunMetadata(conversationId, metadata),
      deps.memory.setLastBlockIds(conversationId, finalSchemaBlocks),
    ]);

    const doneEvent: AgentEvent = { type: 'done', data: { metadata } };
    events.push(doneEvent);
    yield doneEvent;
  } catch (error) {
    deps.logger?.error('runAgentStream failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    yield {
      type: 'error',
      data: {
        message: error instanceof Error ? error.message : 'Unknown runtime error',
      },
    };
  }
}
