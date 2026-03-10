import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = {
  AI_PROVIDER: process.env.AI_PROVIDER,
  AI_OPENAI_COMPAT_BASE_URL: process.env.AI_OPENAI_COMPAT_BASE_URL,
  AI_OPENAI_COMPAT_API_KEY: process.env.AI_OPENAI_COMPAT_API_KEY,
  AI_BLOCK_MODEL: process.env.AI_BLOCK_MODEL,
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
  if (originalEnv.AI_BLOCK_MODEL === undefined) {
    delete process.env.AI_BLOCK_MODEL;
  } else {
    process.env.AI_BLOCK_MODEL = originalEnv.AI_BLOCK_MODEL;
  }
});

describe('executeModifySchema', () => {
  it('returns parsed modify operations from the provider response', async () => {
    process.env.AI_PROVIDER = 'openai-compatible';
    process.env.AI_OPENAI_COMPAT_BASE_URL = 'https://example.test/v1';
    process.env.AI_OPENAI_COMPAT_API_KEY = 'test-key';
    process.env.AI_BLOCK_MODEL = 'mock-model';

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              explanation: '会更新卡片标题。',
              operations: [
                {
                  op: 'schema.patchProps',
                  nodeId: 'card-1',
                  patch: { title: '本月营收' },
                },
              ],
            }),
          },
        },
      ],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { executeModifySchema } = await import('./modify-schema.ts');
    const result = await executeModifySchema({
      request: {
        prompt: '把卡片标题改成本月营收',
        selectedNodeId: 'card-1',
        context: {
          schemaSummary: 'Dashboard page',
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
      },
      context: {
        prompt: '把卡片标题改成本月营收',
        selectedNodeId: 'card-1',
        document: {
          exists: true,
          summary: 'Dashboard page',
          tree: 'Card#card-1',
          schema: {
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
        componentSummary: 'Card, Table',
        conversation: {
          history: [],
          turnCount: 0,
        },
        lastBlockIds: [],
      },
    });

    expect(result).toEqual({
      explanation: '会更新卡片标题。',
      operations: [
        {
          op: 'schema.patchProps',
          nodeId: 'card-1',
          patch: { title: '本月营收' },
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
