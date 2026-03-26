import { describe, expect, it } from 'vitest';
import {
  buildProjectAgentInstructions,
  buildProjectAgentPrompt,
  extractValidatedMastraBlockNode,
  normalizeDocumentSummary,
} from './mastra-agent-kit.ts';

describe('extractValidatedMastraBlockNode', () => {
  it('throws a clear error when mastra block output omits the node payload', () => {
    expect(() => extractValidatedMastraBlockNode({}, 'detail-main')).toThrow(
      'Mastra block generator returned an invalid node payload for block "detail-main"',
    );
  });

  it('returns the validated schema node when node payload exists', () => {
    const node = extractValidatedMastraBlockNode({
      node: {
        id: 'detail-card',
        component: 'Card',
        children: [],
      },
    }, 'detail-main');

    expect(node.component).toBe('Card');
    expect(node.id).toBe('detail-card');
  });

  it('accepts a direct schema node payload without a node wrapper', () => {
    const node = extractValidatedMastraBlockNode({
      id: 'filter-block',
      component: 'Form',
      children: [],
    }, 'filter-block');

    expect(node.component).toBe('Form');
    expect(node.id).toBe('filter-block');
  });

  it('falls back to parsing JSON text when the structured object is malformed', () => {
    const node = extractValidatedMastraBlockNode(
      { summary: 'fallback only' },
      'filter-block',
      JSON.stringify({
        node: {
          id: 'filter-block',
          component: 'Form',
          children: [],
        },
      }),
    );

    expect(node.component).toBe('Form');
    expect(node.id).toBe('filter-block');
  });
});

describe('buildProjectAgentInstructions', () => {
  it('adds document evidence rules when uploaded document context exists', () => {
    const instructions = buildProjectAgentInstructions({
      baseSystemText: 'base planner rules',
      hasDocumentContext: true,
    });

    expect(instructions).toContain('every generated page should include group, description, prompt, and evidence');
    expect(instructions).toContain('evidence must quote continuous original wording');
    expect(instructions).toContain('Do not rewrite evidence into abstract summaries');
    expect(instructions).toContain('prompt is for downstream page generation');
  });

  it('keeps document-only constraints out when no document context exists', () => {
    const instructions = buildProjectAgentInstructions({
      baseSystemText: 'base planner rules',
      hasDocumentContext: false,
    });

    expect(instructions).not.toContain('every generated page should include group, description, prompt, and evidence');
  });
});

describe('buildProjectAgentPrompt', () => {
  it('includes raw document previews so project planning can cite original excerpts', () => {
    const prompt = buildProjectAgentPrompt({
      baseUserText: '用户需求：阅读文档生成项目',
      documentSummary: {
        summary: '待办事项管理系统',
        evidence: ['事项列表：支持状态筛选、责任人、截止时间。'],
      },
      retrievedDocumentContext: '[conv:doc-1:0]\nExcerpt: 事项列表：支持状态筛选、责任人、截止时间。',
      documentContext: [
        'Document: 待办事项跟踪管理系统需求描述.docx',
        'Preview: 事项列表：支持状态筛选、责任人、截止时间。',
      ].join('\n'),
    });

    expect(prompt).toContain('Document Summary:');
    expect(prompt).toContain('Retrieved document chunks:');
    expect(prompt).toContain('[conv:doc-1:0]');
    expect(prompt).toContain('Document previews:');
    expect(prompt).toContain('事项列表：支持状态筛选、责任人、截止时间。');
  });
});

describe('normalizeDocumentSummary', () => {
  it('normalizes rich structured document extraction results into the lightweight summary shape', () => {
    const summary = normalizeDocumentSummary({
      system_name: '待办事项跟踪管理系统',
      business_description: '集中管理公司层面会议上确定的待办事项',
      roles: [
        { role: '高管', permissions: ['看板查看'] },
        { role: '督办专员', permissions: ['会议新增/删除/编辑'] },
      ],
      entities: [
        { entity_name: '会议信息' },
        { entity_name: '事项信息' },
      ],
      pages: [
        { page_name: '看板', page_type: 'dashboard' },
        { page_name: '事项清单', page_type: 'list' },
      ],
      access_rules: [
        '事项详情查看权限：高管、督办专员、责任人、协办人可查看',
      ],
    });

    expect(summary.summary).toContain('待办事项跟踪管理系统');
    expect(summary.roles).toEqual([
      '高管',
      '督办专员',
    ]);
    expect(summary.entities).toEqual([
      '会议信息',
      '事项信息',
    ]);
    expect(summary.requiredPages).toEqual([
      '看板',
      '事项清单',
    ]);
    expect(summary.evidence).toEqual([
      '事项详情查看权限：高管、督办专员、责任人、协办人可查看',
    ]);
  });
});
