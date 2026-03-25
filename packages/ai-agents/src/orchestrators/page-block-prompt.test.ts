import { describe, expect, it } from 'vitest';
import { buildPageBlockPromptSpec } from './page-block-prompt';

describe('page-block-prompt', () => {
  it('builds block-generation prompt text with retry feedback', () => {
    const prompt = buildPageBlockPromptSpec({
      blockDescription: '用户列表主表格区域',
      pageTitle: '用户管理',
      blockIndex: 2,
      placementSummary: '主内容区',
      suggestedComponents: ['Table', 'Pagination'],
      schemaTree: 'Card#table-card > Table#user-table',
      conversationHistory: '[none]',
      qualityFeedbackSummary: 'Targeted quality corrections for this retry:\n- table-columns: 补齐 columns',
      supportedComponentList: 'Table, Pagination, Card',
      supportedComponentsJsonShape: '{"component":"Button|Table|Card","id":"string","props":{},"children":[]}',
      expandedComponents: ['Table', 'Pagination'],
      designPolicySummary: 'Favor clean B2B admin layout.',
      componentSchemaContracts: 'Component: Table\nschema-example: {"component":"Table"}',
      isDashboardBlock: false,
      isMasterListRegion: false,
      isHeaderBlock: false,
    });

    expect(prompt.systemText).toContain('You generate one low-code block as valid JSON.');
    expect(prompt.systemText).toContain('Component schema contracts');
    expect(prompt.userLines).toEqual([
      'Prompt: 用户列表主表格区域',
      'Page Title: 用户管理',
      'Block Index: 2',
      'Placement: 主内容区',
      'Block Description: 用户列表主表格区域',
      'Suggested Components: Table, Pagination',
      'Schema Tree:',
      'Card#table-card > Table#user-table',
      'Conversation History:',
      '[none]',
      'Targeted quality corrections for this retry:\n- table-columns: 补齐 columns',
      'Your response must start with { and end with }. No other text.',
    ]);
  });

  it('adds header-specific rules for page header blocks', () => {
    const prompt = buildPageBlockPromptSpec({
      blockDescription: '页面标题区',
      suggestedComponents: ['Typography.Title', 'Breadcrumb'],
      conversationHistory: '[none]',
      supportedComponentList: 'Typography.Title, Breadcrumb',
      supportedComponentsJsonShape: '{"component":"Typography.Title|Breadcrumb","id":"string","props":{},"children":[]}',
      expandedComponents: ['Typography.Title', 'Breadcrumb'],
      designPolicySummary: 'Header should be concise.',
      componentSchemaContracts: 'Component: Typography.Title',
      isDashboardBlock: false,
      isMasterListRegion: false,
      isHeaderBlock: true,
    });

    expect(prompt.systemText).toContain('CRITICAL: This block is the PAGE HEADER only.');
    expect(prompt.userLines).toContain('Page Title: Untitled');
  });
});
