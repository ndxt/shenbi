import { describe, it, expect } from 'vitest';
import { createApp } from '../app.ts';
import type { AiApiService } from '../runtime/types.ts';
import type {
  AgentEvent,
  ChatRequest,
  ChatResponse,
  ClassifyRouteResponse,
  FinalizeRequest,
  RunMetadata,
} from '@shenbi/ai-contracts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_BODY = {
  prompt: 'Build a dashboard page',
  context: {
    schemaSummary: 'empty page',
    componentSummary: 'HeroSection, DataTable',
  },
};

const FAKE_SESSION = 'test-session-1';

const FAKE_META: RunMetadata = {
  sessionId: FAKE_SESSION,
  plannerModel: 'fake',
  blockModel: 'fake',
  tokensUsed: 10,
  durationMs: 5,
};

const FAKE_EVENTS: AgentEvent[] = [
  { type: 'run:start', data: { sessionId: FAKE_SESSION } },
  { type: 'message:delta', data: { text: 'Hello' } },
  { type: 'done', data: { metadata: FAKE_META } },
];

function makeRuntime(overrides: Partial<AiApiService> = {}): AiApiService {
  return {
    async run() {
      return { events: FAKE_EVENTS, metadata: FAKE_META };
    },
    async *runStream() {
      for (const e of FAKE_EVENTS) {
        yield e;
      }
    },
    async chat() {
      return {
        content: 'chat response',
        tokensUsed: {
          input: 3,
          output: 5,
          total: 8,
        },
      };
    },
    async *chatStream() {
      yield { delta: 'chat ' };
      yield { delta: 'response' };
    },
    async classifyRoute(): Promise<ClassifyRouteResponse> {
      return {
        scope: 'single-page',
        intent: 'schema.create',
        confidence: 0.95,
      };
    },
    async finalize() {
      return {};
    },
    listModels() {
      return [{
        id: 'openai-compatible::glm-4.6',
        name: 'GLM-4.6',
        provider: 'openai-compatible',
        features: ['streaming'],
      }];
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
          conversationId: 'project-conv',
          prompt: 'build project',
        },
      };
      yield {
        type: 'project:done',
        data: {
          sessionId: 'project-session',
          createdFileIds: ['order-list'],
          completedPageIds: ['order-list'],
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
    ...overrides,
  };
}

async function readSSE(response: Response): Promise<AgentEvent[]> {
  const text = await response.text();
  const events: AgentEvent[] = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      events.push(JSON.parse(line.slice(6)) as AgentEvent);
    }
  }
  return events;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200', async () => {
    const app = createApp();
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ status: 'ok' });
  });
});

describe('GET /api/ai/models', () => {
  it('returns model list from the injected AI service', async () => {
    const app = createApp({
      runtime: makeRuntime({
        listModels() {
          return [{
            id: 'nextai::gemini-2.5-pro',
            name: 'gemini-2.5-pro',
            provider: 'nextai',
            features: ['streaming'],
          }];
        },
      }),
    });
    const res = await app.request('/api/ai/models');
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: unknown[] };
    expect(json.success).toBe(true);
    expect(json.data).toEqual([{
      id: 'nextai::gemini-2.5-pro',
      name: 'gemini-2.5-pro',
      provider: 'nextai',
      features: ['streaming'],
    }]);
  });

  it('supports provider-specific model lists returned by the AI service', async () => {
    const app = createApp({
      runtime: makeRuntime({
        listModels() {
          return [
            {
              id: 'nextai::gemini-2.5-pro',
              name: 'gemini-2.5-pro',
              provider: 'nextai',
              features: ['streaming'],
            },
            {
              id: 'nextai::gemini-2.5-flash',
              name: 'gemini-2.5-flash',
              provider: 'nextai',
              features: ['streaming'],
            },
          ];
        },
      }),
    });
    const res = await app.request('/api/ai/models');
    expect(res.status).toBe(200);
    const json = await res.json() as {
      success: boolean;
      data: Array<{ id: string; provider: string }>;
    };
    expect(json.success).toBe(true);
    expect(json.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'nextai::gemini-2.5-pro',
        provider: 'nextai',
      }),
      expect.objectContaining({
        id: 'nextai::gemini-2.5-flash',
        provider: 'nextai',
      }),
    ]));
  });
});

describe('POST /api/ai/run — happy path', () => {
  it('returns full RunResponse', async () => {
    const app = createApp({ runtime: makeRuntime() });
    const res = await app.request('/api/ai/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { events: AgentEvent[]; metadata: RunMetadata } };
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data.events)).toBe(true);
    expect(json.data.metadata.sessionId).toBe(FAKE_SESSION);
  });
});

