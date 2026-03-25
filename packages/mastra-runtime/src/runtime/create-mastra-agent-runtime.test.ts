import { describe, expect, it, vi } from 'vitest';
import {
  type ChatChunk,
  createInMemoryAgentMemoryStore,
  createToolRegistry,
  type AgentRuntimeDeps,
  type AgentLogger,
  type AgentTool,
} from '@shenbi/ai-agents';
import type {
  AgentEvent,
  AgentOperation,
  ChatRequest,
  ChatResponse,
  ClassifyRouteRequest,
  ClassifyRouteResponse,
  FinalizeRequest,
  FinalizeResult,
  PagePlan,
  RunMetadata,
  RunRequest,
} from '@shenbi/ai-contracts';
import type { PageSchema, SchemaNode } from '@shenbi/schema';
import { createMastraAgentRuntime, type MastraAgentRuntime } from './create-mastra-agent-runtime';

function createRequest(overrides: Partial<RunRequest> = {}): RunRequest {
  return {
    prompt: '创建一个用户列表页',
    conversationId: 'conv-1',
    intent: 'schema.create',
    context: {
      schemaSummary: 'empty',
      componentSummary: 'Card, Table, Form',
    },
    ...overrides,
  };
}

function createLegacyRuntime(events: AgentEvent[]): MastraAgentRuntime {
  return {
    async run() {
      return {
        events,
        metadata: (events.find((event): event is Extract<AgentEvent, { type: 'done' }> => event.type === 'done')
          ?.data.metadata ?? { sessionId: 'legacy-session' }) as RunMetadata,
      };
    },
    async *runStream() {
      for (const event of events) {
        yield event;
      }
    },
    async chat(_request: ChatRequest): Promise<ChatResponse> {
      return { content: 'legacy chat' };
    },
    async *chatStream() {
      yield { delta: 'legacy chat' };
    },
    async classifyRoute(_request: ClassifyRouteRequest): Promise<ClassifyRouteResponse> {
      return {
        scope: 'single-page',
        intent: 'schema.create',
        confidence: 0.9,
      };
    },
    async finalize(_request: FinalizeRequest): Promise<FinalizeResult> {
      return {};
    },
  };
}

function createDeps(
  tools: AgentTool[],
  overrides: {
    chat?: (request: unknown) => Promise<unknown>;
    streamChat?: (request: unknown) => AsyncIterable<ChatChunk>;
    logger?: AgentLogger;
  } = {},
): AgentRuntimeDeps {
  return {
    llm: {
      async chat(request: unknown) {
        if (overrides.chat) {
          return overrides.chat(request);
        }
        return { text: 'unused' };
      },
      async *streamChat(request: unknown) {
        if (overrides.streamChat) {
          yield* overrides.streamChat(request);
          return;
        }
        yield { text: 'unused' };
      },
    },
    tools: createToolRegistry(tools),
    memory: createInMemoryAgentMemoryStore(),
    ...(overrides.logger ? { logger: overrides.logger } : {}),
  };
}

