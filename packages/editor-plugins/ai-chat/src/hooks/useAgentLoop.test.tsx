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
  ClassifyRouteRequest,
  ClassifyRouteResponse,
  FinalizeRequest,
  FinalizeResult,
  ProjectAgentEvent,
  ProjectCancelRequest,
  ProjectConfirmRequest,
  ProjectPlan,
  ProjectReviseRequest,
  ProjectRunRequest,
  ProjectSessionMutationResult,
  RunRequest,
  RunStreamOptions,
} from '../ai/api-types';
import type { EditorAIBridge } from '../ai/editor-ai-bridge';
import { useAgentLoop } from './useAgentLoop';

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

type ProjectControl =
  | { type: 'confirm' }
  | { type: 'revise'; prompt: string }
  | { type: 'cancel' };

class ProjectScenarioAIClient implements AIClient {
  readonly projectRequests: ProjectRunRequest[] = [];
  readonly confirmRequests: ProjectConfirmRequest[] = [];
  readonly reviseRequests: ProjectReviseRequest[] = [];
  readonly cancelRequests: ProjectCancelRequest[] = [];

  private readonly controls: ProjectControl[] = [];
  private readonly waiters: Array<(control: ProjectControl) => void> = [];

  constructor(
    private readonly script: (client: ProjectScenarioAIClient, request: ProjectRunRequest) => AsyncIterable<ProjectAgentEvent>,
  ) {}

  private nextControl(): Promise<ProjectControl> {
    const control = this.controls.shift();
    if (control) {
      return Promise.resolve(control);
    }
    return new Promise<ProjectControl>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  private pushControl(control: ProjectControl): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(control);
      return;
    }
    this.controls.push(control);
  }

  async *runStream(_request: RunRequest, _options: RunStreamOptions = {}): AsyncIterable<AgentEvent> {
    throw new Error('ProjectScenarioAIClient does not use runStream directly');
  }

  async chat(_request: ChatRequest): Promise<ChatResponse> {
    throw new Error('ProjectScenarioAIClient does not use chat directly');
  }

  async *chatStream(_request: ChatRequest): AsyncIterable<{ delta: string }> {
    throw new Error('ProjectScenarioAIClient does not use chatStream directly');
  }

  async finalize(_request: FinalizeRequest): Promise<FinalizeResult> {
    return {};
  }

  async classifyRoute(_request: ClassifyRouteRequest): Promise<ClassifyRouteResponse> {
    return { scope: 'multi-page', intent: 'schema.create', confidence: 0.95 };
  }

  async *projectStream(request: ProjectRunRequest): AsyncIterable<ProjectAgentEvent> {
    this.projectRequests.push(request);
    yield* this.script(this, request);
  }

  async projectConfirm(request: ProjectConfirmRequest): Promise<ProjectSessionMutationResult> {
    this.confirmRequests.push(request);
    this.pushControl({ type: 'confirm' });
    return { sessionId: request.sessionId, status: 'executing' };
  }

  async projectRevise(request: ProjectReviseRequest): Promise<ProjectSessionMutationResult> {
    this.reviseRequests.push(request);
    this.pushControl({ type: 'revise', prompt: request.revisionPrompt });
    return { sessionId: request.sessionId, status: 'awaiting_confirmation' };
  }

  async projectCancel(request: ProjectCancelRequest): Promise<ProjectSessionMutationResult> {
    this.cancelRequests.push(request);
    this.pushControl({ type: 'cancel' });
    return { sessionId: request.sessionId, status: 'cancelled' };
  }

  waitForControl(): Promise<ProjectControl> {
    return this.nextControl();
  }
}

