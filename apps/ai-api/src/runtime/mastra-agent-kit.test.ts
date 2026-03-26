import { describe, expect, it } from 'vitest';
import {
  buildProjectAgentInstructions,
  buildProjectAgentPrompt,
  extractValidatedMastraBlockNode,
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
      documentContext: [
        'Document: 待办事项跟踪管理系统需求描述.docx',
        'Preview: 事项列表：支持状态筛选、责任人、截止时间。',
      ].join('\n'),
    });

    expect(prompt).toContain('Document Summary:');
    expect(prompt).toContain('Document previews:');
    expect(prompt).toContain('事项列表：支持状态筛选、责任人、截止时间。');
  });
});
