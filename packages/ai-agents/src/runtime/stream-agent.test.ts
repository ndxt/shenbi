import { describe, expect, it, vi } from 'vitest';
import type { AgentRuntimeDeps, RunRequest } from '../types';
import { runAgentStream } from './stream-agent';
import { createInMemoryAgentMemoryStore } from '../memory/memory-store';
import { createToolRegistry } from '../tools/registry';

function createRequest(): RunRequest {
  return {
    prompt: 'Chat only request',
    conversationId: 'chat-conv',
    context: {
      schemaSummary: 'Existing dashboard',
      componentSummary: 'Card, Table',
    },
  };
}

describe('runAgentStream', () => {
  it('falls back to chat orchestrator when page builder tools are absent', async () => {
    const deps: AgentRuntimeDeps = {
      llm: {
        chat: vi.fn(async () => ({ text: 'unused' })),
        streamChat: vi.fn(async function* () {
          yield { text: 'Hello' };
          yield { text: ' world' };
        }),
      },
      tools: createToolRegistry([]),
      memory: createInMemoryAgentMemoryStore(),
      logger: {
        info: vi.fn(),
        error: vi.fn(),
      },
    };

    const events = [];
    for await (const event of runAgentStream(createRequest(), deps)) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual([
      'run:start',
      'message:start',
      'message:delta',
      'message:delta',
      'done',
    ]);
  });
});