function createProjectCreateEvents(): AgentEvent[] {
  return [
    { type: 'run:start', data: { sessionId: 'session-create', conversationId: 'conv-create' } },
    { type: 'intent', data: { intent: 'schema.create', confidence: 1, scope: 'single-page' } },
    {
      type: 'plan',
      data: {
        pageTitle: '客服看板',
        pageType: 'dashboard',
        blocks: [{
          id: 'hero',
          description: '核心统计区',
          components: ['Card', 'Statistic'],
          priority: 1,
          complexity: 'simple',
        }],
      },
    },
    {
      type: 'schema:skeleton',
      data: {
        schema: {
          id: 'dashboard',
          name: '客服看板',
          body: [{ id: 'hero-skeleton', component: 'Container', children: [] }],
        },
      },
    },
    { type: 'schema:block:start', data: { blockId: 'hero', description: '核心统计区' } },
    {
      type: 'schema:block',
      data: {
        blockId: 'hero',
        node: {
          id: 'hero',
          component: 'Card',
          props: { title: '客服看板' },
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
          body: [{
            id: 'hero',
            component: 'Card',
            props: { title: '客服看板' },
          }],
        },
      },
    },
    {
      type: 'done',
      data: {
        metadata: {
          sessionId: 'session-create',
          conversationId: 'conv-create',
          durationMs: 123,
        },
      },
    },
  ];
}

function createProjectModifyEvents(): AgentEvent[] {
  return [
    { type: 'run:start', data: { sessionId: 'session-modify', conversationId: 'conv-modify' } },
    { type: 'intent', data: { intent: 'schema.modify', confidence: 1, scope: 'single-page' } },
    {
      type: 'modify:start',
      data: {
        operationCount: 1,
        explanation: '已更新详情标题',
        operations: [{ op: 'schema.patchProps', nodeId: 'detail-card' }],
      },
    },
    {
      type: 'modify:op:pending',
      data: {
        index: 0,
        label: '更新 detail-card 标题',
      },
    },
    {
      type: 'modify:op',
      data: {
        index: 0,
        operation: {
          op: 'schema.patchProps',
          nodeId: 'detail-card',
          patch: { title: '订单状态总览' },
        },
      },
    },
    { type: 'modify:done', data: {} },
    {
      type: 'done',
      data: {
        metadata: {
          sessionId: 'session-modify',
          conversationId: 'conv-modify',
          durationMs: 88,
        },
      },
    },
  ];
}

