import { buildRuntimeContext } from '../context/build-context';
import { chatOrchestrator } from '../orchestrators/chat-orchestrator';
import { modifyOrchestrator } from '../orchestrators/modify-orchestrator';
import { pageBuilderOrchestrator } from '../orchestrators/page-builder-orchestrator';
import type { AgentEvent, AgentIntent, AgentOperation, AgentRuntimeDeps, RunMetadata, RunRequest } from '../types';

function createSessionId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function hasPageBuilderTools(deps: AgentRuntimeDeps): boolean {
  return ['planPage', 'buildSkeletonSchema', 'generateBlock', 'assembleSchema'].every((name) => Boolean(deps.tools.get(name)));
}

function hasModifyTool(deps: AgentRuntimeDeps): boolean {
  return Boolean(deps.tools.get('modifySchema'));
}

const modifyIntentPattern = /修改|调整|删除|添加|增加|替换|移动|隐藏|显示|改成|换成|update|change|remove|delete|insert|add|replace|move|hide|show/i;

function resolveIntent(request: RunRequest, deps: AgentRuntimeDeps): { intent: AgentIntent; confidence: number } {
  const hasSchema = Boolean(request.context.schemaJson);
  if (hasSchema && hasModifyTool(deps) && (Boolean(request.selectedNodeId) || modifyIntentPattern.test(request.prompt))) {
    return {
      intent: 'schema.modify',
      confidence: request.selectedNodeId ? 0.92 : 0.76,
    };
  }
  if (hasPageBuilderTools(deps)) {
    return { intent: 'schema.create', confidence: 0.88 };
  }
  return { intent: 'chat', confidence: 0.62 };
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

    const resolvedIntent = resolveIntent(request, deps);
    yield {
      type: 'intent',
      data: resolvedIntent,
    };

    const events: AgentEvent[] = [];
    const assistantDeltas: string[] = [];
    const operations: AgentOperation[] = [];
    const generator = resolvedIntent.intent === 'schema.modify'
      ? modifyOrchestrator(request, context, deps, metadata)
      : resolvedIntent.intent === 'schema.create'
        ? pageBuilderOrchestrator(request, context, deps, metadata)
        : chatOrchestrator(request, context, deps, metadata);

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
    const finalSchemaBlocks = events
      .filter((event): event is Extract<AgentEvent, { type: 'schema:block' }> => event.type === 'schema:block')
      .map((event) => event.data.blockId);

    const doneEvent: AgentEvent = { type: 'done', data: { metadata } };
    events.push(doneEvent);
    yield doneEvent;

    const assistantText = assistantDeltas.join('');
    await Promise.all([
      ...(assistantText || resolvedIntent.intent !== 'chat' || operations.length > 0
        ? [
            deps.memory.appendConversationMessage(conversationId, {
              role: 'assistant',
              text: assistantText,
              meta: {
                intent: resolvedIntent.intent,
                ...(operations.length > 0 ? { operations } : {}),
              },
            }),
          ]
        : []),
      deps.memory.setLastRunMetadata(conversationId, metadata),
      deps.memory.setLastBlockIds(conversationId, finalSchemaBlocks),
    ]);
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
