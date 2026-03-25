import { describe, expect, it } from 'vitest';
import { createInMemoryAgentMemoryStore } from '../memory/memory-store';
import { captureAgentMemorySnapshot, finalizeAgentSessionMemory } from './finalize-session';

describe('finalize-session', () => {
  it('patches schema digest onto the matching assistant message', async () => {
    const memory = createInMemoryAgentMemoryStore();

    await memory.appendConversationMessage('conv-1', {
      role: 'assistant',
      text: 'Planning page structure.',
      meta: {
        sessionId: 'run-1',
        intent: 'schema.create',
      },
    });

    await expect(finalizeAgentSessionMemory(memory, {
      conversationId: 'conv-1',
      sessionId: 'run-1',
      success: true,
      schemaDigest: 'fnv1a-12345678',
    })).resolves.toMatchObject({
      outcome: 'patched',
      after: {
        assistantMessage: {
          meta: {
            intent: 'schema.create',
            schemaDigest: 'fnv1a-12345678',
          },
        },
      },
    });
  });

  it('marks failed assistant messages and clears operations', async () => {
    const memory = createInMemoryAgentMemoryStore();

    await memory.appendConversationMessage('conv-2', {
      role: 'assistant',
      text: '会更新当前卡片标题。',
      meta: {
        sessionId: 'run-2',
        intent: 'schema.modify',
        operations: [{ op: 'schema.patchProps', nodeId: 'card-1', patch: { title: '本月营收' } }],
      },
    });

    const result = await finalizeAgentSessionMemory(memory, {
      conversationId: 'conv-2',
      sessionId: 'run-2',
      success: false,
      error: 'op 1 failed',
      schemaDigest: 'fnv1a-deadbeef',
    });

    expect(result).toMatchObject({
      outcome: 'patched',
      after: {
        assistantMessage: {
          text: '[修改失败] op 1 failed\n会更新当前卡片标题。',
          meta: {
            intent: 'schema.modify',
            failed: true,
            schemaDigest: 'fnv1a-deadbeef',
          },
        },
      },
    });
    expect(result?.after.assistantMessage?.meta?.operations).toBeUndefined();
  });

  it('captures conversation tail and session-scoped assistant snapshots', async () => {
    const memory = createInMemoryAgentMemoryStore();
    await memory.appendConversationMessage('conv-3', { role: 'user', text: 'hi' });
    await memory.appendConversationMessage('conv-3', {
      role: 'assistant',
      text: 'hello',
      meta: { sessionId: 'run-3', intent: 'chat' },
    });

    await expect(captureAgentMemorySnapshot(memory, 'conv-3', 'run-3')).resolves.toMatchObject({
      conversationId: 'conv-3',
      sessionId: 'run-3',
      conversationSize: 2,
      assistantMessage: {
        text: 'hello',
        meta: { intent: 'chat' },
      },
      conversationTail: [
        { role: 'user', text: 'hi' },
        {
          role: 'assistant',
          text: 'hello',
          meta: { sessionId: 'run-3', intent: 'chat' },
        },
      ],
    });
  });
});
