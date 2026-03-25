import { describe, expect, it } from 'vitest';
import { buildPagePlannerPromptSpec } from './page-planner-prompt';

describe('page-planner-prompt', () => {
  it('builds planner prompt text for schema.create planning', () => {
    const prompt = buildPagePlannerPromptSpec({
      prompt: '创建一个员工管理列表页',
      schemaSummary: '空白页面',
      schemaTree: '[schema tree unavailable]',
      componentSummary: 'Table, Form, Button',
      conversationHistory: '[none]',
      supportedComponentList: 'Table, Form, Button',
      supportedPageTypes: ['dashboard', 'list', 'form', 'detail', 'statistics', 'custom'],
      plannerContractSummary: 'Group filters-form: Form, Input, Select',
      designPolicySummary: 'Favor clear B2B admin layout.',
      suggestedPageType: 'list',
      suggestedSkeletonSummary: 'Header + filters + table',
      freeLayoutPatternSummary: 'Header row + content row',
      recommendedLayoutIntent: 'list-management',
      recommendedLayoutPattern: 'stacked-header-content',
    });

    expect(prompt.systemText).toContain('You are a low-code page planner.');
    expect(prompt.systemText).toContain('prefer pageType "list"');
    expect(prompt.userLines).toEqual([
      'Prompt: 创建一个员工管理列表页',
      'Schema Summary: 空白页面',
      'Schema Tree:',
      '[schema tree unavailable]',
      'Component Summary: Table, Form, Button',
      'Conversation History:',
      '[none]',
      'Selected Node: none',
      'Your response must start with { and end with }. No other text.',
    ]);
  });

  it('includes selected-node context when available', () => {
    const prompt = buildPagePlannerPromptSpec({
      prompt: '在当前页补一个详情区',
      schemaSummary: '已有列表页',
      componentSummary: 'Descriptions, Card',
      conversationHistory: 'user: 刚生成了列表',
      selectedNodeId: 'table-card',
      supportedComponentList: 'Descriptions, Card',
      supportedPageTypes: ['detail', 'custom'],
      plannerContractSummary: 'Group disclosure: Card, Descriptions',
      designPolicySummary: 'Prefer master-detail layout.',
      suggestedPageType: 'detail',
      suggestedSkeletonSummary: 'Master-detail split',
      freeLayoutPatternSummary: '8/16 split',
      recommendedLayoutIntent: 'master-detail',
      recommendedLayoutPattern: 'split-pane',
    });

    expect(prompt.userLines).toContain('Selected Node: table-card');
  });
});