describe('POST /api/ai/run — validation 400', () => {
  it('rejects missing prompt', async () => {
    const app = createApp();
    const res = await app.request('/api/ai/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: { schemaSummary: 'x', componentSummary: 'y' } }),
    });
    expect(res.status).toBe(400);
    const json = await res.json() as { success: boolean; error: string };
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/prompt/i);
  });

  it('rejects missing context.schemaSummary', async () => {
    const app = createApp();
    const res = await app.request('/api/ai/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hi', context: { componentSummary: 'y' } }),
    });
    expect(res.status).toBe(400);
    const json = await res.json() as { success: boolean; error: string };
    expect(json.error).toMatch(/schemaSummary/i);
  });

  it('rejects missing context.componentSummary', async () => {
    const app = createApp();
    const res = await app.request('/api/ai/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hi', context: { schemaSummary: 'x' } }),
    });
    expect(res.status).toBe(400);
    const json = await res.json() as { success: boolean; error: string };
    expect(json.error).toMatch(/componentSummary/i);
  });

  it('rejects non-JSON body', async () => {
    const app = createApp();
    const res = await app.request('/api/ai/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/ai/run/finalize', () => {
  it('passes FinalizeRequest to runtime.finalize', async () => {
    let received: FinalizeRequest | undefined;
    const app = createApp({
      runtime: makeRuntime({
        async finalize(request) {
          received = request;
          return {
            memoryDebugFile: '.ai-debug/memory/finalize.json',
          };
        },
      }),
    });

    const res = await app.request('/api/ai/run/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: 'conv-1',
        sessionId: 'session-1',
        success: false,
        failedOpIndex: 0,
        error: 'node not found',
        schemaDigest: 'fnv1a-12345678',
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: {
        memoryDebugFile: '.ai-debug/memory/finalize.json',
      },
    });
    expect(received).toEqual({
      conversationId: 'conv-1',
      sessionId: 'session-1',
      success: false,
      failedOpIndex: 0,
      error: 'node not found',
      schemaDigest: 'fnv1a-12345678',
    });
  });
});

describe('POST /api/ai/chat', () => {
  const VALID_CHAT_BODY = {
    model: 'openai-compatible::glm-4.6',
    messages: [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'List the next step.' },
    ],
  };

  it('returns non-stream chat response', async () => {
    let received: ChatRequest | undefined;
    const app = createApp({
      runtime: makeRuntime({
        async chat(request) {
          received = request;
          return {
            content: 'next step',
            tokensUsed: { input: 4, output: 6, total: 10 },
            durationMs: 12,
          } satisfies ChatResponse;
        },
      }),
    });

    const res = await app.request('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_CHAT_BODY),
    });

    expect(res.status).toBe(200);
    expect(received).toEqual(VALID_CHAT_BODY);
    expect(await res.json()).toEqual({
      success: true,
      data: {
        content: 'next step',
        tokensUsed: { input: 4, output: 6, total: 10 },
        durationMs: 12,
      },
    });
  });

  it('streams chat deltas over SSE when stream=true', async () => {
    const app = createApp({
      runtime: makeRuntime({
        async *chatStream() {
          yield { delta: 'step ' };
          yield { delta: 'one' };
        },
      }),
    });

    const res = await app.request('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_CHAT_BODY, stream: true }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    expect(await res.text()).toContain('"delta":"step "');
    expect(await app.request('/health')).toBeTruthy();
  });

  it('rejects invalid chat payloads', async () => {
    const app = createApp();
    const res = await app.request('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: '', messages: [] }),
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { success: boolean; error: string };
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/model|messages/i);
  });
});

describe('POST /api/ai/classify-route', () => {
  it('delegates to runtime.classifyRoute', async () => {
    const app = createApp({
      runtime: makeRuntime({
        async classifyRoute() {
          return {
            scope: 'multi-page',
            intent: 'chat',
            confidence: 0.88,
            preparedPrompt: 'prepared prompt',
          };
        },
      }),
    });

    const res = await app.request('/api/ai/classify-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: '帮我生成多个页面',
        context: { schemaSummary: 'pageId=empty; pageName=empty; nodeCount=0' },
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: {
        scope: 'multi-page',
        intent: 'chat',
        confidence: 0.88,
        preparedPrompt: 'prepared prompt',
      },
    });
  });
});

describe('POST /api/ai/debug/client-error', () => {
  it('writes a client debug dump through the injected AI service', async () => {
    let received: unknown;
    const app = createApp({
      runtime: makeRuntime({
        writeClientDebug(input) {
          received = input;
          return '.ai-debug/errors/custom-client-debug.json';
        },
      }),
    });
    const res = await app.request('/api/ai/debug/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'agent-loop-react-parse',
        error: 'Missing Action field in ReAct response',
        rawResponse: '我先分析一下需求',
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as {
      success: boolean;
      data: {
        debugFile: string;
      };
    };
    expect(json.success).toBe(true);
    expect(json.data.debugFile).toBe('.ai-debug/errors/custom-client-debug.json');
    expect(received).toEqual(expect.objectContaining({
      path: '/api/ai/debug/client-error',
      method: 'POST',
    }));
  });

  it('is not blocked by the AI request rate limit', async () => {
    const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
    const app = createApp({
      runtime: makeRuntime(),
      rateLimitStore,
      rateLimitMaxRequests: 1,
    });

    const runRes = await app.request('/api/ai/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '9.9.9.9',
      },
      body: JSON.stringify(VALID_BODY),
    });
    expect(runRes.status).toBe(200);

    const debugRes = await app.request('/api/ai/debug/client-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '9.9.9.9',
      },
      body: JSON.stringify({
        source: 'agent-loop-react-parse',
        error: 'debug only',
      }),
    });
    expect(debugRes.status).toBe(200);
  });

  it('writes a trace dump through the injected AI service', async () => {
    let received: unknown;
    const app = createApp({
      runtime: makeRuntime({
        writeTraceDebug(input) {
          received = input;
          return '.ai-debug/traces/custom-trace.json';
        },
      }),
    });
    const res = await app.request('/api/ai/debug/trace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'success',
        trace: {
          steps: [
            { action: 'listWorkspaceFiles' },
          ],
        },
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as {
      success: boolean;
      data: {
        traceFile: string;
      };
    };
    expect(json.success).toBe(true);
    expect(json.data.traceFile).toBe('.ai-debug/traces/custom-trace.json');
    expect(received).toEqual({
      status: 'success',
      trace: {
        steps: [
          { action: 'listWorkspaceFiles' },
        ],
      },
    });
  });
});

