import { describe, expect, it, vi } from 'vitest';
import { createSchemaDigest } from '@shenbi/ai-contracts';
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
      intent: 'schema.modify',
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
      data: { intent: 'schema.modify', confidence: 1 },
    });

    const runStart = events.find((event) => event.type === 'run:start');
    const conversation = await memory.getConversation('modify-conv');
    expect(conversation.at(-1)).toEqual({
      role: 'assistant',
      text: '会更新当前卡片标题。',
      meta: {
        sessionId: runStart?.type === 'run:start' ? runStart.data.sessionId : undefined,
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

  it('persists schema digest immediately when modify returns a single schema.replace operation', async () => {
    const memory = createInMemoryAgentMemoryStore();
    const nextSchema = {
      id: 'page-1',
      body: [
        {
          id: 'card-1',
          component: 'Card',
          props: { title: '本月营收' },
          children: [],
        },
      ],
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
              explanation: '会整体替换当前页面。',
              operations: [
                {
                  op: 'schema.replace' as const,
                  schema: nextSchema,
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

    for await (const _event of runAgentStream({
      prompt: '整体重排这个页面',
      intent: 'schema.modify',
      conversationId: 'replace-conv',
      context: {
        schemaSummary: 'Existing dashboard',
        componentSummary: 'Card',
        schemaJson: {
          id: 'page-1',
          body: [{ id: 'card-1', component: 'Card', children: [] }],
        },
      },
    }, deps)) {
      // Drain the stream.
    }

    const conversation = await memory.getConversation('replace-conv');
    expect(conversation.at(-1)?.meta).toEqual(expect.objectContaining({
      intent: 'schema.modify',
      schemaDigest: createSchemaDigest(nextSchema),
    }));
  });

  it('writes assistant memory before yielding done so finalize can patch by sessionId', async () => {
    const memory = createInMemoryAgentMemoryStore();
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
              explanation: '准备修改当前卡片标题。',
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

    for await (const event of runAgentStream({
      prompt: '把当前卡片标题改成本月营收',
      intent: 'schema.modify',
      conversationId: 'modify-conv',
      selectedNodeId: 'card-1',
      context: {
        schemaSummary: 'Existing dashboard',
        componentSummary: 'Card, Table',
        schemaJson: {
          id: 'page-1',
          body: [{ id: 'card-1', component: 'Card', children: [] }],
        },
      },
    }, deps)) {
      if (event.type !== 'done') {
        continue;
      }
      const conversation = await memory.getConversation('modify-conv');
      expect(conversation.at(-1)?.meta?.sessionId).toBe(event.data.metadata.sessionId);
      break;
    }
  });

  it('keeps create prompts on the page-builder path even when a node is selected', async () => {
    const deps: AgentRuntimeDeps = {
      llm: {
        chat: vi.fn(async () => ({ text: 'unused' })),
        streamChat: vi.fn(async function* () {
          yield { text: 'unused' };
        }),
      },
      tools: createToolRegistry([
        {
          name: 'planPage',
          async execute() {
            return {
              pageTitle: '新工作台',
              pageType: 'dashboard' as const,
              blocks: [
                {
                  id: 'hero',
                  description: '指标区',
                  components: ['Card'],
                  priority: 1,
                  complexity: 'simple' as const,
                },
              ],
            };
          },
        },
        {
          name: 'buildSkeletonSchema',
          async execute() {
            return { id: 'page-1', body: [] };
          },
        },
        {
          name: 'generateBlock',
          async execute() {
            return {
              blockId: 'hero',
              node: { id: 'hero', component: 'Card', children: [] },
            };
          },
        },
        {
          name: 'assembleSchema',
          async execute() {
            return { id: 'page-1', body: [] };
          },
        },
        {
          name: 'modifySchema',
          async execute() {
            throw new Error('should not route to modify');
          },
        },
      ]),
      memory: createInMemoryAgentMemoryStore(),
      logger: {
        info: vi.fn(),
        error: vi.fn(),
      },
    };

    const events = [];
    for await (const event of runAgentStream({
      prompt: '生成一个新的员工工作台页面',
      intent: 'schema.create',
      selectedNodeId: 'card-1',
      conversationId: 'create-conv',
      context: {
        schemaSummary: 'Existing dashboard',
        componentSummary: 'Card, Table',
        schemaJson: { id: 'page-1', body: [] },
      },
    }, deps)) {
      events.push(event);
    }

    expect(events[1]).toEqual({
      type: 'intent',
      data: { intent: 'schema.create', confidence: 1 },
    });
    expect(events.some((event) => event.type === 'plan')).toBe(true);
  });

  it('downgrades modify intent to chat when no modify handler is available', async () => {
    const deps: AgentRuntimeDeps = {
      llm: {
        chat: vi.fn(async () => ({ text: 'unused' })),
        streamChat: vi.fn(async function* () {
          yield { text: 'Hello' };
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
    for await (const event of runAgentStream({
      prompt: '把当前卡片标题改掉',
      selectedNodeId: 'card-1',
      conversationId: 'chat-fallback-conv',
      context: {
        schemaSummary: 'pageId=page-1; nodeCount=1',
        componentSummary: 'Card',
        schemaJson: {
          id: 'page-1',
          body: [{ id: 'card-1', component: 'Card', children: [] }],
        },
      },
    }, deps)) {
      events.push(event);
    }

    expect(events[1]).toEqual({
      type: 'intent',
      data: { intent: 'chat', confidence: 0.85 },
    });
    expect(events.some((event) => event.type === 'modify:start')).toBe(false);
    expect(events.some((event) => event.type === 'message:delta')).toBe(true);
  });

  it('prefers classifyIntent tool over rule routing when explicit intent is absent', async () => {
    const deps: AgentRuntimeDeps = {
      llm: {
        chat: vi.fn(async () => ({ text: 'unused' })),
        streamChat: vi.fn(async function* () {
          yield { text: 'unused' };
        }),
      },
      tools: createToolRegistry([
        {
          name: 'classifyIntent',
          async execute() {
            return { intent: 'schema.modify' as const, confidence: 0.97 };
          },
        },
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
      memory: createInMemoryAgentMemoryStore(),
      logger: {
        info: vi.fn(),
        error: vi.fn(),
      },
    };

    const events = [];
    for await (const event of runAgentStream({
      prompt: '帮我处理一下当前页面',
      selectedNodeId: 'card-1',
      conversationId: 'classify-tool-conv',
      context: {
        schemaSummary: 'pageId=page-1; nodeCount=1',
        componentSummary: 'Card',
        schemaJson: {
          id: 'page-1',
          body: [{ id: 'card-1', component: 'Card', children: [] }],
        },
      },
    }, deps)) {
      events.push(event);
    }

    expect(events[1]).toEqual({
      type: 'intent',
      data: { intent: 'schema.modify', confidence: 0.97 },
    });
    expect(events.some((event) => event.type === 'modify:start')).toBe(true);
  });
});
