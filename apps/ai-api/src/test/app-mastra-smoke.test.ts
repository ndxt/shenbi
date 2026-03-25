import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentEvent, RunMetadata } from '@shenbi/ai-contracts';
import type { AgentRuntime } from '../runtime/types.ts';

const SESSION_ID = 'mastra-session';
const CONVERSATION_ID = 'mastra-conversation';

const METADATA: RunMetadata = {
  sessionId: SESSION_ID,
  conversationId: CONVERSATION_ID,
  plannerModel: 'fake-planner',
  blockModel: 'fake-block',
  durationMs: 12,
};

function createMastraSmokeRuntime(): AgentRuntime {
  return {
    async run(request) {
      const events = request.intent === 'schema.modify'
        ? createModifyEvents()
        : createCreateEvents();
      return {
        events,
        metadata: METADATA,
      };
    },
    async *runStream(request) {
      const events = request.intent === 'schema.modify'
        ? createModifyEvents()
        : createCreateEvents();
      for (const event of events) {
        yield event;
      }
    },
    async chat() {
      return { content: 'legacy-chat' };
    },
    async *chatStream() {
      yield { delta: 'legacy-chat' };
    },
    async finalize() {
      return {};
    },
  };
}

function createCreateEvents(): AgentEvent[] {
  return [
    { type: 'run:start', data: { sessionId: SESSION_ID, conversationId: CONVERSATION_ID } },
    { type: 'intent', data: { intent: 'schema.create', confidence: 1, scope: 'single-page' } },
    { type: 'schema:skeleton', data: { schema: { id: 'page-1', body: [] } } },
    { type: 'schema:block:start', data: { blockId: 'hero-block', description: 'Hero block' } },
    {
      type: 'schema:block',
      data: {
        blockId: 'hero-block',
        node: { id: 'hero-card', component: 'Card' },
        tokensUsed: 8,
      },
    },
    { type: 'done', data: { metadata: METADATA } },
  ];
}

function createModifyEvents(): AgentEvent[] {
  return [
    { type: 'run:start', data: { sessionId: SESSION_ID, conversationId: CONVERSATION_ID } },
    { type: 'intent', data: { intent: 'schema.modify', confidence: 1, scope: 'single-page' } },
    {
      type: 'modify:start',
      data: {
        operationCount: 1,
        explanation: '已更新卡片标题',
        operations: [{ op: 'schema.patchProps', nodeId: 'card-1' }],
      },
    },
    {
      type: 'modify:op:pending',
      data: {
        index: 0,
        label: '更新 card-1 标题',
      },
    },
    {
      type: 'modify:op',
      data: {
        index: 0,
        operation: {
          op: 'schema.patchProps',
          nodeId: 'card-1',
          patch: { title: '本月营收' },
        },
      },
    },
    { type: 'modify:done', data: {} },
    { type: 'done', data: { metadata: METADATA } },
  ];
}

async function readSse(response: Response): Promise<AgentEvent[]> {
  const text = await response.text();
  return text
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice(6)) as AgentEvent);
}

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('createApp default mastra runtime smoke', () => {
  it('streams schema.create events through the default configured runtime', async () => {
    const runtime = createMastraSmokeRuntime();

    vi.doMock('../runtime/runtime-switch.ts', () => ({
      configuredRuntime: runtime,
    }));
    vi.doMock('../adapters/env.ts', () => ({
      loadEnv: () => ({
        PORT: 3100,
        AI_RUNTIME: 'mastra',
        AI_PROVIDER: '',
        AI_RATE_LIMIT_WINDOW_MS: 60_000,
        AI_RATE_LIMIT_MAX_REQUESTS: 60,
        providers: [],
        GITLAB_OAUTH_CLIENT_ID: '',
        GITLAB_OAUTH_CLIENT_SECRET: '',
        GITLAB_OAUTH_REDIRECT_URI: 'http://localhost:5173/api/gitlab/oauth/callback',
        GITLAB_DEFAULT_URL: 'https://gitlab.com',
        GITLAB_DEFAULT_GROUP_ID: undefined,
      }),
    }));

    const { createApp } = await import('../app.ts');
    const app = createApp();
    const response = await app.request('/api/ai/run/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: '创建一个仪表盘页面',
        intent: 'schema.create',
        context: {
          schemaSummary: 'empty page',
          componentSummary: 'Card, Table',
        },
      }),
    });

    expect(response.status).toBe(200);
    const events = await readSse(response);
    expect(events.map((event) => event.type)).toEqual([
      'run:start',
      'intent',
      'schema:skeleton',
      'schema:block:start',
      'schema:block',
      'done',
    ]);
  });

  it('streams schema.modify events through the default configured runtime', async () => {
    const runtime = createMastraSmokeRuntime();

    vi.doMock('../runtime/runtime-switch.ts', () => ({
      configuredRuntime: runtime,
    }));
    vi.doMock('../adapters/env.ts', () => ({
      loadEnv: () => ({
        PORT: 3100,
        AI_RUNTIME: 'mastra',
        AI_PROVIDER: '',
        AI_RATE_LIMIT_WINDOW_MS: 60_000,
        AI_RATE_LIMIT_MAX_REQUESTS: 60,
        providers: [],
        GITLAB_OAUTH_CLIENT_ID: '',
        GITLAB_OAUTH_CLIENT_SECRET: '',
        GITLAB_OAUTH_REDIRECT_URI: 'http://localhost:5173/api/gitlab/oauth/callback',
        GITLAB_DEFAULT_URL: 'https://gitlab.com',
        GITLAB_DEFAULT_GROUP_ID: undefined,
      }),
    }));

    const { createApp } = await import('../app.ts');
    const app = createApp();
    const response = await app.request('/api/ai/run/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: '把卡片标题改成本月营收',
        intent: 'schema.modify',
        context: {
          schemaSummary: 'card-1 exists',
          componentSummary: 'Card',
          schemaJson: {
            id: 'page-1',
            body: [{ id: 'card-1', component: 'Card' }],
          },
        },
      }),
    });

    expect(response.status).toBe(200);
    const events = await readSse(response);
    expect(events.map((event) => event.type)).toEqual([
      'run:start',
      'intent',
      'modify:start',
      'modify:op:pending',
      'modify:op',
      'modify:done',
      'done',
    ]);
  });
});
