import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TabManager, createEditor } from '@shenbi/editor-core';
import type { PluginPersistenceService } from '@shenbi/editor-plugin-api';
import type { PageSchema } from '@shenbi/schema';
import type { VirtualFileSystemAdapter } from '@shenbi/editor-core/src/adapters/virtual-fs';
import { resetAIClient, setAIClient } from '../ai/sse-client';
import type {
  AIClient,
  AgentEvent,
  ChatRequest,
  ChatResponse,
  FinalizeRequest,
  FinalizeResult,
  ProjectPlan,
  RunRequest,
  RunStreamOptions,
} from '../ai/api-types';
import type { EditorAIBridge } from '../ai/editor-ai-bridge';
import { buildExecutionFallbackAction, useAgentLoop } from './useAgentLoop';

function createSchema(id: string, name = id): PageSchema {
  return {
    id,
    name,
    body: [],
  };
}

function createMemoryVFS(initialFiles: Record<string, PageSchema>): VirtualFileSystemAdapter & { files: Map<string, PageSchema> } {
  const files = new Map<string, PageSchema>(Object.entries(initialFiles));
  const nodes = new Map(Array.from(files.entries()).map(([id, schema]) => [
    id,
    {
      id,
      name: schema.name ?? id,
      type: 'file' as const,
      fileType: 'page' as const,
      parentId: null,
      path: `/${id}.page.json`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      size: JSON.stringify(schema).length,
    },
  ]));

  return {
    files,
    async initialize() {
      return undefined;
    },
    async listTree() {
      return Array.from(nodes.values());
    },
    async createFile(_projectId, parentId, name, fileType, content) {
      const id = `file-${name}-${nodes.size + 1}`;
      const node = {
        id,
        name,
        type: 'file' as const,
        fileType,
        parentId,
        path: `/${name}.page.json`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: JSON.stringify(content).length,
      };
      nodes.set(id, node);
      files.set(id, content as PageSchema);
      return node;
    },
    async readFile(_projectId, fileId) {
      const schema = files.get(fileId);
      if (!schema) {
        throw new Error(`missing file: ${fileId}`);
      }
      return schema;
    },
    async writeFile(_projectId, fileId, schema) {
      if (!files.has(fileId)) {
        throw new Error(`missing file: ${fileId}`);
      }
      files.set(fileId, schema);
      const node = nodes.get(fileId);
      if (node) {
        node.updatedAt = Date.now();
        node.size = JSON.stringify(schema).length;
      }
    },
    async deleteFile(_projectId, fileId) {
      files.delete(fileId);
      nodes.delete(fileId);
    },
    async createDirectory() {
      throw new Error('not implemented');
    },
    async deleteDirectory() {
      throw new Error('not implemented');
    },
    async rename() {
      throw new Error('not implemented');
    },
    async move() {
      throw new Error('not implemented');
    },
    async getNode(_projectId, nodeId) {
      return nodes.get(nodeId);
    },
    async getNodeByPath() {
      return undefined;
    },
  };
}

