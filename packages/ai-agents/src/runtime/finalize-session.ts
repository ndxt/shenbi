import type { AgentMemoryMessage, AgentMemoryStore, FinalizeRequest } from '../types';

export interface AgentMemoryDebugSnapshot {
  conversationId: string;
  sessionId?: string;
  conversationSize: number;
  assistantMessage?: AgentMemoryMessage;
  conversationTail: AgentMemoryMessage[];
  lastRunMetadata?: Awaited<ReturnType<AgentMemoryStore['getLastRunMetadata']>>;
  lastBlockIds: string[];
}

export interface FinalizeSessionResult {
  outcome: 'patched' | 'skipped_missing_schema_digest';
  before: AgentMemoryDebugSnapshot;
  after: AgentMemoryDebugSnapshot;
}

function cloneDebugValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function findAssistantMessageBySessionId(
  conversation: AgentMemoryMessage[],
  sessionId: string,
): AgentMemoryMessage | undefined {
  return [...conversation]
    .reverse()
    .find((message) => message.role === 'assistant' && message.meta?.sessionId === sessionId);
}

export function buildFailedAssistantText(existingText: string, error?: string): string {
  const prefix = '[修改失败]';
  const trimmed = existingText.trim();
  if (trimmed.startsWith(prefix)) {
    return trimmed;
  }
  const detail = error ? `${prefix} ${error}` : prefix;
  return trimmed ? `${detail}\n${trimmed}` : detail;
}

export async function captureAgentMemorySnapshot(
  memory: AgentMemoryStore,
  conversationId: string,
  sessionId?: string,
): Promise<AgentMemoryDebugSnapshot> {
  const [conversation, lastRunMetadata, lastBlockIds] = await Promise.all([
    memory.getConversation(conversationId),
    memory.getLastRunMetadata(conversationId),
    memory.getLastBlockIds(conversationId),
  ]);

  return {
    conversationId,
    ...(sessionId ? { sessionId } : {}),
    conversationSize: conversation.length,
    ...(() => {
      if (!sessionId) {
        return {};
      }
      const assistantMessage = findAssistantMessageBySessionId(conversation, sessionId);
      return assistantMessage ? { assistantMessage: cloneDebugValue(assistantMessage) } : {};
    })(),
    conversationTail: cloneDebugValue(conversation.slice(-6)),
    ...(lastRunMetadata ? { lastRunMetadata: cloneDebugValue(lastRunMetadata) } : {}),
    lastBlockIds: cloneDebugValue(lastBlockIds),
  };
}

export async function finalizeAgentSessionMemory(
  memory: AgentMemoryStore,
  request: FinalizeRequest,
): Promise<FinalizeSessionResult | null> {
  if (typeof memory.patchAssistantMessage !== 'function') {
    return null;
  }

  const before = await captureAgentMemorySnapshot(
    memory,
    request.conversationId,
    request.sessionId,
  );
  let outcome: FinalizeSessionResult['outcome'] = 'patched';

  if (request.success) {
    if (!request.schemaDigest) {
      outcome = 'skipped_missing_schema_digest';
    } else {
      await memory.patchAssistantMessage(request.conversationId, request.sessionId, {
        meta: {
          schemaDigest: request.schemaDigest,
        },
      });
    }
  } else {
    const nextText = buildFailedAssistantText(before.assistantMessage?.text ?? '', request.error);

    await memory.patchAssistantMessage(request.conversationId, request.sessionId, {
      text: nextText,
      meta: {
        failed: true,
        ...(request.schemaDigest ? { schemaDigest: request.schemaDigest } : {}),
      },
      clearOperations: true,
    });
  }

  const after = await captureAgentMemorySnapshot(
    memory,
    request.conversationId,
    request.sessionId,
  );

  return {
    outcome,
    before,
    after,
  };
}
