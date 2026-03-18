import { describe, expect, it, vi } from 'vitest';
import {
  buildAgentLoopSystemPrompt,
  buildCreatePagePrompt,
  buildModifyPagePrompt,
  executeAgentTool,
  toProjectPlan,
  type ToolContext,
} from './agent-tools';
import type { AgentLoopPageProgress } from './agent-loop-types';

describe('buildAgentLoopSystemPrompt', () => {
  it('keeps the loop protocol short, strict, and execution-oriented', () => {
    const prompt = buildAgentLoopSystemPrompt();

    expect(prompt).toContain('你是 Shenbi 低代码平台的 Agent。你只能通过工具推进任务。');
    expect(prompt).toContain('必须输出合法 JSON 对象');
    expect(prompt).toContain('"action"');
    expect(prompt).toContain('"actionInput"');
    expect(prompt).toContain('proposeProjectPlan');
    expect(prompt).toContain('"projectName":"订单管理后台"');
    expect(prompt).toContain('createPage');
    expect(prompt).toContain('项目规划一旦确认，后续按已确认计划继续执行');
    expect(prompt).toContain('不要返回数组');
    expect(prompt).toContain('文档分析规则');
    expect(prompt).toContain('group（所属模块）');
    expect(prompt).toContain('evidence（文档关键摘录）');
    expect(prompt).toContain('description 只能是一句简明摘要');
    expect(prompt).toContain('evidence 必须尽量逐字引用文档原文');
    expect(prompt).toContain('禁止把 evidence 写成概括性改写');
    expect(prompt).not.toContain('错误示例');
  });
});

describe('project plan helpers', () => {
  it('parses group, prompt, and evidence from project plan pages', () => {
    const plan = toProjectPlan({
      projectName: '订单管理后台',
      pages: [
        {
          pageId: 'order-list',
          pageName: '订单列表页',
          action: 'create',
          description: '展示订单列表',
          group: '订单管理',
          prompt: '完整的建页 prompt',
          evidence: '文档要求支持搜索、筛选和导出。',
        },
      ],
    });

    expect(plan.pages[0]).toMatchObject({
      group: '订单管理',
      prompt: '完整的建页 prompt',
      evidence: '文档要求支持搜索、筛选和导出。',
    });
  });

  it('prefers explicit prompts for create and modify actions', () => {
    expect(buildCreatePagePrompt({
      prompt: '使用完整 prompt 建页',
      description: '这段描述不应被使用',
    }, '订单列表页')).toBe('使用完整 prompt 建页');

    expect(buildModifyPagePrompt({
      prompt: '使用完整 prompt 修改页面',
      description: '这段描述不应被使用',
    })).toBe('使用完整 prompt 修改页面');

    expect(buildCreatePagePrompt({
      description: '展示订单列表',
      evidence: '（1）左上：全年统计看板；（2）左下：人员看板；（3）右侧：最新动态。',
    }, '系统看板')).toContain('原文依据: （1）左上：全年统计看板；（2）左下：人员看板；（3）右侧：最新动态。');

    expect(buildModifyPagePrompt({
      description: '请按文档调整页面',
      evidence: '（1）左上：全年统计看板；（2）左下：人员看板；（3）右侧：最新动态。',
    })).toContain('原文依据: （1）左上：全年统计看板；（2）左下：人员看板；（3）右侧：最新动态。');
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
      fileId: 'order-list-page',
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

  it('passes parsed project plan metadata to proposeProjectPlan', async () => {
    const proposeProjectPlan = vi.fn(async () => 'ok');
    await executeAgentTool(
      createContext({ proposeProjectPlan }),
      'proposeProjectPlan',
      {
        projectName: '订单管理后台',
        pages: [
          {
            pageId: 'order-list',
            pageName: '订单列表页',
            action: 'create',
            description: '展示订单列表',
            group: '订单管理',
            prompt: '订单列表页详细建页说明',
            evidence: '文档明确要求支持筛选与导出。',
          },
        ],
      },
      new Map<string, AgentLoopPageProgress>(),
    );

    expect(proposeProjectPlan).toHaveBeenCalledWith(expect.objectContaining({
      projectName: '订单管理后台',
      pages: [
        expect.objectContaining({
          group: '订单管理',
          prompt: '订单列表页详细建页说明',
          evidence: '文档明确要求支持筛选与导出。',
        }),
      ],
    }));
  });
});