describe('createMastraAgentRuntime', () => {
  it('streams page-create events in the existing AgentEvent format', async () => {
    const plan: PagePlan = {
      pageTitle: '用户列表',
      pageType: 'list',
      blocks: [
        {
          id: 'table-block',
          description: '用户表格',
          components: ['Table'],
          priority: 1,
          complexity: 'simple',
        },
      ],
    };
    const blockNode: SchemaNode = {
      id: 'user-table-card',
      component: 'Card',
      children: [
        {
          id: 'user-table',
          component: 'Table',
          columns: [{ key: 'name', dataIndex: 'name', title: '姓名' }],
        },
      ],
    };
    const skeleton: PageSchema = {
      id: 'page-user-list',
      body: [{ id: 'table-block-skeleton', component: 'Card' }],
    };
    const finalSchema: PageSchema = {
      id: 'page-user-list',
      body: [blockNode],
    };
    const deps = createDeps([
      {
        name: 'planPage',
        async execute() {
          return plan;
        },
      },
      {
        name: 'buildSkeletonSchema',
        async execute() {
          return skeleton;
        },
      },
      {
        name: 'generateBlock',
        async execute() {
          return {
            blockId: 'table-block',
            node: blockNode,
            summary: '用户表格完成',
            tokensUsed: 12,
          };
        },
      },
      {
        name: 'assembleSchema',
        async execute() {
          return finalSchema;
        },
      },
    ]);
    const runtime = createMastraAgentRuntime({
      legacyRuntime: createLegacyRuntime([]),
      createDeps: () => deps,
      prepareRunRequest: async (request) => request,
    });

    const events: AgentEvent[] = [];
    for await (const event of runtime.runStream(createRequest())) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual([
      'run:start',
      'intent',
      'message:start',
      'message:delta',
      'tool:start',
      'tool:result',
      'plan',
      'tool:start',
      'tool:result',
      'schema:skeleton',
      'schema:block:start',
      'tool:start',
      'tool:result',
      'schema:block',
      'tool:start',
      'tool:result',
      'schema:done',
      'done',
    ]);
    const doneEvent = events.at(-1);
    expect(doneEvent?.type).toBe('done');
    expect(doneEvent && doneEvent.type === 'done' ? doneEvent.data.metadata.tokensUsed : undefined).toBe(12);
  });

  it('streams page-modify events in the existing AgentEvent format', async () => {
    const operation: AgentOperation = {
      op: 'schema.patchProps',
      nodeId: 'card-1',
      patch: { title: '新标题' },
    };
    const deps = createDeps([
      {
        name: 'modifySchema',
        async execute() {
          return {
            explanation: '已更新标题。',
            operations: [operation],
          };
        },
      },
    ]);
    const runtime = createMastraAgentRuntime({
      legacyRuntime: createLegacyRuntime([]),
      createDeps: () => deps,
      prepareRunRequest: async (request) => request,
    });

    const events: AgentEvent[] = [];
    for await (const event of runtime.runStream(createRequest({
      intent: 'schema.modify',
      prompt: '把标题改成新标题',
      context: {
        schemaSummary: 'card-1 exists',
        componentSummary: 'Card',
        schemaJson: {
          id: 'page-1',
          body: [{ id: 'card-1', component: 'Card' }],
        },
      },
    }))) {
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
  });

  it('falls back to the legacy runtime for non-page intents', async () => {
    const legacyEvents: AgentEvent[] = [
      { type: 'run:start', data: { sessionId: 'legacy-session', conversationId: 'conv-chat' } },
      { type: 'done', data: { metadata: { sessionId: 'legacy-session', conversationId: 'conv-chat' } } },
    ];
    const runtime = createMastraAgentRuntime({
      legacyRuntime: createLegacyRuntime(legacyEvents),
      createDeps: () => createDeps([]),
      prepareRunRequest: async (request) => request,
    });

    const events: AgentEvent[] = [];
    for await (const event of runtime.runStream(createRequest({
      intent: 'chat',
      prompt: '这个页面是做什么的？',
    }))) {
      events.push(event);
    }

    expect(events).toEqual(legacyEvents);
  });

  it('classifies routes through the mastra classifier path', async () => {
    const deps = createDeps([
      {
        name: 'classifyIntent',
        async execute() {
          return {
            intent: 'chat',
            confidence: 0.91,
            scope: 'multi-page',
          };
        },
      },
    ]);
    const runtime = createMastraAgentRuntime({
      legacyRuntime: createLegacyRuntime([]),
      createDeps: () => deps,
      prepareRunRequest: async (request) => request,
    });

    await expect(runtime.classifyRoute({
      prompt: '帮我生成一个多页面项目',
      context: { schemaSummary: 'pageId=empty; pageName=empty; nodeCount=0' },
    })).resolves.toEqual({
      scope: 'multi-page',
      intent: 'chat',
      confidence: 0.91,
    });
  });

  it('routes chat through mastra deps instead of legacy chat', async () => {
    const received: unknown[] = [];
    const runtime = createMastraAgentRuntime({
      legacyRuntime: createLegacyRuntime([]),
      createDeps: () => createDeps([], {
        async chat(request) {
          received.push(request);
          return { text: 'mastra chat reply' };
        },
      }),
      prepareRunRequest: async (request) => request,
    });

    await expect(runtime.chat({
      model: 'openai-compatible::glm-4.6',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: '下一步做什么？' },
      ],
    })).resolves.toEqual({ content: 'mastra chat reply' });
    expect(received).toEqual([{
      model: 'openai-compatible::glm-4.6',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: '下一步做什么？' },
      ],
    }]);
  });

  it('routes chat streams through mastra deps instead of legacy chat stream', async () => {
    const received: unknown[] = [];
    const runtime = createMastraAgentRuntime({
      legacyRuntime: createLegacyRuntime([]),
      createDeps: () => createDeps([], {
        async *streamChat(request) {
          received.push(request);
          yield { text: 'phase ' };
          yield { text: 'two' };
        },
      }),
      prepareRunRequest: async (request) => request,
    });

    const chunks: Array<{ delta: string }> = [];
    for await (const chunk of runtime.chatStream({
      model: 'openai-compatible::glm-4.6',
      messages: [
        { role: 'assistant', content: '上一轮输出' },
        { role: 'user', content: '继续' },
      ],
      stream: true,
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([{ delta: 'phase ' }, { delta: 'two' }]);
    expect(received).toEqual([{
      model: 'openai-compatible::glm-4.6',
      messages: [
        { role: 'assistant', content: '上一轮输出' },
        { role: 'user', content: '继续' },
      ],
      stream: true,
    }]);
  });

  it('finalizes through mastra memory instead of delegating to legacy finalize', async () => {
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    };
    const deps = createDeps([], { logger });
    await deps.memory.appendConversationMessage('conv-finalize', {
      role: 'assistant',
      text: '会更新当前卡片标题。',
      meta: {
        sessionId: 'run-finalize',
        intent: 'schema.modify',
        operations: [{ op: 'schema.patchProps', nodeId: 'card-1', patch: { title: '本月营收' } }],
      },
    });
    const legacyRuntime = createLegacyRuntime([]);
    legacyRuntime.finalize = vi.fn(async () => ({ memoryDebugFile: 'legacy-finalize.json' }));
    const writeMemoryDump = vi.fn(() => '.ai-debug/memory/mastra-finalize.json');
    const runtime = createMastraAgentRuntime({
      legacyRuntime,
      createDeps: () => deps,
      prepareRunRequest: async (request) => request,
      writeMemoryDump,
    });

    await expect(runtime.finalize({
      conversationId: 'conv-finalize',
      sessionId: 'run-finalize',
      success: false,
      error: 'op 1 failed',
      schemaDigest: 'fnv1a-deadbeef',
    })).resolves.toEqual({
      memoryDebugFile: '.ai-debug/memory/mastra-finalize.json',
    });

    expect(legacyRuntime.finalize).not.toHaveBeenCalled();
    expect(writeMemoryDump).toHaveBeenCalledOnce();
    await expect(deps.memory.getConversation('conv-finalize')).resolves.toEqual([
      {
        role: 'assistant',
        text: '[修改失败] op 1 failed\n会更新当前卡片标题。',
        meta: {
          sessionId: 'run-finalize',
          intent: 'schema.modify',
          failed: true,
          schemaDigest: 'fnv1a-deadbeef',
        },
      },
    ]);
    expect(logger.info).toHaveBeenCalledWith('mastra.runtime.finalize.start', expect.objectContaining({
      runtime: 'mastra',
      conversationId: 'conv-finalize',
      sessionId: 'run-finalize',
    }));
    expect(logger.info).toHaveBeenCalledWith('mastra.runtime.finalize.done', expect.objectContaining({
      runtime: 'mastra',
      outcome: 'patched',
      memoryDebugFile: '.ai-debug/memory/mastra-finalize.json',
    }));
  });
});
