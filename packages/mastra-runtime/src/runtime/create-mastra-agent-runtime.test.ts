import { describe, expect, it } from 'vitest';
import {
  createInMemoryAgentMemoryStore,
  createToolRegistry,
  type AgentRuntimeDeps,
  type AgentTool,
} from '@shenbi/ai-agents';
import type {
  AgentEvent,
  AgentOperation,
  ChatRequest,
  ChatResponse,
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
    async finalize(_request: FinalizeRequest): Promise<FinalizeResult> {
      return {};
    },
  };
}

function createDeps(tools: AgentTool[]): AgentRuntimeDeps {
  return {
    llm: {
      async chat() {
        return { text: 'unused' };
      },
      async *streamChat() {
        yield { text: 'unused' };
      },
    },
    tools: createToolRegistry(tools),
    memory: createInMemoryAgentMemoryStore(),
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
});
