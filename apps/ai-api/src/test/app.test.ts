import { describe, it, expect } from 'vitest';
import { createApp } from '../app.ts';
import type { AgentRuntime } from '../runtime/types.ts';
import type { AgentEvent, FinalizeRequest, RunMetadata } from '@shenbi/ai-contracts';

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

function makeRuntime(overrides: Partial<AgentRuntime> = {}): AgentRuntime {
  return {
    async run() {
      return { events: FAKE_EVENTS, metadata: FAKE_META };
    },
    async *runStream() {
      for (const e of FAKE_EVENTS) {
        yield e;
      }
    },
    async finalize() {
      return;
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
  it('returns model list', async () => {
    const previousProvider = process.env.AI_PROVIDER;
    const previousProviders = process.env.AI_PROVIDERS;
    const previousModels = process.env.AI_AVAILABLE_MODELS;
    try {
      process.env.AI_PROVIDER = 'openai-compatible';
      process.env.AI_PROVIDERS = 'openai-compatible';
      process.env.AI_AVAILABLE_MODELS = 'GLM-4.7,GLM-4.6';
      const app = createApp();
      const res = await app.request('/api/ai/models');
      expect(res.status).toBe(200);
      const json = await res.json() as { success: boolean; data: unknown[] };
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect((json.data as Array<{ id: string }>).length).toBeGreaterThan(0);
      const model = (json.data as Array<{ id: string; provider: string }>)[0];
      expect(typeof model?.id).toBe('string');
      expect(typeof model?.provider).toBe('string');
      expect(model?.id).toContain('openai-compatible::');
    } finally {
      if (previousProvider === undefined) {
        delete process.env.AI_PROVIDER;
      } else {
        process.env.AI_PROVIDER = previousProvider;
      }
      if (previousProviders === undefined) {
        delete process.env.AI_PROVIDERS;
      } else {
        process.env.AI_PROVIDERS = previousProviders;
      }
      if (previousModels === undefined) {
        delete process.env.AI_AVAILABLE_MODELS;
      } else {
        process.env.AI_AVAILABLE_MODELS = previousModels;
      }
    }
  });

  it('returns provider-specific model list for arbitrary openai-compatible vendors', async () => {
    const previousProvider = process.env.AI_PROVIDER;
    const previousProviders = process.env.AI_PROVIDERS;
    const previousModels = process.env.NEXTAI_MODELS;
    try {
      process.env.AI_PROVIDER = 'nextai';
      process.env.AI_PROVIDERS = 'openai-compatible,nextai';
      process.env.NEXTAI_MODELS = 'gemini-2.5-pro, gemini-2.5-flash';
      const app = createApp();
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
    } finally {
      if (previousProvider === undefined) {
        delete process.env.AI_PROVIDER;
      } else {
        process.env.AI_PROVIDER = previousProvider;
      }
      if (previousProviders === undefined) {
        delete process.env.AI_PROVIDERS;
      } else {
        process.env.AI_PROVIDERS = previousProviders;
      }
      if (previousModels === undefined) {
        delete process.env.NEXTAI_MODELS;
      } else {
        process.env.NEXTAI_MODELS = previousModels;
      }
    }
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
    expect(await res.json()).toEqual({ success: true });
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

describe('POST /api/ai/run — 429 rate limit', () => {
  it('rejects after exceeding limit', async () => {
    // 独立 store 确保测试隔离，不受其他用例影响
    const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
    const app = createApp({ runtime: makeRuntime(), rateLimitStore });

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
