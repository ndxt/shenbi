import { describe, expect, it } from 'vitest';
import {
  bindEvidenceSourceIds,
  formatDocumentKnowledgeHits,
  indexDocumentKnowledge,
  retrieveDocumentKnowledge,
} from './document-knowledge.ts';

describe('document knowledge indexing', () => {
  it('splits headings and enumerated lists into reusable chunks', () => {
    const chunks = indexDocumentKnowledge({
      conversationId: 'conv-doc',
      prompt: '阅读文档生成项目',
      workspace: {
        componentSummary: 'Card, Table',
        files: [],
      },
      _memoryAttachments: [{
        id: 'doc-1',
        kind: 'document',
        name: 'brief.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: 100,
        extractedTextPreview: '会议管理',
        extractedText: [
          '会议管理',
          '',
          '会议列表页面，显示所有会议信息。',
          '',
          '待办事项',
          '',
          '1. 事项清单支持状态筛选、责任人和截止时间。',
          '2. 事项详情展示跟进记录和操作日志。',
        ].join('\n'),
        evidenceSnippets: ['事项清单支持状态筛选、责任人和截止时间。'],
      }],
    } as never);

    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.some((chunk) => chunk.sectionTitle === '会议管理')).toBe(true);
    expect(chunks.some((chunk) => chunk.text.includes('事项清单支持状态筛选'))).toBe(true);
  });

  it('retrieves only the most relevant chunks for the current query', () => {
    const chunks = indexDocumentKnowledge({
      conversationId: 'conv-doc',
      prompt: '阅读文档生成项目',
      workspace: {
        componentSummary: 'Card, Table',
        files: [],
      },
      _memoryAttachments: [{
        id: 'doc-1',
        kind: 'document',
        name: 'brief.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: 100,
        extractedTextPreview: '事项清单',
        extractedText: [
          '事项管理',
          '',
          '事项清单页面支持状态筛选、责任人和截止时间。',
          '',
          '会议管理',
          '',
          '会议列表页面显示会议主题、时间和地点。',
        ].join('\n'),
      }],
    } as never);

    const hits = retrieveDocumentKnowledge(chunks, '事项清单 状态筛选 责任人', 2);

    expect(hits).toHaveLength(1);
    expect(hits[0]?.text).toContain('事项清单页面支持状态筛选');
    expect(formatDocumentKnowledgeHits(hits)).toContain('Attachment: brief.docx');
  });

  it('binds evidence text back to retrieved chunk ids', () => {
    const hits = [{
      id: 'conv:doc-1:0',
      conversationId: 'conv',
      sessionId: 'conv',
      attachmentId: 'doc-1',
      attachmentName: 'brief.docx',
      attachmentKind: 'document' as const,
      chunkIndex: 0,
      text: '事项清单页面支持状态筛选、责任人和截止时间。',
      score: 9,
    }];

    expect(bindEvidenceSourceIds('状态筛选、责任人和截止时间', hits)).toEqual(['conv:doc-1:0']);
  });
});
