import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor } from '@shenbi/editor-core';
import type { PluginPersistenceService } from '@shenbi/editor-plugin-api';
import type { PageSchema } from '@shenbi/schema';
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
import { useAgentLoop } from './useAgentLoop';

function createSchema(id: string, name = id): PageSchema {
  return {
    id,
    name,
    body: [],
  };
}

interface TestFileMetadata {
  id: string;
  name: string;
  updatedAt: number;
}

interface TestFileStorageAdapter {
  list(): Promise<TestFileMetadata[]>;
  read(fileId: string): Promise<PageSchema>;
  write(fileId: string, schema: PageSchema): Promise<void>;
  saveAs(name: string, schema: PageSchema): Promise<string>;
  delete(fileId: string): Promise<void>;
}

function createMemoryStorage(initialFiles: Record<string, PageSchema>): TestFileStorageAdapter & { files: Map<string, PageSchema> } {
  const files = new Map<string, PageSchema>(Object.entries(initialFiles));
  return {
    files,
    async list(): Promise<TestFileMetadata[]> {
      return Array.from(files.entries()).map(([id, schema]) => ({
        id,
        name: schema.name ?? id,
        updatedAt: Date.now(),
      }));
    },
    async read(fileId: string): Promise<PageSchema> {
      const schema = files.get(fileId);
      if (!schema) {
        throw new Error(`missing file: ${fileId}`);
      }
      return schema;
    },
    async write(fileId: string, schema: PageSchema): Promise<void> {
      files.set(fileId, schema);
    },
    async saveAs(name: string, schema: PageSchema): Promise<string> {
      const nextId = `${name}-${files.size + 1}`;
      files.set(nextId, schema);
      return nextId;
    },
    async delete(fileId: string): Promise<void> {
      files.delete(fileId);
    },
  };
}

function createBridge(initialFiles: Record<string, PageSchema> = { current: createSchema('current', 'Current Page') }) {
  const fileStorage = createMemoryStorage(initialFiles);
  const editor = createEditor({
    initialSchema: initialFiles.current ?? createSchema('current', 'Current Page'),
    fileStorage,
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
    fileStorage,
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
    const { bridge, commandLog, fileStorage } = createBridge();
    const persistence = createPersistence();
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
    expect(result.current.lastRunResult?.agentLoop).toMatchObject({
      projectPlan: {
        projectName: '客服中台',
      },
      createdFileIds: ['dashboard'],
    });
    expect(result.current.pages).toMatchObject([
      {
        pageId: 'dashboard',
        pageName: '客服看板',
        status: 'done',
        fileId: 'dashboard',
      },
    ]);
    expect(client.runRequests[0]).toMatchObject({
      plannerModel: 'planner-model',
      blockModel: 'block-model',
      intent: 'schema.create',
    });
    expect(fileStorage.files.get('dashboard')).toMatchObject({
      name: '客服看板',
    });
    expect(commandLog.map((entry) => entry.commandId)).toContain('file.writeSchema');
    expect(commandLog.map((entry) => entry.commandId)).toContain('file.openSchema');
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
            blocks: [],
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

  it('writes a debug dump when ReAct parsing fails', async () => {
    const { bridge } = createBridge();
    const persistence = createPersistence();
    const client = new LoopScenarioAIClient([
      {
        content: '我先分析一下需求，然后给出项目规划。',
      },
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
});
