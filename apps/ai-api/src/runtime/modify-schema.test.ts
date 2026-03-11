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

  it('salvages fenced modify JSON with trailing noise', async () => {
    process.env.AI_PROVIDER = 'openai-compatible';
    process.env.AI_OPENAI_COMPAT_BASE_URL = 'https://example.test/v1';
    process.env.AI_OPENAI_COMPAT_API_KEY = 'test-key';
    process.env.AI_BLOCK_MODEL = 'mock-model';

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: "```json\n{\"explanation\":\"追加卡片。\",\"operations\":[{\"op\":\"schema.insertNode\",\"container\":\"body\",\"node\":{\"id\":\"card-2\",\"component\":\"Card\",\"children\":[]}}]}\n```\nextra noise",
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
        prompt: '在页面底部加一个卡片',
        context: {
          schemaSummary: 'Dashboard page',
          componentSummary: 'Card, Table',
          schemaJson: { id: 'page-1', body: [] },
        },
      },
      context: {
        prompt: '在页面底部加一个卡片',
        document: {
          exists: true,
          summary: 'Dashboard page',
          tree: '[empty]',
          schema: { id: 'page-1', body: [] },
        },
        componentSummary: 'Card, Table',
        conversation: {
          history: [],
          turnCount: 0,
        },
        lastBlockIds: [],
      },
    });

    expect(result.operations[0]).toEqual({
      op: 'schema.insertNode',
      container: 'body',
      node: {
        id: 'card-2',
        component: 'Card',
        children: [],
      },
    });
  });

  it('uses two-phase flow: Phase 1 returns skeleton, Phase 2 generates node with contracts', async () => {
    process.env.AI_PROVIDER = 'openai-compatible';
    process.env.AI_OPENAI_COMPAT_BASE_URL = 'https://example.test/v1';
    process.env.AI_OPENAI_COMPAT_API_KEY = 'test-key';
    process.env.AI_BLOCK_MODEL = 'mock-model';

    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) {
        // Phase 1: planner returns skeleton with description + components
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                explanation: '修改标题并插入按钮。',
                operations: [
                  {
                    op: 'schema.patchProps',
                    nodeId: 'card-1',
                    patch: { title: '新标题' },
                  },
                  {
                    op: 'schema.insertNode',
                    parentId: 'card-1',
                    index: 0,
                    description: '插入一个主要操作按钮',
                    components: ['Button'],
                  },
                ],
              }),
            },
          }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // Phase 2: returns generated node
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              node: {
                id: 'add-btn',
                component: 'Button',
                props: { type: 'primary' },
                children: ['新增'],
              },
            }),
          },
        }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { executeModifySchema } = await import('./modify-schema.ts');
    const result = await executeModifySchema({
      request: {
        prompt: '改标题并加按钮',
        selectedNodeId: 'card-1',
        context: {
          schemaSummary: 'Dashboard page',
          componentSummary: '',
          schemaJson: { id: 'page-1', body: [{ id: 'card-1', component: 'Card', children: [] }] },
        },
      },
      context: {
        prompt: '改标题并加按钮',
        selectedNodeId: 'card-1',
        document: {
          exists: true,
          summary: 'Dashboard page',
          tree: 'Card#card-1',
          schema: { id: 'page-1', body: [{ id: 'card-1', component: 'Card', children: [] }] },
        },
        componentSummary: '',
        conversation: { history: [], turnCount: 0 },
        lastBlockIds: [],
      },
    });

    // Should have made 2 fetch calls: Phase 1 + Phase 2
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Operations should be in correct order
    expect(result.operations).toHaveLength(2);
    expect(result.operations[0]).toEqual({
      op: 'schema.patchProps',
      nodeId: 'card-1',
      patch: { title: '新标题' },
    });
    expect(result.operations[1]).toMatchObject({
      op: 'schema.insertNode',
      parentId: 'card-1',
      index: 0,
      node: {
        id: 'add-btn',
        component: 'Button',
        props: { type: 'primary' },
        children: ['新增'],
      },
    });
  });

  it('fast path: patchProps-only plan makes exactly one fetch call', async () => {
    process.env.AI_PROVIDER = 'openai-compatible';
    process.env.AI_OPENAI_COMPAT_BASE_URL = 'https://example.test/v1';
    process.env.AI_OPENAI_COMPAT_API_KEY = 'test-key';
    process.env.AI_BLOCK_MODEL = 'mock-model';

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            explanation: '修改标题。',
            operations: [{
              op: 'schema.patchProps',
              nodeId: 'card-1',
              patch: { title: '新标题' },
            }],
          }),
        },
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { executeModifySchema } = await import('./modify-schema.ts');
    const result = await executeModifySchema({
      request: {
        prompt: '改标题',
        context: {
          schemaSummary: 'Page',
          componentSummary: '',
          schemaJson: { id: 'page-1', body: [] },
        },
      },
      context: {
        prompt: '改标题',
        document: { exists: true, summary: 'Page', tree: 'Card#card-1', schema: { id: 'page-1', body: [] } },
        componentSummary: '',
        conversation: { history: [], turnCount: 0 },
        lastBlockIds: [],
      },
    });

    // Only one fetch call (Phase 1 only, fast path)
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.operations).toHaveLength(1);
    expect(result.operations[0]).toEqual({
      op: 'schema.patchProps',
      nodeId: 'card-1',
      patch: { title: '新标题' },
    });
  });
});
