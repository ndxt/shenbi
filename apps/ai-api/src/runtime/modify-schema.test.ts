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

    expect(result).toMatchObject({
      explanation: '会更新卡片标题。',
      operations: [
        expect.objectContaining({
          op: 'schema.patchProps',
          nodeId: 'card-1',
          patch: { title: '本月营收' },
        }),
      ],
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  }, 15000);

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

    expect(result.operations[0]).toMatchObject({
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
    expect(result.operations[0]).toMatchObject({
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
    expect(result.operations[0]).toMatchObject({
      op: 'schema.patchProps',
      nodeId: 'card-1',
      patch: { title: '新标题' },
    });
  });

  it('injects focused node context and semantic last-operation summaries into the planner prompt', async () => {
    process.env.AI_PROVIDER = 'openai-compatible';
    process.env.AI_OPENAI_COMPAT_BASE_URL = 'https://example.test/v1';
    process.env.AI_OPENAI_COMPAT_API_KEY = 'test-key';
    process.env.AI_BLOCK_MODEL = 'mock-model';

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            explanation: '修改按钮文案。',
            operations: [{
              op: 'schema.patchProps',
              nodeId: 'add-btn',
              patch: { children: ['立即新增'] },
            }],
          }),
        },
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const schema = {
      id: 'page-1',
      body: [
        {
          id: 'toolbar',
          component: 'Container',
          children: [
            {
              id: 'search-input',
              component: 'Input',
              props: { placeholder: '请输入客户名' },
            },
            {
              id: 'add-btn',
              component: 'Button',
              props: { type: 'primary' },
              children: ['新增订单'],
            },
            {
              id: 'reset-btn',
              component: 'Button',
              children: ['重置'],
            },
          ],
        },
      ],
    } as const;

    const { executeModifySchema } = await import('./modify-schema.ts');
    await executeModifySchema({
      request: {
        prompt: '把这个按钮的文案改一下',
        selectedNodeId: 'body.0.children.1',
        context: {
          schemaSummary: 'Toolbar page',
          componentSummary: 'Input, Button',
          schemaJson: schema,
        },
      },
      context: {
        prompt: '把这个按钮的文案改一下',
        selectedNodeId: 'body.0.children.1',
        document: {
          exists: true,
          summary: 'Toolbar page',
          tree: '[body]\n  Container#toolbar\n    Input#search-input(placeholder="请输入客户名")\n    Button#add-btn(type="primary", text="新增订单")\n    Button#reset-btn(text="重置")',
          schema,
        },
        componentSummary: 'Input, Button',
        conversation: {
          history: [
            {
              role: 'user',
              text: '先加一个按钮',
            },
            {
              role: 'assistant',
              text: '已新增主按钮。',
              meta: {
                operations: [{
                  op: 'schema.insertNode',
                  label: '添加新增按钮',
                  parentId: 'toolbar',
                  node: {
                    id: 'add-btn',
                    component: 'Button',
                    props: { type: 'primary' },
                    children: ['新增订单'],
                  },
                }],
              },
            },
          ],
          turnCount: 1,
          lastOperations: [{
            op: 'schema.insertNode',
            label: '添加新增按钮',
            parentId: 'toolbar',
            node: {
              id: 'add-btn',
              component: 'Button',
              props: { type: 'primary' },
              children: ['新增订单'],
            },
          }],
        },
        lastBlockIds: [],
      },
    });

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(requestBody.messages[0]?.content).toContain('When Focused Node Context is provided');
    expect(requestBody.messages[1]?.content).toContain('Focused Node Context:');
    expect(requestBody.messages[1]?.content).toContain('Resolved focused node: Button#add-btn(type="primary", text="新增订单")');
    expect(requestBody.messages[1]?.content).toContain('Previous: Input#search-input(placeholder="请输入客户名")');
    expect(requestBody.messages[1]?.content).toContain('Next: Button#reset-btn(text="重置")');
    expect(requestBody.messages[1]?.content).toContain('Last Successful Operations Summary:');
    expect(requestBody.messages[1]?.content).toContain('添加新增按钮: 在 节点 toolbar 下插入 Button#add-btn');
    expect(requestBody.messages[1]?.content).toContain('Last Successful Operations Raw JSON (secondary reference):');
  });
});