describe('POST /api/ai/run — 503 LLM error', () => {
  it('maps LLMError to 503', async () => {
    const { LLMError } = await import('../adapters/errors.ts');
    const runtime = makeRuntime({
      async run() {
        throw new LLMError('Provider unavailable');
      },
    });
    const app = createApp({ runtime });
    const res = await app.request('/api/ai/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });
    expect(res.status).toBe(503);
    const json = await res.json() as { success: boolean; error: string };
    expect(json.success).toBe(false);
    expect(json.error).toContain('Provider unavailable');
    expect(json.error).toContain('Debug file: .ai-debug');
  });
});

describe('POST /api/ai/project/*', () => {
  it('streams project events through the injected AI service', async () => {
    const app = createApp({
      runtime: makeRuntime({
        async *projectStream() {
          yield {
            type: 'project:start',
            data: {
              sessionId: 'project-1',
              conversationId: 'conv-project',
              prompt: '生成订单管理项目',
            },
          };
          yield {
            type: 'project:awaiting_confirmation',
            data: {
              sessionId: 'project-1',
              plan: {
                projectName: '订单管理后台',
                pages: [{
                  pageId: 'order-list',
                  pageName: '订单列表',
                  action: 'create',
                  description: '订单列表页',
                }],
              },
            },
          };
        },
      }),
    });

    const res = await app.request('/api/ai/project/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: '生成订单管理项目',
        workspace: {
          componentSummary: 'Card, Table',
          files: [],
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(await res.text()).toContain('"type":"project:awaiting_confirmation"');
  });

  it('delegates confirm/revise/cancel to the injected AI service', async () => {
    const app = createApp({ runtime: makeRuntime() });

    const confirmRes = await app.request('/api/ai/project/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'project-session' }),
    });
    expect(await confirmRes.json()).toEqual({
      success: true,
      data: { sessionId: 'project-session', status: 'executing' },
    });

    const reviseRes = await app.request('/api/ai/project/revise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'project-session', revisionPrompt: '增加审批页' }),
    });
    expect(await reviseRes.json()).toEqual({
      success: true,
      data: { sessionId: 'project-session', status: 'awaiting_confirmation' },
    });

    const cancelRes = await app.request('/api/ai/project/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'project-session' }),
    });
    expect(await cancelRes.json()).toEqual({
      success: true,
      data: { sessionId: 'project-session', status: 'cancelled' },
    });
  });
});

describe('POST /api/ai/run — 429 rate limit', () => {
  it('rejects after exceeding limit', async () => {
    // 独立 store 确保测试隔离，不受其他用例影响
    const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
    const app = createApp({ runtime: makeRuntime(), rateLimitStore, rateLimitMaxRequests: 10 });

    const results: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await app.request('/api/ai/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '9.9.9.9',
        },
        body: JSON.stringify(VALID_BODY),
      });
      results.push(res.status);
    }

    expect(results.filter((s) => s === 429).length).toBeGreaterThan(0);
    expect(results.filter((s) => s === 200).length).toBe(10);
  });
});

describe('POST /api/ai/run/stream — SSE', () => {
  it('returns text/event-stream with AgentEvents', async () => {
    const app = createApp({ runtime: makeRuntime() });
    const res = await app.request('/api/ai/run/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const events = await readSSE(res);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.type).toBe('run:start');
    expect(events.at(-1)?.type).toBe('done');
  });

  it('returns 400 for invalid request', async () => {
    const app = createApp();
    const res = await app.request('/api/ai/run/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('emits error event on stream runtime failure', async () => {
    const { LLMError } = await import('../adapters/errors.ts');
    const runtime = makeRuntime({
      async *runStream() {
        throw new LLMError('stream blow up');
      },
    });
    const app = createApp({ runtime });
    const res = await app.request('/api/ai/run/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });
    expect(res.status).toBe(200);
    const events = await readSSE(res);
    const errorEvent = events.find((e) => e.type === 'error');
    expect(errorEvent).toBeDefined();
  });
});
