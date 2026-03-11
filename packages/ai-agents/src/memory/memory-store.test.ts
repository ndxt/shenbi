import { describe, expect, it } from 'vitest';
import { createInMemoryAgentMemoryStore } from './memory-store';

describe('InMemoryAgentMemoryStore', () => {
  it('patches the assistant message that matches the session id', async () => {
    const store = createInMemoryAgentMemoryStore();

    await store.appendConversationMessage('conv-1', {
      role: 'assistant',
      text: 'old',
      meta: {
        sessionId: 'run-1',
        intent: 'schema.modify',
        operations: [{ op: 'schema.removeNode', nodeId: 'node-1' }],
      },
    });
    await store.appendConversationMessage('conv-1', {
      role: 'assistant',
      text: 'keep',
      meta: {
        sessionId: 'run-2',
        intent: 'chat',
      },
    });

    await store.patchAssistantMessage?.('conv-1', 'run-1', {
      text: 'new',
      meta: {
        failed: true,
        schemaDigest: 'fnv1a-12345678',
      },
      clearOperations: true,
    });

    await expect(store.getConversation('conv-1')).resolves.toEqual([
      {
        role: 'assistant',
        text: 'new',
        meta: {
          sessionId: 'run-1',
          intent: 'schema.modify',
          failed: true,
          schemaDigest: 'fnv1a-12345678',
        },
      },
      {
        role: 'assistant',
        text: 'keep',
        meta: {
          sessionId: 'run-2',
          intent: 'chat',
        },
      },
    ]);
  });

  it('updates the most recent assistant message for the same session id', async () => {
    const store = createInMemoryAgentMemoryStore();

    await store.appendConversationMessage('conv-1', {
      role: 'assistant',
      text: 'first',
      meta: {
        sessionId: 'run-1',
        intent: 'chat',
      },
    });
    await store.appendConversationMessage('conv-1', {
      role: 'assistant',
      text: 'second',
      meta: {
        sessionId: 'run-1',
        intent: 'chat',
      },
    });

    await store.patchAssistantMessage?.('conv-1', 'run-1', {
      text: 'patched',
    });

    await expect(store.getConversation('conv-1')).resolves.toEqual([
      {
        role: 'assistant',
        text: 'first',
        meta: {
          sessionId: 'run-1',
          intent: 'chat',
        },
      },
      {
        role: 'assistant',
        text: 'patched',
        meta: {
          sessionId: 'run-1',
          intent: 'chat',
        },
      },
    ]);
  });

  it('is a no-op when the session id is missing', async () => {
    const store = createInMemoryAgentMemoryStore();

    await store.appendConversationMessage('conv-1', {
      role: 'assistant',
      text: 'keep',
      meta: {
        sessionId: 'run-1',
        intent: 'chat',
      },
    });

    await store.patchAssistantMessage?.('conv-1', 'run-2', {
      text: 'patched',
      clearOperations: true,
    });

    await expect(store.getConversation('conv-1')).resolves.toEqual([
      {
        role: 'assistant',
        text: 'keep',
        meta: {
          sessionId: 'run-1',
          intent: 'chat',
        },
      },
    ]);
  });
});
