import { buildRuntimeContext } from '../context/build-context';
import { chatOrchestrator } from '../orchestrators/chat-orchestrator';
import { pageBuilderOrchestrator } from '../orchestrators/page-builder-orchestrator';
import type { AgentEvent, AgentRuntimeDeps, RunMetadata, RunRequest } from '../types';

function createSessionId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function hasPageBuilderTools(deps: AgentRuntimeDeps): boolean {
  return ['planPage', 'generateBlock', 'assembleSchema'].every((name) => Boolean(deps.tools.get(name)));
}

function findLastDoneEvent(events: AgentEvent[]): Extract<AgentEvent, { type: 'done' }> | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type === 'done') {
      return event;
    }
  }
  return undefined;
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

    const events: AgentEvent[] = [];
    const generator = hasPageBuilderTools(deps)
      ? pageBuilderOrchestrator(request, context, deps, metadata)
      : chatOrchestrator(request, context, deps, metadata);

    for await (const event of generator) {
      events.push(event);
      yield event;
    }

    metadata.durationMs = Date.now() - startedAt;
    const finalDone = findLastDoneEvent(events);
    const finalSchemaBlocks = events
      .filter((event): event is Extract<AgentEvent, { type: 'schema:block' }> => event.type === 'schema:block')
      .map((event) => event.data.blockId);

    if (finalDone) {
      finalDone.data.metadata.durationMs = metadata.durationMs;
      await Promise.all([
        deps.memory.appendConversationMessage(conversationId, {
          role: 'assistant',
          text: context.prompt,
        }),
        deps.memory.setLastRunMetadata(conversationId, finalDone.data.metadata),
        deps.memory.setLastBlockIds(conversationId, finalSchemaBlocks),
      ]);
    }
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