function createBridge(initialFiles: Record<string, PageSchema> = { current: createSchema('current', 'Current Page') }) {
  const vfs = createMemoryVFS(initialFiles);
  const tabManager = new TabManager();
  const editor = createEditor({
    initialSchema: initialFiles.current ?? createSchema('current', 'Current Page'),
    vfs,
    tabManager,
    projectId: 'test-project',
  });
  const commandLog: Array<{ commandId: string; args?: unknown }> = [];

  const bridge: EditorAIBridge = {
    getSchema: () => editor.state.getSchema(),
    getSelectedNodeId: () => undefined,
    getAvailableComponents: () => [],
    execute: async (commandId, args) => {
      commandLog.push({ commandId, args });
      try {
        const data = await editor.commands.execute(commandId, args);
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    replaceSchema: (schema) => {
      void editor.commands.execute('schema.replace', { schema });
    },
    appendBlock: async (node, parentTreeId) => bridge.execute('node.append', { node, parentTreeId }),
    removeNode: async (treeId) => bridge.execute('node.remove', { treeId }),
    subscribe: () => () => undefined,
  };

  return {
    bridge,
    commandLog,
    fileStorage: vfs,
    tabManager,
  };
}

function createPersistence(initialValues: Record<string, unknown> = {}): PluginPersistenceService & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>(Object.entries(initialValues));
  return {
    store,
    getJSON: vi.fn(async (namespace: string, key: string) => store.get(`${namespace}:${key}`)),
    setJSON: vi.fn(async (namespace: string, key: string, value: unknown) => {
      store.set(`${namespace}:${key}`, value);
    }),
    remove: vi.fn(async (namespace: string, key: string) => {
      store.delete(`${namespace}:${key}`);
    }),
  };
}

class LoopScenarioAIClient implements AIClient {
  readonly chatRequests: ChatRequest[] = [];
  readonly runRequests: RunRequest[] = [];
  readonly finalizeRequests: FinalizeRequest[] = [];

  constructor(
    private readonly chatResponses: ChatResponse[],
    private readonly createEvents: AgentEvent[],
  ) {}

  async *runStream(request: RunRequest, _options: RunStreamOptions = {}): AsyncIterable<AgentEvent> {
    this.runRequests.push(request);
    for (const event of this.createEvents) {
      yield event;
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.chatRequests.push(request);
    const next = this.chatResponses.shift();
    if (!next) {
      throw new Error('No chat response configured');
    }
    return next;
  }

  async *chatStream(_request: ChatRequest, _options: RunStreamOptions = {}): AsyncIterable<{ delta: string }> {
    yield { delta: '' };
  }

  async finalize(request: FinalizeRequest): Promise<FinalizeResult> {
    this.finalizeRequests.push(request);
    return {};
  }
}

afterEach(() => {
  resetAIClient();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useAgentLoop', () => {
  it('plans a project, waits for confirmation, creates a page in background, and completes with loop summary', async () => {
    const { bridge, commandLog, fileStorage, tabManager } = createBridge();
    const persistence = createPersistence();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: {
        traceFile: '.ai-debug/traces/2026-03-16T00-00-00-000Z-success.json',
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new LoopScenarioAIClient([
      {
        content: [
          'Status: 正在拆解项目页面',
          'Action: proposeProjectPlan',
          `Action Input: ${JSON.stringify({
            projectName: '客服中台',
            pages: [
              {
                pageId: 'dashboard',
                pageName: '客服看板',
                action: 'create',
                description: '展示客服工作量、会话趋势和工单状态',
              },
            ],
          })}`,
        ].join('\n'),
      },
      {
        content: [
          'Reasoning Summary: 先生成项目首页',
          'Action: createPage',
          `Action Input: ${JSON.stringify({
            pageId: 'dashboard',
            pageName: '客服看板',
            prompt: '生成一个客服看板页面，包含统计卡、趋势图和工单表格。',
          })}`,
        ].join('\n'),
      },
      {
        content: 'Action: finish\nAction Input: {"summary":"项目完成"}',
      },
    ], [
      {
        type: 'plan',
        data: {
          pageTitle: '客服看板',
          pageType: 'dashboard',
          blocks: [
            {
              id: 'hero',
              description: '核心统计区',
              components: ['Card', 'Statistic'],
              priority: 1,
              complexity: 'simple',
            },
          ],
        },
      },
      {
        type: 'schema:skeleton',
        data: {
          schema: {
            id: 'dashboard',
            name: '客服看板',
            body: [
              {
                id: 'hero-skeleton',
                component: 'Container',
                children: [],
              },
            ],
          },
        },
      },
      {
        type: 'schema:block:start',
        data: {
          blockId: 'hero',
          description: '核心统计区',
        },
      },
      {
        type: 'schema:block',
        data: {
          blockId: 'hero',
          node: {
            id: 'hero',
            component: 'Card',
            props: {
              title: '客服看板',
            },
          },
          durationMs: 12,
        },
      },
      {
        type: 'schema:done',
        data: {
          schema: {
            id: 'dashboard',
            name: '客服看板',
            body: [
              {
                id: 'hero',
                component: 'Card',
                props: {
                  title: '客服看板',
                },
              },
            ],
          },
        },
      },
      {
        type: 'done',
        data: {
          metadata: {
            sessionId: 'session-loop',
            conversationId: 'conv-loop',
            durationMs: 123,
          },
        },
      },
    ]);
    setAIClient(client);
    const onDone = vi.fn();
    const onError = vi.fn();
    const onRunComplete = vi.fn();

    const { result } = renderHook(() => useAgentLoop(bridge, persistence));

    let runPromise!: Promise<void>;
    await act(async () => {
      runPromise = result.current.runAgent(
        '请帮我创建一个客服项目，至少包含一个工作台页面',
        'planner-model',
        'block-model',
        false,
        'conv-loop',
        () => 'message-1',
        vi.fn(),
        onDone,
        onError,
        2,
        onRunComplete,
      );
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('awaiting_confirmation');
      expect(result.current.projectPlan?.projectName).toBe('客服中台');
      expect(result.current.pages).toHaveLength(1);
    });

    const persisted = persistence.store.get('ai-chat:agent-loop-state') as { loopState?: { status?: string } } | undefined;
    expect(persisted?.loopState?.status).toBe('awaiting_confirmation');

    await act(async () => {
      result.current.confirmProjectPlan();
      await runPromise;
    });

    expect(onError).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith({
      sessionId: 'conv-loop',
      conversationId: 'conv-loop',
    });
    expect(onRunComplete).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('done');
    const createdFileId = result.current.lastRunResult?.agentLoop?.createdFileIds[0];
    expect(createdFileId).toBeTruthy();
    expect(result.current.lastRunResult?.agentLoop).toMatchObject({
      projectPlan: {
        projectName: '客服中台',
      },
      traceFile: '.ai-debug/traces/2026-03-16T00-00-00-000Z-success.json',
    });
    expect(result.current.pages).toMatchObject([
      {
        pageId: 'dashboard',
        pageName: '客服看板',
        status: 'done',
        fileId: createdFileId,
        execution: {
          plan: {
            pageTitle: '客服看板',
          },
          blockStatuses: {
            hero: 'done',
          },
        },
      },
    ]);
    expect(result.current.lastRunResult?.debugFile).toBe('.ai-debug/traces/2026-03-16T00-00-00-000Z-success.json');
    expect(client.runRequests[0]).toMatchObject({
      plannerModel: 'planner-model',
      blockModel: 'block-model',
      intent: 'schema.create',
      thinking: { type: 'disabled' },
      blockConcurrency: 2,
    });
    expect(fileStorage.files.get(createdFileId!)).toMatchObject({
      name: '客服看板',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/ai/debug/trace', expect.objectContaining({
      method: 'POST',
    }));
    expect(commandLog[0]?.commandId).toBe('shell.ensureCurrentTab');
    expect(commandLog.map((entry) => entry.commandId)).toContain('file.writeSchema');
    expect(commandLog.map((entry) => entry.commandId)).toContain('tab.open');
    expect(commandLog.filter((entry) => entry.commandId === 'tab.syncState').length).toBeGreaterThanOrEqual(3);
    expect(tabManager.getTab(createdFileId!)).toMatchObject({
      isGenerating: false,
      schema: expect.objectContaining({ name: '客服看板' }),
    });
    expect(persistence.remove).toHaveBeenCalledWith('ai-chat', 'agent-loop-state');
  });

  it('restores awaiting-confirmation loop state from persistence on mount', async () => {
    const projectPlan: ProjectPlan = {
      projectName: '已恢复项目',
      pages: [
        {
          pageId: 'summary',
          pageName: '概览页',
          action: 'create',
          description: '概览页描述',
        },
      ],
    };
    const persistence = createPersistence({
      'ai-chat:agent-loop-state': {
        loopState: {
          conversationId: 'conv-restored',
          status: 'awaiting_confirmation',
          approvedPlan: projectPlan,
          createdFileIds: [],
          completedPageIds: [],
          failedPageIds: [],
          updatedAt: '2026-03-16T00:00:00.000Z',
        },
        reactMessages: [
          { role: 'system', content: 'system' },
          { role: 'user', content: '请继续' },
        ],
        projectPlan,
        trace: [],
        pages: [
          {
            pageId: 'summary',
            pageName: '概览页',
            action: 'create',
            description: '概览页描述',
            status: 'waiting',
          },
        ],
        createdFileIds: [],
      },
    });

    const { result } = renderHook(() => useAgentLoop(createBridge().bridge, persistence));

    await waitFor(() => {
      expect(result.current.mode).toBe('loop');
      expect(result.current.phase).toBe('awaiting_confirmation');
      expect(result.current.projectPlan?.projectName).toBe('已恢复项目');
      expect(result.current.pages).toHaveLength(1);
    });
  });

  it('repairs a reasoning-only loop response by asking the model to reissue a valid action', async () => {
    const { bridge } = createBridge();
    const persistence = createPersistence();
    const onDone = vi.fn();
    const onError = vi.fn();
    const client = new LoopScenarioAIClient([
      {
        content: 'Action: listWorkspaceFiles\nAction Input: {}',
      },
      {
        content: JSON.stringify({
          reasoning: '工作区为空，现在需要提出项目计划。',
        }, null, 2),
      },
      {
        content: [
          'Action: proposeProjectPlan',
          `Action Input: ${JSON.stringify({
            projectName: '订单管理后台',
            pages: [
              {
                pageId: 'order-list',
                pageName: '订单列表页',
                action: 'create',
                description: '展示订单列表、筛选和分页',
              },
            ],
          })}`,
        ].join('\n'),
      },
      {
        content: 'Action: finish\nAction Input: {"summary":"项目完成"}',
      },
    ], []);
    setAIClient(client);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: {
        traceFile: '.ai-debug/traces/2026-03-16T00-00-00-000Z-success.json',
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    const { result } = renderHook(() => useAgentLoop(bridge, persistence));

    let runPromise!: Promise<void>;
    await act(async () => {
      runPromise = result.current.runAgent(
        '帮我做一个订单管理后台项目，包含列表页、详情页、创建页',
        'planner-model',
        'block-model',
        false,
        'conv-repair',
        () => 'message-repair',
        vi.fn(),
        onDone,
        onError,
      );
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('awaiting_confirmation');
      expect(result.current.projectPlan?.projectName).toBe('订单管理后台');
    });

    await act(async () => {
      result.current.confirmProjectPlan();
      await runPromise;
    });

    expect(onError).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith({
      sessionId: 'conv-repair',
      conversationId: 'conv-repair',
    });
    expect(client.chatRequests).toHaveLength(4);
    expect(client.chatRequests[2]?.messages.at(-1)).toMatchObject({
      role: 'user',
      content: expect.stringContaining('格式错误'),
    });
  });

  it('normalizes parsed assistant actions before sending the next loop turn', async () => {
    const { bridge } = createBridge();
    const persistence = createPersistence();
    const client = new LoopScenarioAIClient([
      {
        content: JSON.stringify({
          reasoning: '先查看工作区文件。',
          action: 'listWorkspaceFiles',
          action_input: {},
        }, null, 2),
      },
      {
        content: [
          'Action: proposeProjectPlan',
          `Action Input: ${JSON.stringify({
            projectName: '订单管理后台',
            pages: [
              {
                pageId: 'order-list',
                pageName: '订单列表页',
                action: 'create',
                description: '展示订单列表、筛选和分页',
              },
            ],
          })}`,
        ].join('\n'),
      },
      {
        content: 'Action: finish\nAction Input: {"summary":"项目完成"}',
      },
    ], []);
    setAIClient(client);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: {
        traceFile: '.ai-debug/traces/2026-03-16T00-00-00-000Z-success.json',
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    const { result } = renderHook(() => useAgentLoop(bridge, persistence));

    let runPromise!: Promise<void>;
    await act(async () => {
      runPromise = result.current.runAgent(
        '帮我做一个订单管理后台项目，包含列表页、详情页、创建页',
        'planner-model',
        'block-model',
        false,
        'conv-normalized-history',
        () => 'message-normalized-history',
        vi.fn(),
        vi.fn(),
        vi.fn(),
      );
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('awaiting_confirmation');
    });

    expect(client.chatRequests[1]?.messages.at(-2)).toMatchObject({
      role: 'assistant',
      content: JSON.stringify({ action: 'listWorkspaceFiles', actionInput: {} }),
    });

    await act(async () => {
      result.current.confirmProjectPlan();
      await runPromise;
    });
  });

  it('falls back to the approved plan when execution-phase model replies are malformed', () => {
    const fallbackCreate = buildExecutionFallbackAction({
      conversationId: 'conv-fallback',
      status: 'executing',
      createdFileIds: ['订单列表页'],
      completedPageIds: ['order-list'],
      failedPageIds: [],
      updatedAt: '2026-03-16T00:00:00.000Z',
      approvedPlan: {
        projectName: '订单管理后台',
        pages: [
          {
            pageId: 'order-list',
            pageName: '订单列表页',
            action: 'create',
            description: '展示订单列表、筛选和分页',
          },
          {
            pageId: 'order-detail',
            pageName: '订单详情页',
            action: 'create',
            description: '展示订单详情和商品信息',
          },
        ],
      },
    }, [
      {
        pageId: 'order-list',
        pageName: '订单列表页',
        action: 'create',
        description: '展示订单列表、筛选和分页',
        status: 'done',
        fileId: '订单列表页',
      },
      {
        pageId: 'order-detail',
        pageName: '订单详情页',
        action: 'create',
        description: '展示订单详情和商品信息',
        status: 'waiting',
      },
    ]);

    expect(fallbackCreate).toEqual({
      reasoningSummary: '按已确认规划继续执行下一页',
      action: 'createPage',
      actionInput: {
        pageId: 'order-detail',
        pageName: '订单详情页',
        description: '展示订单详情和商品信息',
      },
      rawActionInput: '{"pageId":"order-detail","pageName":"订单详情页","description":"展示订单详情和商品信息"}',
    });

    const fallbackFinish = buildExecutionFallbackAction({
      conversationId: 'conv-fallback',
      status: 'executing',
      createdFileIds: ['订单列表页', '订单详情页'],
      completedPageIds: ['order-list', 'order-detail'],
      failedPageIds: [],
      updatedAt: '2026-03-16T00:00:00.000Z',
      approvedPlan: {
        projectName: '订单管理后台',
        pages: [],
      },
    }, [
      {
        pageId: 'order-list',
        pageName: '订单列表页',
        action: 'create',
        description: '展示订单列表、筛选和分页',
        status: 'done',
        fileId: '订单列表页',
      },
      {
        pageId: 'order-detail',
        pageName: '订单详情页',
        action: 'create',
        description: '展示订单详情和商品信息',
        status: 'done',
        fileId: '订单详情页',
      },
    ]);

    expect(fallbackFinish).toEqual({
      reasoningSummary: '所有计划页面已完成，结束本轮项目执行',
      action: 'finish',
      actionInput: {
        summary: '项目执行完成',
      },
      rawActionInput: '{"summary":"项目执行完成"}',
    });
  });

  it('writes a debug dump when ReAct parsing fails', async () => {
    const { bridge } = createBridge();
    const persistence = createPersistence();
    const client = new LoopScenarioAIClient([
      { content: '-1.0' },
      { content: '-1.0' },
    ], []);
    setAIClient(client);
    const onError = vi.fn();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: {
        debugFile: '.ai-debug/errors/2026-03-16T00-00-00-000Z-client-debug.json',
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAgentLoop(bridge, persistence));

    await act(async () => {
      await result.current.runAgent(
        '帮我做一个订单管理后台项目，包含列表页、详情页、创建页',
        'planner-model',
        'block-model',
        false,
        'conv-parse-failure',
        () => 'message-parse-failure',
        vi.fn(),
        vi.fn(),
        onError,
      );
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/ai/debug/client-error', expect.objectContaining({
      method: 'POST',
    }));
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining('.ai-debug/errors/2026-03-16T00-00-00-000Z-client-debug.json'),
    );
    expect(result.current.phase).toBe('error');
  });

  it('model responds with valid JSON object from the start', async () => {
    const { bridge } = createBridge();
    const persistence = createPersistence();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: { traceFile: '.ai-debug/traces/json-success.json' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    // With JSON protocol, the model returns JSON objects directly
    const client = new LoopScenarioAIClient([
      // Turn 1: valid JSON → listWorkspaceFiles
      { content: '{"action":"listWorkspaceFiles","actionInput":{}}' },
      // Turn 2: valid JSON → proposeProjectPlan
      {
        content: JSON.stringify({
          reasoningSummary: '根据用户需求规划项目',
          action: 'proposeProjectPlan',
          actionInput: {
            projectName: '订单管理后台',
            pages: [
              { pageId: 'order-list', pageName: '订单列表页', action: 'create', description: '展示订单列表' },
              { pageId: 'order-detail', pageName: '订单详情页', action: 'create', description: '展示订单详情' },
              { pageId: 'order-create', pageName: '创建订单页', action: 'create', description: '创建订单表单' },
            ],
          },
        }),
      },
      // Turn 3 (after confirm): createPage
      {
        content: JSON.stringify({
          action: 'createPage',
          actionInput: { pageId: 'order-list', pageName: '订单列表页', description: '展示订单列表' },
        }),
      },
      // Turn 4: finish
      { content: '{"action":"finish","actionInput":{"summary":"项目完成"}}' },
    ], [
      {
        type: 'schema:done',
        data: {
          schema: {
            id: 'order-list',
            name: '订单列表页',
            body: [{ id: 'table', component: 'Table', props: { title: '订单列表' } }],
          },
        },
      },
      {
        type: 'done',
        data: {
          metadata: { sessionId: 's', conversationId: 'c', durationMs: 100 },
        },
      },
    ]);
    setAIClient(client);

    const onDone = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() => useAgentLoop(bridge, persistence));

    let runPromise!: Promise<void>;
    await act(async () => {
      runPromise = result.current.runAgent(
        '帮我做一个订单管理后台项目，包含列表页、详情页、创建页',
        'planner-model',
        'block-model',
        false,
        'conv-json-protocol',
        () => 'msg-1',
        vi.fn(),
        onDone,
        onError,
        2,
      );
    });

    // After listWorkspaceFiles and proposeProjectPlan, waiting for confirmation
    await waitFor(() => {
      expect(result.current.phase).toBe('awaiting_confirmation');
      expect(result.current.projectPlan).toBeTruthy();
      expect(result.current.projectPlan!.pages).toHaveLength(3);
    });

    // Confirm and let the loop finish
    await act(async () => {
      result.current.confirmProjectPlan();
      await runPromise;
    });

    expect(onError).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
    expect(result.current.phase).toBe('done');
  });

  it('surfaces fs.createFile failures before writing schema', async () => {
    const { bridge: baseBridge } = createBridge();
    const bridge: EditorAIBridge = {
      ...baseBridge,
      execute: async (commandId, args) => {
        if (commandId === 'fs.createFile') {
          return { success: false, error: 'fs.createFile unavailable' };
        }
        return baseBridge.execute(commandId, args);
      },
    };
    const persistence = createPersistence();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: { traceFile: '.ai-debug/traces/create-file-error.json' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new LoopScenarioAIClient([
      {
        content: JSON.stringify({
          action: 'proposeProjectPlan',
          actionInput: {
            projectName: '订单管理后台',
            pages: [
              { pageId: 'order-list', pageName: '订单列表页', action: 'create', description: '展示订单列表' },
            ],
          },
        }),
      },
      {
        content: JSON.stringify({
          action: 'createPage',
          actionInput: { pageId: 'order-list', pageName: '订单列表页', description: '展示订单列表' },
        }),
      },
    ], []);
    setAIClient(client);

    const onDone = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useAgentLoop(bridge, persistence));

    let runPromise!: Promise<void>;
    await act(async () => {
      runPromise = result.current.runAgent(
        '帮我做一个订单管理后台项目，包含列表页',
        'planner-model',
        'block-model',
        false,
        'conv-create-file-error',
        () => 'msg-create-file-error',
        vi.fn(),
        onDone,
        onError,
      );
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('awaiting_confirmation');
      expect(result.current.projectPlan?.pages).toHaveLength(1);
    });

    await act(async () => {
      result.current.confirmProjectPlan();
      await runPromise;
    });

    expect(onDone).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('fs.createFile unavailable'));
  });
});
