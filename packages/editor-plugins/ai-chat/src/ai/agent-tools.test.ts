import { describe, expect, it, vi } from 'vitest';
import { buildAgentLoopSystemPrompt, executeAgentTool, type ToolContext } from './agent-tools';
import type { AgentLoopPageProgress } from './agent-loop-types';

describe('buildAgentLoopSystemPrompt', () => {
  it('emphasizes strict plain-text protocol and forbids common wrapper formats', () => {
    const prompt = buildAgentLoopSystemPrompt();

    expect(prompt).toContain('你的回复会被程序直接解析');
    expect(prompt).toContain('不要返回 JSON 包装对象');
    expect(prompt).toContain('不要输出 reasoning、thought、answer、type、content、output、input、params、arguments 等包装字段');
    expect(prompt).toContain('如果工具没有参数，也必须输出 Action Input: {}');
    expect(prompt).toContain('{"type":"listWorkspaceFiles"}');
    expect(prompt).toContain('{"reasoning":"...","answer":"Action: listWorkspaceFiles\\nAction Input: {}"}');
    expect(prompt).toContain('proposeProjectPlan 的 Action Input 必须包含 projectName 和 pages，pages 不能为空');
    expect(prompt).toContain('多页面需求必须先 proposeProjectPlan');
  });
});

function createContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    bridge: {
      getSchema: () => ({ id: 'current', name: 'Current', body: [] }),
      getSelectedNodeId: () => undefined,
      getAvailableComponents: () => [],
      execute: vi.fn(),
      replaceSchema: vi.fn(),
      appendBlock: vi.fn(),
      removeNode: vi.fn(),
      subscribe: () => () => undefined,
    },
    aiClient: {
      runStream: vi.fn(),
      chat: vi.fn(),
      chatStream: vi.fn(),
      finalize: vi.fn(),
    },
    plannerModel: 'planner-demo',
    blockModel: 'block-demo',
    thinkingEnabled: false,
    getCurrentConversationId: () => 'conv-1',
    getAvailableComponentsSummary: () => 'Button, Table',
    listWorkspaceFiles: async () => [],
    readPageSchema: async () => ({ id: 'page-1', name: 'Page 1', body: [] }),
    writePageSchema: async () => undefined,
    deletePageSchema: async () => undefined,
    proposeProjectPlan: async () => 'ok',
    executeCreatePage: async () => ({ success: true }),
    executeModifyPage: async () => ({ success: true }),
    ...overrides,
  };
}

describe('executeAgentTool', () => {
  it('rejects empty project plans instead of silently accepting them', async () => {
    await expect(executeAgentTool(
      createContext(),
      'proposeProjectPlan',
      {},
      new Map<string, AgentLoopPageProgress>(),
    )).rejects.toThrow('proposeProjectPlan requires a non-empty pages array');
  });

  it('normalizes structured createPage input into a concrete page id and prompt', async () => {
    const executeCreatePage = vi.fn(async () => ({ fileId: '订单列表页', success: true }));
    await executeAgentTool(
      createContext({ executeCreatePage }),
      'createPage',
      {
        fileId: 'order-list-page',
        pageName: '订单列表页',
        description: '展示订单列表和筛选条件',
        layout: 'Layout.Header,Layout.Content',
        components: 'Table,Button,Input',
        fields: '订单编号,客户名称,订单金额',
        interactions: '分页,搜索,筛选',
      },
      new Map<string, AgentLoopPageProgress>(),
    );

    expect(executeCreatePage).toHaveBeenCalledWith({
      pageId: 'order-list-page',
      pageName: '订单列表页',
      fileId: '订单列表页',
      prompt: [
        '订单列表页 页面',
        '目标: 展示订单列表和筛选条件',
        '布局: Layout.Header,Layout.Content',
        '组件: Table,Button,Input',
        '字段: 订单编号,客户名称,订单金额',
        '交互: 分页,搜索,筛选',
      ].join('\n'),
    }, expect.objectContaining({
      pageId: 'order-list-page',
      pageName: '订单列表页',
    }));
  });
});
