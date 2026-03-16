import { describe, expect, it } from 'vitest';
import { parseReActResponse } from './react-parser';

describe('parseReActResponse', () => {
  it('parses required action fields and optional status fields', () => {
    expect(parseReActResponse([
      'Status: 正在检查当前工作区页面',
      'Action: listWorkspaceFiles',
      'Action Input: {"includeHidden":false}',
    ].join('\n'))).toEqual({
      status: '正在检查当前工作区页面',
      action: 'listWorkspaceFiles',
      actionInput: {
        includeHidden: false,
      },
      rawActionInput: '{"includeHidden":false}',
    });

    expect(parseReActResponse([
      'Reasoning Summary: 先确认已有页面，避免重复创建',
      'Action: finish',
      'Action Input: ```json',
      '{"summary":"done"}',
      '```',
    ].join('\n'))).toEqual({
      reasoningSummary: '先确认已有页面，避免重复创建',
      action: 'finish',
      actionInput: {
        summary: 'done',
      },
      rawActionInput: '{"summary":"done"}',
    });
  });

  it('accepts common model output variants', () => {
    expect(parseReActResponse([
      '状态：正在读取当前工作区文件',
      '动作：listWorkspaceFiles',
      '动作输入：{}',
    ].join('\n'))).toEqual({
      status: '正在读取当前工作区文件',
      action: 'listWorkspaceFiles',
      actionInput: {},
      rawActionInput: '{}',
    });

    expect(parseReActResponse([
      'Status：Preparing project plan',
      'Action：proposeProjectPlan',
      'Action Input：```json',
      '{"projectName":"订单管理后台","pages":[{"pageId":"order-list","pageName":"订单列表","action":"create","description":"订单列表页"}]}',
      '```',
    ].join('\n'))).toEqual({
      status: 'Preparing project plan',
      action: 'proposeProjectPlan',
      actionInput: {
        projectName: '订单管理后台',
        pages: [
          {
            pageId: 'order-list',
            pageName: '订单列表',
            action: 'create',
            description: '订单列表页',
          },
        ],
      },
      rawActionInput: '{"projectName":"订单管理后台","pages":[{"pageId":"order-list","pageName":"订单列表","action":"create","description":"订单列表页"}]}',
    });

    expect(parseReActResponse(JSON.stringify({
      status: '正在提交项目计划',
      action: 'proposeProjectPlan',
      actionInput: {
        projectName: '订单管理后台',
        pages: [
          {
            pageId: 'order-detail',
            pageName: '订单详情',
            action: 'create',
            description: '订单详情页',
          },
        ],
      },
    }))).toEqual({
      status: '正在提交项目计划',
      action: 'proposeProjectPlan',
      actionInput: {
        projectName: '订单管理后台',
        pages: [
          {
            pageId: 'order-detail',
            pageName: '订单详情',
            action: 'create',
            description: '订单详情页',
          },
        ],
      },
      rawActionInput: '{"projectName":"订单管理后台","pages":[{"pageId":"order-detail","pageName":"订单详情","action":"create","description":"订单详情页"}]}',
    });
  });

  it('throws when action or action input is missing', () => {
    expect(() => parseReActResponse('Action Input: {}')).toThrow('Missing Action field');
    expect(() => parseReActResponse('Action: finish')).toThrow('Missing Action Input field');
  });
});
