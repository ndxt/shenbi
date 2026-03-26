import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PluginContext } from '@shenbi/editor-plugin-api';
import type { EditorAIBridge } from '../ai/editor-ai-bridge';

const useAgentRunState = vi.hoisted(() => ({
  runAgent: vi.fn(),
  cancelRun: vi.fn(),
}));

const useAgentLoopState = vi.hoisted(() => ({
  mode: null as 'legacy' | 'loop' | null,
  phase: 'idle' as 'idle' | 'thinking' | 'awaiting_confirmation' | 'executing' | 'done' | 'error',
  isRunning: false,
  progressText: '',
  elapsedMs: 0,
  projectPlan: null,
  pages: [] as Array<Record<string, unknown>>,
  errorMessage: undefined as string | undefined,
  planRevisionRequested: false,
  legacy: {
    executionSnapshot: null,
    isRunning: false,
    progressText: '',
    elapsedMs: 0,
  },
  runAgent: useAgentRunState.runAgent,
  cancelRun: useAgentRunState.cancelRun,
  resetLoopState: vi.fn(),
  confirmProjectPlan: vi.fn(),
  requestProjectPlanRevision: vi.fn(),
  cancelProjectPlanRevision: vi.fn(),
  submitProjectPlanRevision: vi.fn(),
}));

vi.mock('../hooks/useAgentRun', () => ({
  useAgentRun: () => ({
    isRunning: false,
    progressText: '',
    currentPlan: null,
    blockStatuses: {},
    runAgent: useAgentRunState.runAgent,
    cancelRun: useAgentRunState.cancelRun,
  }),
}));

vi.mock('../hooks/useAgentLoop', () => ({
  useAgentLoop: () => useAgentLoopState,
}));

import { AIPanel } from './AIPanel';

const fetchMock = vi.hoisted(() => vi.fn());

function getLatestPersistenceWrite(
  pluginContext: PluginContext,
  key: 'model-selection' | 'ui' | 'prompt-history' | 'session',
) {
  return [...(pluginContext.persistence?.setJSON.mock.calls ?? [])]
    .reverse()
    .find(([namespace, currentKey]) => namespace === 'ai-chat' && currentKey === key);
}

function createBridge(): EditorAIBridge {
  return {
    getSchema: () => ({ id: 'page', body: [] }),
    getSelectedNodeId: () => undefined,
    getAvailableComponents: () => [],
    execute: vi.fn().mockResolvedValue({ success: true }),
    replaceSchema: vi.fn(),
    appendBlock: vi.fn().mockResolvedValue({ success: true }),
    removeNode: vi.fn().mockResolvedValue({ success: true }),
    subscribe: () => () => undefined,
  };
}

