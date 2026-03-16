import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = {
  AI_PROVIDER: process.env.AI_PROVIDER,
  AI_OPENAI_COMPAT_BASE_URL: process.env.AI_OPENAI_COMPAT_BASE_URL,
  AI_OPENAI_COMPAT_API_KEY: process.env.AI_OPENAI_COMPAT_API_KEY,
  AI_PLANNER_MODEL: process.env.AI_PLANNER_MODEL,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  if (originalEnv.AI_PROVIDER === undefined) {
    delete process.env.AI_PROVIDER;
  } else {
    process.env.AI_PROVIDER = originalEnv.AI_PROVIDER;
  }
  if (originalEnv.AI_OPENAI_COMPAT_BASE_URL === undefined) {
    delete process.env.AI_OPENAI_COMPAT_BASE_URL;
  } else {
    process.env.AI_OPENAI_COMPAT_BASE_URL = originalEnv.AI_OPENAI_COMPAT_BASE_URL;
  }
  if (originalEnv.AI_OPENAI_COMPAT_API_KEY === undefined) {
    delete process.env.AI_OPENAI_COMPAT_API_KEY;
  } else {
    process.env.AI_OPENAI_COMPAT_API_KEY = originalEnv.AI_OPENAI_COMPAT_API_KEY;
  }
  if (originalEnv.AI_PLANNER_MODEL === undefined) {
    delete process.env.AI_PLANNER_MODEL;
  } else {
    process.env.AI_PLANNER_MODEL = originalEnv.AI_PLANNER_MODEL;
  }
});

describe('classifyIntentWithModel', () => {
  it('returns parsed intent classification from provider output', async () => {
    process.env.AI_PROVIDER = 'openai-compatible';
    process.env.AI_OPENAI_COMPAT_BASE_URL = 'https://example.test/v1';
    process.env.AI_OPENAI_COMPAT_API_KEY = 'test-key';
    process.env.AI_PLANNER_MODEL = 'mock-model';

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              intent: 'schema.modify',
              confidence: 0.91,
            }),
          },
        },
      ],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { classifyIntentWithModel } = await import('./classify-intent.ts');
    const result = await classifyIntentWithModel({
      request: {
        prompt: '把当前卡片标题改成本月营收',
        context: {
          schemaSummary: 'pageId=page-1; nodeCount=1',
          componentSummary: 'Card',
          schemaJson: {
            id: 'page-1',
            body: [{ id: 'card-1', component: 'Card', children: [] }],
          },
        },
      },
      context: {
        prompt: '把当前卡片标题改成本月营收',
        selectedNodeId: 'card-1',
        document: {
          exists: true,
          summary: 'pageId=page-1; nodeCount=1',
          tree: 'Card#card-1',
          schema: {
            id: 'page-1',
            body: [{ id: 'card-1', component: 'Card', children: [] }],
          },
        },
        componentSummary: 'Card',
        conversation: {
          history: [],
          turnCount: 0,
        },
        lastBlockIds: [],
      },
    });

    expect(result).toEqual({
      intent: 'schema.modify',
      confidence: 0.91,
    });
  }, 15000);
});
