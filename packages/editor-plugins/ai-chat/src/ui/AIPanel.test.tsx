import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PluginContext } from '@shenbi/editor-plugin-api';
import type { EditorAIBridge } from '../ai/editor-ai-bridge';
import { AIPanel } from './AIPanel';

const fetchMock = vi.hoisted(() => vi.fn());

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
    ['ai-chat:model-selection', { plannerModel: 'GLM-4.6', blockModel: 'GLM-4.7' }],
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
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          { id: 'GLM-4.7', name: 'GLM-4.7' },
          { id: 'GLM-4.6', name: 'GLM-4.6' },
        ],
      }),
    } satisfies Partial<Response>);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('通过 pluginContext.persistence 恢复并写回模型、草稿、历史和会话', async () => {
    const pluginContext = createPersistenceStateContext();
    const bridge = createBridge();

    render(<AIPanel bridge={bridge} pluginContext={pluginContext} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Planner')).toHaveValue('GLM-4.6');
      expect(screen.getByLabelText('Block')).toHaveValue('GLM-4.7');
    });
    expect(screen.getByPlaceholderText('输入调试提示词，Enter 发送，Shift+Enter 换行')).toHaveValue('已保存草稿');
    expect(screen.getByText('已保存消息')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '历史输入' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Planner'), { target: { value: 'GLM-4.7' } });
    fireEvent.change(
      screen.getByPlaceholderText('输入调试提示词，Enter 发送，Shift+Enter 换行'),
      { target: { value: '更新后的草稿' } },
    );

    await waitFor(() => {
      expect(pluginContext.persistence?.getJSON).toHaveBeenCalledWith('ai-chat', 'model-selection');
      expect(pluginContext.persistence?.getJSON).toHaveBeenCalledWith('ai-chat', 'ui');
      expect(pluginContext.persistence?.getJSON).toHaveBeenCalledWith('ai-chat', 'prompt-history');
      expect(pluginContext.persistence?.getJSON).toHaveBeenCalledWith('ai-chat', 'session');
      expect(pluginContext.persistence?.setJSON).toHaveBeenCalledWith('ai-chat', 'model-selection', {
        plannerModel: 'GLM-4.7',
        blockModel: 'GLM-4.7',
      });
      expect(pluginContext.persistence?.setJSON).toHaveBeenCalledWith('ai-chat', 'ui', {
        thinkingEnabled: true,
        draftText: '更新后的草稿',
      });
      expect(pluginContext.persistence?.setJSON).toHaveBeenCalledWith('ai-chat', 'prompt-history', ['历史提示词']);
      expect(pluginContext.persistence?.setJSON).toHaveBeenCalledWith('ai-chat', 'session', {
        messages: [
          {
            id: 'msg-1',
            role: 'assistant',
            content: '已保存消息',
            timestamp: 1,
          },
        ],
        conversationId: 'conv-1',
        lastMetadata: undefined,
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
      expect(screen.getByLabelText('Planner')).toHaveValue('GLM-4.7');
    });
    expect(screen.getByPlaceholderText('输入调试提示词，Enter 发送，Shift+Enter 换行')).toHaveValue('');
  });
});
