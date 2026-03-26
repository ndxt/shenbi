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
    listModels() {
      return [];
    },
    writeClientDebug() {
      return '.ai-debug/errors/client-debug.json';
    },
    writeTraceDebug() {
      return '.ai-debug/traces/trace.json';
    },
    async *projectStream() {
      yield {
        type: 'project:start',
        data: {
          sessionId: 'project-session',
          conversationId: 'project-conversation',
          prompt: 'build project',
        },
      };
    },
    async confirmProject() {
      return { sessionId: 'project-session', status: 'executing' as const };
    },
    async reviseProject() {
      return { sessionId: 'project-session', status: 'awaiting_confirmation' as const };
    },
    async cancelProject() {
      return { sessionId: 'project-session', status: 'cancelled' as const };
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
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
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
    ], { logger });
    const runtime = createMastraAgentRuntime({
      legacyRuntime: createLegacyRuntime([]),
      createDeps: () => deps,
      prepareRunRequest: async (request) => request,
      listModels: () => [],
      writeClientDebug: () => '.ai-debug/errors/client-debug.json',
      writeTraceDebug: () => '.ai-debug/traces/trace.json',
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
    expect(logger.info).toHaveBeenCalledWith('mastra.runtime.run_stream.start', expect.objectContaining({
      runtime: 'mastra',
      runContext: 'single-page',
    }));
    expect(logger.info).toHaveBeenCalledWith('mastra.runtime.run_stream.done', expect.objectContaining({
      runtime: 'mastra',
      runContext: 'single-page',
    }));
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
      listModels: () => [],
      writeClientDebug: () => '.ai-debug/errors/client-debug.json',
      writeTraceDebug: () => '.ai-debug/traces/trace.json',
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

  it('streams chat intents through mastra runStream instead of legacy fallback', async () => {
    const streamRequests: unknown[] = [];
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    };
    const runtime = createMastraAgentRuntime({
      legacyRuntime: createLegacyRuntime([]),
      createDeps: () => createDeps([], {
        logger,
        async *streamChat(request) {
          streamRequests.push(request);
          yield { text: '这是' };
          yield { text: '聊天回复' };
        },
      }),
      prepareRunRequest: async (request) => request,
      listModels: () => [],
      writeClientDebug: () => '.ai-debug/errors/client-debug.json',
      writeTraceDebug: () => '.ai-debug/traces/trace.json',
    });

    const events: AgentEvent[] = [];
    for await (const event of runtime.runStream(createRequest({
      intent: 'chat',
      prompt: '这个页面是做什么的？',
    }))) {
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
    expect(events.filter((event) => event.type === 'message:delta')).toEqual([
      { type: 'message:delta', data: { text: '这是' } },
      { type: 'message:delta', data: { text: '聊天回复' } },
    ]);
    expect(streamRequests).toEqual([{
      prompt: '这个页面是做什么的？',
      plannerModel: undefined,
      blockModel: undefined,
      context: expect.any(Object),
    }]);
    expect(logger.info).toHaveBeenCalledWith('mastra.runtime.run_stream.start', expect.objectContaining({
      runtime: 'mastra',
      intent: 'chat',
      runContext: 'single-page',
    }));
    expect(logger.info).toHaveBeenCalledWith('mastra.runtime.run_stream.done', expect.objectContaining({
      runtime: 'mastra',
      intent: 'chat',
      runContext: 'single-page',
    }));
  });

  it('emits an error instead of falling back to legacy for unsupported intents', async () => {
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    };
    const runtime = createMastraAgentRuntime({
      legacyRuntime: createLegacyRuntime([
        { type: 'run:start', data: { sessionId: 'legacy-session', conversationId: 'legacy-conv' } },
      ]),
      createDeps: () => createDeps([], { logger }),
      prepareRunRequest: async (request) => request,
      listModels: () => [],
      writeClientDebug: () => '.ai-debug/errors/client-debug.json',
      writeTraceDebug: () => '.ai-debug/traces/trace.json',
    });

    const events: AgentEvent[] = [];
    for await (const event of runtime.runStream(createRequest({
      intent: 'unknown.intent' as unknown as AgentIntent,
      prompt: '触发未知意图',
    }))) {
      events.push(event);
    }

    expect(events).toEqual([{
      type: 'error',
      data: {
        message: 'Unsupported mastra run intent: unknown.intent',
      },
    }]);
    expect(logger.error).toHaveBeenCalledWith('mastra.runtime.run_stream.unsupported_intent', expect.objectContaining({
      runtime: 'mastra',
      resolvedIntent: 'unknown.intent',
      runContext: 'single-page',
      message: 'Unsupported mastra run intent: unknown.intent',
    }));
  });

  it('surfaces non-Error workflow failures instead of collapsing to a generic runtime message', async () => {
    const runtime = createMastraAgentRuntime({
      legacyRuntime: createLegacyRuntime([]),
      createDeps: () => createDeps([
        {
          name: 'planPage',
          async execute() {
            throw { code: 'INVALID_STRUCTURED_OUTPUT', detail: 'planner output missing blocks' };
          },
        },
      ]),
      prepareRunRequest: async (request) => request,
      listModels: () => [],
      writeClientDebug: () => '.ai-debug/errors/client-debug.json',
      writeTraceDebug: () => '.ai-debug/traces/trace.json',
    });

    const events = await Array.fromAsync(runtime.runStream(createRequest()));
    expect(events.at(-1)).toEqual(expect.objectContaining({
      type: 'error',
      data: expect.objectContaining({
        message: expect.not.stringMatching(/^Mastra runtime failed$/),
      }),
    }));
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
      listModels: () => [],
      writeClientDebug: () => '.ai-debug/errors/client-debug.json',
      writeTraceDebug: () => '.ai-debug/traces/trace.json',
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
      listModels: () => [],
      writeClientDebug: () => '.ai-debug/errors/client-debug.json',
      writeTraceDebug: () => '.ai-debug/traces/trace.json',
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
      listModels: () => [],
      writeClientDebug: () => '.ai-debug/errors/client-debug.json',
      writeTraceDebug: () => '.ai-debug/traces/trace.json',
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
      listModels: () => [],
      writeClientDebug: () => '.ai-debug/errors/client-debug.json',
      writeTraceDebug: () => '.ai-debug/traces/trace.json',
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

  it('marks multi-page loop sub-runs in mastra run-stream logs', async () => {
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    };
    const deps = createDeps([
      {
        name: 'planPage',
        async execute() {
          return {
            pageTitle: '订单列表页',
            pageType: 'list',
            blocks: [
              {
                id: 'table-block',
                description: '订单表格',
                components: ['Table'],
                priority: 1,
                complexity: 'simple',
              },
            ],
          };
        },
      },
      {
        name: 'buildSkeletonSchema',
        async execute() {
          return {
            id: 'page-order-list',
            body: [],
          };
        },
      },
      {
        name: 'generateBlock',
        async execute() {
          return {
            blockId: 'table-block',
            node: {
              id: 'order-table',
              component: 'Table',
            },
            summary: '订单表格完成',
          };
        },
      },
      {
        name: 'assembleSchema',
        async execute() {
          return {
            id: 'page-order-list',
            body: [{
              id: 'order-table',
              component: 'Table',
            }],
          };
        },
      },
    ], { logger });
    const runtime = createMastraAgentRuntime({
      legacyRuntime: createLegacyRuntime([]),
      createDeps: () => deps,
      prepareRunRequest: async (request) => request,
      listModels: () => [],
      writeClientDebug: () => '.ai-debug/errors/client-debug.json',
      writeTraceDebug: () => '.ai-debug/traces/trace.json',
    });

    const events = await Array.fromAsync(runtime.runStream(createRequest({
      context: {
        schemaSummary: 'empty',
        componentSummary: 'Card, Table, Form',
        workspaceFileIds: ['current', 'page-order-list'],
      },
    })));

    expect(events.at(-1)?.type).toBe('done');
    expect(logger.info).toHaveBeenCalledWith('mastra.runtime.run_stream.start', expect.objectContaining({
      runtime: 'mastra',
      runContext: 'multi-page-loop',
    }));
    expect(logger.info).toHaveBeenCalledWith('mastra.runtime.run_stream.done', expect.objectContaining({
      runtime: 'mastra',
      runContext: 'multi-page-loop',
    }));
  });

  it('exposes model and debug helpers through the mastra AI service boundary', async () => {
    const runtime = createMastraAgentRuntime({
      legacyRuntime: createLegacyRuntime([]),
      createDeps: () => createDeps([]),
      prepareRunRequest: async (request) => request,
      listModels: () => [{
        id: 'nextai::gemini-2.5-pro',
        name: 'gemini-2.5-pro',
        provider: 'nextai',
        features: ['streaming'],
      }],
      writeClientDebug: (input) => `.ai-debug/errors/${input.requestId ?? 'client-debug'}.json`,
      writeTraceDebug: (input) => `.ai-debug/traces/${input.status}.json`,
    });

    await expect(Promise.resolve(runtime.listModels())).resolves.toEqual([{
      id: 'nextai::gemini-2.5-pro',
      name: 'gemini-2.5-pro',
      provider: 'nextai',
      features: ['streaming'],
    }]);
    await expect(Promise.resolve(runtime.writeClientDebug({
      error: 'boom',
      requestId: 'req-1',
    }))).resolves.toBe('.ai-debug/errors/req-1.json');
    await expect(Promise.resolve(runtime.writeTraceDebug({
      status: 'error',
      trace: { step: 'parse' },
    }))).resolves.toBe('.ai-debug/traces/error.json');
  });

  it('runs project workflow sessions through mastra and resumes after confirmation', async () => {
    const deps = createDeps([
      {
        name: 'planPage',
        async execute() {
          return {
            pageTitle: '订单列表',
            pageType: 'list',
            blocks: [{
              id: 'table-block',
              description: '订单表格',
              components: ['Table'],
              priority: 1,
              complexity: 'simple',
            }],
          };
        },
      },
      {
        name: 'buildSkeletonSchema',
        async execute() {
          return {
            id: 'order-list',
            body: [],
          };
        },
      },
      {
        name: 'generateBlock',
        async execute() {
          return {
            blockId: 'table-block',
            node: {
              id: 'order-table',
              component: 'Table',
            },
            summary: '订单表格完成',
          };
        },
      },
      {
        name: 'assembleSchema',
        async execute() {
          return {
            id: 'order-list',
            body: [{
              id: 'order-table',
              component: 'Table',
            }],
          };
        },
      },
    ], {
      async chat() {
        return {
          text: JSON.stringify({
            projectName: '订单管理后台',
            pages: [{
              pageId: 'order-list',
              pageName: '订单列表',
              action: 'create',
              description: '展示订单列表和筛选',
              prompt: '创建订单列表页，包含筛选和表格。',
            }],
          }),
        };
      },
    });
    const runtime = createMastraAgentRuntime({
      legacyRuntime: createLegacyRuntime([]),
      createDeps: () => deps,
      prepareRunRequest: async (request) => request,
      listModels: () => [],
      writeClientDebug: () => '.ai-debug/errors/client-debug.json',
      writeTraceDebug: () => '.ai-debug/traces/trace.json',
    });

    const iterator = runtime.projectStream({
      prompt: '生成订单管理项目',
      plannerModel: 'glm-4.7',
      blockModel: 'glm-4.6',
      workspace: {
        componentSummary: 'Card, Table, Form',
        files: [],
      },
    })[Symbol.asyncIterator]();

    const first = await iterator.next();
    const second = await iterator.next();
    const third = await iterator.next();
    expect(first.value?.type).toBe('project:start');
    expect(second.value?.type).toBe('project:plan');
    expect(third.value?.type).toBe('project:awaiting_confirmation');

    const sessionId = first.value && first.value.type === 'project:start'
      ? first.value.data.sessionId
      : undefined;
    if (!sessionId) {
      throw new Error('project session id was not emitted');
    }
    await expect(runtime.confirmProject({ sessionId })).resolves.toEqual({
      sessionId,
      status: 'executing',
    });

    const remaining: string[] = [];
    while (true) {
      const next = await iterator.next();
      if (next.done) {
        break;
      }
      remaining.push(next.value.type);
    }

    expect(remaining).toContain('project:page:start');
    expect(remaining).toContain('project:page:event');
    expect(remaining).toContain('project:page:done');
    expect(remaining.at(-1)).toBe('project:done');
  });

  it('revises project plans before confirmation', async () => {
    const prompts: string[] = [];
    const deps = createDeps([], {
      async chat(request) {
        prompts.push(JSON.stringify(request));
        return {
          text: JSON.stringify({
            projectName: prompts.length > 1 ? '订单管理后台-修订版' : '订单管理后台',
            pages: [{
              pageId: 'order-list',
              pageName: '订单列表',
              action: 'create',
              description: '展示订单列表',
            }],
          }),
        };
      },
    });
    const runtime = createMastraAgentRuntime({
      legacyRuntime: createLegacyRuntime([]),
      createDeps: () => deps,
      prepareRunRequest: async (request) => request,
      listModels: () => [],
      writeClientDebug: () => '.ai-debug/errors/client-debug.json',
      writeTraceDebug: () => '.ai-debug/traces/trace.json',
    });

    const iterator = runtime.projectStream({
      prompt: '生成订单管理项目',
      workspace: {
        componentSummary: 'Card, Table',
        files: [],
      },
    })[Symbol.asyncIterator]();

    const events = [
      await iterator.next(),
      await iterator.next(),
      await iterator.next(),
    ];
    const sessionId = events[0].value && events[0].value.type === 'project:start'
      ? events[0].value.data.sessionId
      : undefined;
    if (!sessionId) {
      throw new Error('project session id was not emitted');
    }
    await expect(runtime.reviseProject({
      sessionId,
      revisionPrompt: '增加审批页',
    })).resolves.toEqual({
      sessionId,
      status: 'awaiting_confirmation',
    });

    const revisedPlan = await iterator.next();
    expect(revisedPlan.value?.type).toBe('project:plan');
    if (revisedPlan.value?.type !== 'project:plan') {
      throw new Error('revised project plan was not emitted');
    }
    expect(revisedPlan.value.data.plan.projectName).toBe('订单管理后台-修订版');
    await runtime.cancelProject({ sessionId });
    await Array.fromAsync(iterator);
  });

  it('fails fast when runStream receives a multi-page classification', async () => {
    const deps = createDeps([
      {
        name: 'classifyIntent',
        async execute() {
          return {
            intent: 'schema.create' as const,
            confidence: 0.95,
            scope: 'multi-page' as const,
          };
        },
      },
    ]);
    const runtime = createMastraAgentRuntime({
      legacyRuntime: createLegacyRuntime([]),
      createDeps: () => deps,
      prepareRunRequest: async (request) => ({
        ...request,
        intent: undefined,
      }),
      listModels: () => [],
      writeClientDebug: () => '.ai-debug/errors/client-debug.json',
      writeTraceDebug: () => '.ai-debug/traces/trace.json',
    });

    const events: AgentEvent[] = [];
    for await (const event of runtime.runStream(createRequest({
      intent: undefined,
      prompt: '这是一个完整系统需求文档，包含首页、列表页和详情页，请帮我规划项目',
    }))) {
      events.push(event);
    }

    expect(events.at(-1)).toEqual({
      type: 'error',
      data: {
        message: 'Mastra run/stream received a multi-page request; route it through /api/ai/project/stream instead.',
      },
    });
  });
});
