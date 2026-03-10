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
      'intent',
      'message:start',
      'message:delta',
      'message:delta',
      'done',
    ]);
  });

  it('routes modify requests to modify orchestrator and persists operations in memory', async () => {
    const memory = createInMemoryAgentMemoryStore();
    const request: RunRequest = {
      prompt: '把当前卡片标题改成本月营收',
      conversationId: 'modify-conv',
      selectedNodeId: 'card-1',
      context: {
        schemaSummary: 'Existing dashboard',
        componentSummary: 'Card, Table',
        schemaJson: {
          id: 'page-1',
          body: [
            {
              id: 'card-1',
              component: 'Card',
              children: [],
            },
          ],
        },
      },
    };
    const deps: AgentRuntimeDeps = {
      llm: {
        chat: vi.fn(async () => ({ text: 'unused' })),
        streamChat: vi.fn(async function* () {
          yield { text: 'unused' };
        }),
      },
      tools: createToolRegistry([
        {
          name: 'modifySchema',
          async execute() {
            return {
              explanation: '会更新当前卡片标题。',
              operations: [
                {
                  op: 'schema.patchProps' as const,
                  nodeId: 'card-1',
                  patch: { title: '本月营收' },
                },
              ],
            };
          },
        },
      ]),
      memory,
      logger: {
        info: vi.fn(),
        error: vi.fn(),
      },
    };

    const events = [];
    for await (const event of runAgentStream(request, deps)) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual([
      'run:start',
      'intent',
      'message:start',
      'tool:start',
      'tool:result',
      'message:delta',
      'modify:start',
      'modify:op',
      'modify:done',
      'done',
    ]);
    expect(events[1]).toEqual({
      type: 'intent',
      data: { intent: 'schema.modify', confidence: 0.92 },
    });

    const conversation = await memory.getConversation('modify-conv');
    expect(conversation.at(-1)).toEqual({
      role: 'assistant',
      text: '会更新当前卡片标题。',
      meta: {
        intent: 'schema.modify',
        operations: [
          {
            op: 'schema.patchProps',
            nodeId: 'card-1',
            patch: { title: '本月营收' },
          },
        ],
      },
    });
  });
});
