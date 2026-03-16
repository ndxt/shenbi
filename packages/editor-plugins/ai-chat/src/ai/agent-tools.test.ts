import { describe, expect, it, vi } from 'vitest';
import { buildAgentLoopSystemPrompt, executeAgentTool, type ToolContext } from './agent-tools';
import type { AgentLoopPageProgress } from './agent-loop-types';

describe('buildAgentLoopSystemPrompt', () => {
  it('keeps the loop protocol short, strict, and execution-oriented', () => {
    const prompt = buildAgentLoopSystemPrompt();

    expect(prompt).toContain('你是 Shenbi 低代码平台的 Agent。你只能通过工具推进任务。');
    expect(prompt).toContain('每次回复必须严格使用以下纯文本格式之一');
    expect(prompt).toContain('Action: <tool-name>');
    expect(prompt).toContain('Action Input: <json object>');
    expect(prompt).toContain('无参工具也必须写空对象');
    expect(prompt).toContain('Observation: []');
    expect(prompt).toContain('Action: proposeProjectPlan');
    expect(prompt).toContain('"projectName":"订单管理后台"');
    expect(prompt).toContain('Observation: 用户已确认项目规划');
    expect(prompt).toContain('Action: createPage');
    expect(prompt).toContain('项目规划一旦确认，后续按已确认计划继续执行');
    expect(prompt).toContain('不要重复输出 Observation');
    expect(prompt).not.toContain('错误示例');
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