afterEach(() => {
  resetAIClient();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useAgentLoop', () => {
  it('consumes backend project stream, waits for confirmation, and completes a create page flow', async () => {
    const { bridge, fileStorage } = createBridge();
    const persistence = createPersistence();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: {
        traceFile: '.ai-debug/traces/project-success.json',
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    const client = new ProjectScenarioAIClient(async function* (api) {
      const sessionId = 'project-session-1';
      const plan: ProjectPlan = {
        projectName: '客服中台',
        pages: [{
          pageId: 'dashboard',
          pageName: '客服看板',
          action: 'create',
          description: '展示客服工作量和趋势',
          prompt: '生成客服看板，包含统计卡和趋势图。',
        }],
      };
      yield { type: 'project:start', data: { sessionId, conversationId: 'conv-loop', prompt: '创建客服项目' } };
      yield { type: 'project:plan', data: { sessionId, plan } };
      yield { type: 'project:awaiting_confirmation', data: { sessionId, plan } };
      const control = await api.waitForControl();
      expect(control).toEqual({ type: 'confirm' });
      const page = plan.pages[0]!;
      yield { type: 'project:page:start', data: { sessionId, index: 0, total: 1, page } };
      for (const event of createProjectCreateEvents()) {
        yield { type: 'project:page:event', data: { sessionId, pageId: page.pageId, event } };
      }
      yield { type: 'project:page:done', data: { sessionId, pageId: page.pageId } };
      yield { type: 'project:done', data: { sessionId, createdFileIds: ['dashboard'], completedPageIds: ['dashboard'] } };
    });
    setAIClient(client);

    const onDone = vi.fn();
    const onError = vi.fn();
    const onRunComplete = vi.fn();
    const { result } = renderHook(() => useAgentLoop(bridge, persistence));

    let runPromise!: Promise<void>;
    await act(async () => {
      runPromise = result.current.runAgent(
        '请帮我创建一个客服项目',
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

    await act(async () => {
      result.current.confirmProjectPlan();
      await runPromise;
    });

    expect(onError).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith({
      sessionId: 'project-session-1',
      conversationId: 'conv-loop',
    });
    expect(result.current.phase).toBe('done');
    expect(result.current.pages[0]).toMatchObject({
      pageId: 'dashboard',
      status: 'done',
      execution: {
        plan: {
          pageTitle: '客服看板',
        },
      },
    });
    const createdFileId = result.current.pages[0]?.fileId;
    expect(createdFileId).toBeTruthy();
    expect(fileStorage.files.get(createdFileId!)).toMatchObject({
      name: '客服看板',
    });
    expect(client.projectRequests[0]?.workspace.files.map((file) => file.fileId)).toContain('current');
    expect(client.confirmRequests).toEqual([{ sessionId: 'project-session-1' }]);
  });

  it('revises backend project plans instead of running a local ReAct repair loop', async () => {
    const { bridge } = createBridge();
    const persistence = createPersistence();
    const client = new ProjectScenarioAIClient(async function* (api) {
      const sessionId = 'project-session-2';
      const initialPlan: ProjectPlan = {
        projectName: '订单管理后台',
        pages: [{
          pageId: 'order-list',
          pageName: '订单列表页',
          action: 'create',
          description: '订单列表',
        }],
      };
      yield { type: 'project:start', data: { sessionId, conversationId: 'conv-revise', prompt: '订单管理项目' } };
      yield { type: 'project:plan', data: { sessionId, plan: initialPlan } };
      yield { type: 'project:awaiting_confirmation', data: { sessionId, plan: initialPlan } };
      const reviseControl = await api.waitForControl();
      expect(reviseControl).toEqual({ type: 'revise', prompt: '增加审批页' });
      const revisedPlan: ProjectPlan = {
        projectName: '订单管理后台-修订版',
        pages: [
          ...initialPlan.pages,
          {
            pageId: 'approval',
            pageName: '审批页',
            action: 'create',
            description: '审批处理页',
          },
        ],
      };
      yield { type: 'project:plan', data: { sessionId, plan: revisedPlan } };
      yield { type: 'project:awaiting_confirmation', data: { sessionId, plan: revisedPlan } };
      const confirmControl = await api.waitForControl();
      expect(confirmControl).toEqual({ type: 'confirm' });
      yield { type: 'project:done', data: { sessionId, createdFileIds: [], completedPageIds: [] } };
    });
    setAIClient(client);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: {
        traceFile: '.ai-debug/traces/project-revised.json',
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    const { result } = renderHook(() => useAgentLoop(bridge, persistence));
    let runPromise!: Promise<void>;

    await act(async () => {
      runPromise = result.current.runAgent(
        '帮我做一个订单管理后台项目',
        'planner-model',
        'block-model',
        false,
        'conv-revise',
        () => 'msg-revise',
        vi.fn(),
        vi.fn(),
        vi.fn(),
      );
    });

    await waitFor(() => {
      expect(result.current.projectPlan?.projectName).toBe('订单管理后台');
    });

    await act(async () => {
      result.current.submitProjectPlanRevision('增加审批页');
    });

    await waitFor(() => {
      expect(result.current.projectPlan?.projectName).toBe('订单管理后台-修订版');
      expect(result.current.pages).toHaveLength(2);
    });

    await act(async () => {
      result.current.confirmProjectPlan();
      await runPromise;
    });

    expect(client.reviseRequests).toEqual([{
      sessionId: 'project-session-2',
      revisionPrompt: '增加审批页',
    }]);
  });

  it('applies modify page project subtasks with backend page events', async () => {
    const { bridge, fileStorage } = createBridge({
      current: createSchema('current', 'Current Page'),
      'order-detail': {
        id: 'order-detail',
        name: '订单详情页',
        body: [{
          id: 'detail-card',
          component: 'Card',
          props: { title: '旧标题' },
        }],
      },
    });
    const persistence = createPersistence();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: {
        traceFile: '.ai-debug/traces/project-modify.json',
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    const client = new ProjectScenarioAIClient(async function* (api) {
      const sessionId = 'project-session-3';
      const plan: ProjectPlan = {
        projectName: '订单项目',
        pages: [{
          pageId: 'order-detail',
          pageName: '订单详情页',
          action: 'modify',
          fileId: 'order-detail',
          description: '补充订单状态信息',
          prompt: '把详情页标题改成订单状态总览',
        }],
      };
      yield { type: 'project:start', data: { sessionId, conversationId: 'conv-modify', prompt: '完善订单项目' } };
      yield { type: 'project:plan', data: { sessionId, plan } };
      yield { type: 'project:awaiting_confirmation', data: { sessionId, plan } };
      const control = await api.waitForControl();
      expect(control).toEqual({ type: 'confirm' });
      const page = plan.pages[0]!;
      yield { type: 'project:page:start', data: { sessionId, index: 0, total: 1, page } };
      for (const event of createProjectModifyEvents()) {
        yield { type: 'project:page:event', data: { sessionId, pageId: page.pageId, event } };
      }
      yield { type: 'project:page:done', data: { sessionId, pageId: page.pageId, fileId: 'order-detail' } };
      yield { type: 'project:done', data: { sessionId, createdFileIds: [], completedPageIds: ['order-detail'] } };
    });
    setAIClient(client);

    const { result } = renderHook(() => useAgentLoop(bridge, persistence));
    let runPromise!: Promise<void>;

    await act(async () => {
      runPromise = result.current.runAgent(
        '帮我完善订单项目',
        'planner-model',
        'block-model',
        false,
        'conv-modify',
        () => 'msg-modify',
        vi.fn(),
        vi.fn(),
        vi.fn(),
      );
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('awaiting_confirmation');
    });

    await act(async () => {
      result.current.confirmProjectPlan();
      await runPromise;
    });

    expect(result.current.pages[0]).toMatchObject({
      pageId: 'order-detail',
      status: 'done',
      execution: {
        modifyPlan: {
          explanation: '已更新详情标题',
        },
      },
    });
    expect(fileStorage.files.get('order-detail')).toMatchObject({
      body: [{
        id: 'detail-card',
        component: 'Card',
        props: { title: '订单状态总览' },
      }],
    });
  });

  it('cancels backend project sessions while waiting for confirmation', async () => {
    const { bridge } = createBridge();
    const persistence = createPersistence();
    const client = new ProjectScenarioAIClient(async function* (_api) {
      const sessionId = 'project-session-4';
      const plan: ProjectPlan = {
        projectName: '内容管理中心',
        pages: [{
          pageId: 'content-list',
          pageName: '内容列表',
          action: 'create',
          description: '内容列表页',
        }],
      };
      yield { type: 'project:start', data: { sessionId, conversationId: 'conv-cancel', prompt: '内容管理中心' } };
      yield { type: 'project:plan', data: { sessionId, plan } };
      yield { type: 'project:awaiting_confirmation', data: { sessionId, plan } };
    });
    setAIClient(client);

    const { result } = renderHook(() => useAgentLoop(bridge, persistence));
    await act(async () => {
      await result.current.runAgent(
        '帮我做一个内容管理中心项目',
        'planner-model',
        'block-model',
        false,
        'conv-cancel',
        () => 'msg-cancel',
        vi.fn(),
        vi.fn(),
        vi.fn(),
      );
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('awaiting_confirmation');
    });

    await act(async () => {
      await result.current.cancelRun();
    });

    expect(client.cancelRequests).toEqual([{ sessionId: 'project-session-4' }]);
  });
});