function createPersistenceStateContext(): PluginContext {
  const persistedState = new Map<string, unknown>([
    ['ai-chat:model-selection', { plannerModel: 'GLM-4.6', blockModel: 'openai-compatible::GLM-4.7' }],
    ['ai-chat:ui', { thinkingEnabled: true, draftText: '已保存草稿' }],
    ['ai-chat:prompt-history', ['历史提示词']],
    ['ai-chat:session', {
      messages: [
        {
          id: 'msg-1',
          role: 'assistant',
          content: '已保存消息',
          timestamp: 1,
        },
      ],
      conversationId: 'conv-1',
      lastMetadata: {
        sessionId: 'session-persisted',
        memoryDebugFile: '.ai-debug/memory/persisted-finalize.json',
      },
      lastDebugFile: '.ai-debug/traces/persisted-success.json',
    }],
  ]);

  return {
    commands: {
      execute: vi.fn(),
    },
    workspace: {
      getWorkspaceId: () => 'test-workspace',
    },
    persistence: {
      getJSON: vi.fn(async (namespace: string, key: string) => persistedState.get(`${namespace}:${key}`)),
      setJSON: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe('AIPanel', () => {
  beforeEach(() => {
    useAgentRunState.runAgent.mockReset();
    useAgentRunState.cancelRun.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          { id: 'openai-compatible::GLM-4.7', name: 'GLM-4.7', provider: 'openai-compatible' },
          { id: 'openai-compatible::GLM-4.6', name: 'GLM-4.6', provider: 'openai-compatible' },
          { id: 'nextai::gemini-2.5-pro', name: 'gemini-2.5-pro', provider: 'nextai' },
        ],
      }),
    } satisfies Partial<Response>);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    useAgentLoopState.mode = null;
    useAgentLoopState.phase = 'idle';
    useAgentLoopState.isRunning = false;
    useAgentLoopState.progressText = '';
    useAgentLoopState.elapsedMs = 0;
    useAgentLoopState.projectPlan = null;
    useAgentLoopState.pages = [];
    useAgentLoopState.errorMessage = undefined;
    useAgentLoopState.planRevisionRequested = false;
    useAgentLoopState.runAgent = useAgentRunState.runAgent;
    useAgentLoopState.cancelRun = useAgentRunState.cancelRun;
    useAgentLoopState.legacy = {
      executionSnapshot: null,
      isRunning: false,
      progressText: '',
      elapsedMs: 0,
    };
  });

  it('通过 pluginContext.persistence 恢复并写回模型、草稿、历史和会话', async () => {
    const pluginContext = createPersistenceStateContext();
    const bridge = createBridge();

    render(<AIPanel bridge={bridge} pluginContext={pluginContext} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Planner')).toHaveValue('openai-compatible::GLM-4.6');
      expect(screen.getByLabelText('Block')).toHaveValue('openai-compatible::GLM-4.7');
    });
    expect(screen.getByPlaceholderText('输入调试提示词，Enter 发送，Shift+Enter 换行')).toHaveValue('已保存草稿');
    expect(screen.getByText('已保存消息')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '历史输入' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Planner'), { target: { value: 'nextai::gemini-2.5-pro' } });
    fireEvent.change(
      screen.getByPlaceholderText('输入调试提示词，Enter 发送，Shift+Enter 换行'),
      { target: { value: '更新后的草稿' } },
    );

    await waitFor(() => {
      expect(pluginContext.persistence?.getJSON).toHaveBeenCalledWith('ai-chat', 'model-selection');
      expect(pluginContext.persistence?.getJSON).toHaveBeenCalledWith('ai-chat', 'ui');
      expect(pluginContext.persistence?.getJSON).toHaveBeenCalledWith('ai-chat', 'prompt-history');
      expect(pluginContext.persistence?.getJSON).toHaveBeenCalledWith('ai-chat', 'session');
      expect(getLatestPersistenceWrite(pluginContext, 'model-selection')?.[2]).toEqual({
        plannerModel: 'nextai::gemini-2.5-pro',
        blockModel: 'nextai::gemini-2.5-pro',
      });
      expect(getLatestPersistenceWrite(pluginContext, 'ui')?.[2]).toEqual({
        thinkingEnabled: true,
        blockConcurrency: 3,
        draftText: '更新后的草稿',
      });
      expect(getLatestPersistenceWrite(pluginContext, 'prompt-history')?.[2]).toEqual(['历史提示词']);
      expect(getLatestPersistenceWrite(pluginContext, 'session')?.[2]).toEqual({
        messages: [
          {
            id: 'msg-1',
            role: 'assistant',
            content: '已保存消息',
            timestamp: 1,
          },
        ],
        conversationId: 'conv-1',
        lastMetadata: {
          sessionId: 'session-persisted',
          memoryDebugFile: '.ai-debug/memory/persisted-finalize.json',
        },
        lastDebugFile: '.ai-debug/traces/persisted-success.json',
      });
    });
  });

  it('清空按钮会触发 workspace.resetDocument 并清空会话', async () => {
    const pluginContext = createPersistenceStateContext();

    render(<AIPanel bridge={createBridge()} pluginContext={pluginContext} />);

    await waitFor(() => {
      expect(screen.getByText('已保存消息')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '清空' }));

    await waitFor(() => {
      expect(pluginContext.commands?.execute).toHaveBeenCalledWith('workspace.resetDocument', undefined);
      expect(screen.queryByText('已保存消息')).toBeNull();
      expect(screen.getByText(/你好！我是 Shenbi 智能开发助手/)).toBeInTheDocument();
    });
  });

  it('没有 persistence 时会退化为内存态而不报错', async () => {
    render(<AIPanel bridge={createBridge()} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Planner')).toHaveValue('openai-compatible::GLM-4.7');
    });
    expect(screen.getByPlaceholderText('输入调试提示词，Enter 发送，Shift+Enter 换行')).toHaveValue('');
  });

  it('在成功运行后显示完整 debugFile 路径', async () => {
    useAgentRunState.runAgent.mockImplementation(
      async (
        _text: string,
        _plannerModel: string,
        _blockModel: string,
        _thinkingEnabled: boolean,
        _conversationId: string | undefined,
        _onMessageStart: () => string,
        _onMessageDelta: (id: string, chunk: string) => void,
        onDone: (metadata: { sessionId: string; debugFile?: string; memoryDebugFile?: string; durationMs?: number; tokensUsed?: number }) => void,
        _onError: (error: string) => void,
        _blockConcurrency: number | undefined,
        onRunComplete: (result: {
          plan: null;
          plannerMetrics: null;
          blockStatuses: Record<string, never>;
          blockTokens: Record<string, never>;
          blockInputTokens: Record<string, never>;
          blockOutputTokens: Record<string, never>;
          blockDurationMs: Record<string, never>;
          modifyPlan: null;
          modifyStatuses: Record<number, never>;
          modifyOpMetrics: Record<number, never>;
          elapsedMs: number;
          statusLabel: string;
          didApplySchema: boolean;
          durationMs?: number;
          tokensUsed?: number;
          debugFile?: string;
          memoryDebugFile?: string;
        }) => void,
      ) => {
        const metadata = {
          sessionId: 'session-success',
          debugFile: '.ai-debug/traces/2026-03-11-success.json',
          memoryDebugFile: '.ai-debug/memory/2026-03-11-finalize.json',
          durationMs: 321,
          tokensUsed: 128,
        };
        onRunComplete({
          plan: null,
          plannerMetrics: null,
          blockStatuses: {},
          blockTokens: {},
          blockInputTokens: {},
          blockOutputTokens: {},
          blockDurationMs: {},
          modifyPlan: null,
          modifyStatuses: {},
          modifyOpMetrics: {},
          elapsedMs: 321,
          statusLabel: '页面生成完成',
          didApplySchema: false,
          ...metadata,
        });
        onDone(metadata);
      },
    );

    render(<AIPanel bridge={createBridge()} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Planner')).toHaveValue('openai-compatible::GLM-4.7');
    });

    fireEvent.change(
      screen.getByPlaceholderText('输入调试提示词，Enter 发送，Shift+Enter 换行'),
      { target: { value: '生成一个页面' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(screen.getByText('Trace File: .ai-debug/traces/2026-03-11-success.json')).toBeInTheDocument();
      expect(screen.getByText('Memory Dump: .ai-debug/memory/2026-03-11-finalize.json')).toBeInTheDocument();
      expect(screen.getByText('耗时: 321ms')).toBeInTheDocument();
      expect(screen.getByText('Tokens: 128')).toBeInTheDocument();
    });
  });

  it('在失败运行后从错误文案里提取并显示 debugFile 路径', async () => {
    useAgentRunState.runAgent.mockImplementation(
      async (
        _text: string,
        _plannerModel: string,
        _blockModel: string,
        _thinkingEnabled: boolean,
        _conversationId: string | undefined,
        _onMessageStart: () => string,
        _onMessageDelta: (id: string, chunk: string) => void,
        _onDone: (metadata: { sessionId: string; debugFile?: string; durationMs?: number; tokensUsed?: number }) => void,
        onError: (error: string) => void,
      ) => {
        onError('Provider unavailable. Trace file: .ai-debug/traces/2026-03-11-error.json');
      },
    );

    render(<AIPanel bridge={createBridge()} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Planner')).toHaveValue('openai-compatible::GLM-4.7');
    });

    fireEvent.change(
      screen.getByPlaceholderText('输入调试提示词，Enter 发送，Shift+Enter 换行'),
      { target: { value: '生成失败' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(screen.getByText('[Error]: Provider unavailable. Trace file: .ai-debug/traces/2026-03-11-error.json')).toBeInTheDocument();
    });
  });

  it('在失败运行后对通用错误 dump 使用 Debug File 标签', async () => {
    useAgentRunState.runAgent.mockImplementation(
      async (
        _text: string,
        _plannerModel: string,
        _blockModel: string,
        _thinkingEnabled: boolean,
        _conversationId: string | undefined,
        _onMessageStart: () => string,
        _onMessageDelta: (id: string, chunk: string) => void,
        _onDone: (metadata: { sessionId: string; debugFile?: string; durationMs?: number; tokensUsed?: number }) => void,
        onError: (error: string) => void,
      ) => {
        onError('prompt is required. Debug file: .ai-debug/errors/2026-03-11-error.json');
      },
    );

    render(<AIPanel bridge={createBridge()} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Planner')).toHaveValue('openai-compatible::GLM-4.7');
    });

    fireEvent.change(
      screen.getByPlaceholderText('输入调试提示词，Enter 发送，Shift+Enter 换行'),
      { target: { value: '生成失败' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(screen.getByText('[Error]: prompt is required. Debug file: .ai-debug/errors/2026-03-11-error.json')).toBeInTheDocument();
    });
  });

  it('发送附件时请求包含 dataUrl，但会话持久化只保存附件引用', async () => {
    const pluginContext = {
      commands: {
        execute: vi.fn(),
      },
      workspace: {
        getWorkspaceId: () => 'test-workspace',
      },
      persistence: {
        getJSON: vi.fn(async () => undefined),
        setJSON: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
    } satisfies PluginContext;

    render(<AIPanel bridge={createBridge()} pluginContext={pluginContext} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Planner')).toHaveValue('openai-compatible::GLM-4.7');
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    const imageFile = new File([Uint8Array.from([1, 2, 3])], 'wireframe.png', { type: 'image/png' });

    fireEvent.change(fileInput!, {
      target: {
        files: [imageFile],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(useAgentRunState.runAgent).toHaveBeenCalledTimes(1);
      expect(screen.getByText('wireframe.png')).toBeInTheDocument();
    });

    const attachments = useAgentRunState.runAgent.mock.calls[0]?.[11] as Array<{ dataUrl: string; name: string }> | undefined;
    expect(attachments).toEqual([
      expect.objectContaining({
        name: 'wireframe.png',
        dataUrl: expect.stringMatching(/^data:image\/png;base64,/),
      }),
    ]);

    await waitFor(() => {
      const sessionWrite = [...(pluginContext.persistence?.setJSON.mock.calls ?? [])].reverse().find(
        ([namespace, key]) => namespace === 'ai-chat' && key === 'session',
      );
      expect(sessionWrite).toBeTruthy();
      expect(JSON.stringify(sessionWrite?.[2] ?? {})).not.toContain('base64');
      expect(sessionWrite?.[2]).toEqual(expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            attachments: [
              expect.objectContaining({
                attachmentId: expect.any(String),
                name: 'wireframe.png',
              }),
            ],
          }),
        ]),
      }));
    });
  });

  it('uses auto scroll for in-flight panel refreshes instead of repeated smooth scrolling', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    const pluginContext = createPersistenceStateContext();
    const { rerender } = render(<AIPanel bridge={createBridge()} pluginContext={pluginContext} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Planner')).toHaveValue('openai-compatible::GLM-4.6');
    });

    useAgentLoopState.mode = 'legacy';
    useAgentLoopState.isRunning = true;
    useAgentLoopState.progressText = 'Planning page structure.';
    useAgentLoopState.legacy = {
      executionSnapshot: {
        mode: 'create',
        plan: {
          pageTitle: '系统看板',
          pageType: 'dashboard',
          blocks: [{
            id: 'hero',
            description: '顶部概览',
            components: ['Card'],
            priority: 1,
            complexity: 'simple',
          }],
        },
        plannerMetrics: null,
        blockStatuses: { hero: 'done' },
        blockTokens: {},
        blockInputTokens: {},
        blockOutputTokens: {},
        blockDurationMs: {},
        modifyPlan: null,
        modifyStatuses: {},
        modifyOpMetrics: {},
        progressText: 'Planning page structure.',
        didApplySchema: false,
      },
      isRunning: true,
      progressText: 'Planning page structure.',
      elapsedMs: 3456,
    };

    rerender(<AIPanel bridge={createBridge()} pluginContext={pluginContext} />);

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });

    const latestCall = scrollIntoView.mock.calls.at(-1)?.[0];
    expect(latestCall).toMatchObject({
      behavior: 'auto',
      block: 'end',
    });
  });
});
