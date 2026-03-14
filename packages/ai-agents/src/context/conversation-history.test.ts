import { describe, expect, it } from 'vitest';
import { createSchemaDigest } from '@shenbi/ai-contracts';
import type { AgentMemoryMessage } from '../types';
import { formatConversationHistory } from './conversation-history';

const currentSchema = { id: 'page', body: [] };

const historyMessages: AgentMemoryMessage[] = [
  {
    role: 'user',
    text: '帮我做一个用户管理页面',
    attachments: [
      {
        id: 'img-1',
        kind: 'image',
        name: 'wireframe.png',
        mimeType: 'image/png',
        sizeBytes: 4096,
      },
      {
        id: 'doc-1',
        kind: 'document',
        name: '需求说明.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 8192,
        extractedTextPreview: '用户管理模块需要包含搜索、表格和侧边详情。',
      },
    ],
  },
  {
    role: 'assistant',
    text: '已生成用户管理页面，包含搜索表单和用户数据表格。',
    meta: {
      schemaDigest: createSchemaDigest(currentSchema),
      operations: [{ op: 'schema.replace', schema: { id: 'page', body: [] } }],
    },
  },
  { role: 'user', text: '表格加一列操作' },
  {
    role: 'assistant',
    text: '已在表格末尾添加操作列。',
    meta: {
      schemaDigest: createSchemaDigest(currentSchema),
      operations: [{ op: 'schema.patchColumns', nodeId: 'table-1', columns: [{ title: '操作' }] }],
    },
  },
];

describe('formatConversationHistory', () => {
  it('formats recent conversation turns with operation summaries', () => {
    const output = formatConversationHistory(historyMessages);

    expect(output).toContain('[对话历史 - 共 2 轮]');
    expect(output).toContain('用户: 帮我做一个用户管理页面');
    expect(output).toContain('[附件: 图片: wireframe.png (image/png, 4 KB)]');
    expect(output).toContain('[文档摘要: 用户管理模块需要包含搜索、表格和侧边详情。]');
    expect(output).toContain('助手: 已在表格末尾添加操作列。');
    expect(output).toContain('[执行: schema.patchColumns(table-1)]');
    expect(output).toContain('[执行: schema.replace -> full page]');
  });

  it('respects maxTurns and can omit operation summaries', () => {
    const output = formatConversationHistory(historyMessages, {
      maxTurns: 1,
      includeOperations: false,
      maxCharsPerTurn: 6,
    });

    expect(output).toContain('[对话历史 - 共 1 轮]');
    expect(output).toContain('用户: 表格加...');
    expect(output).not.toContain('[执行:');
  });

  it('omits stale operation summaries when schema digest no longer matches', () => {
    const output = formatConversationHistory([
      ...historyMessages.slice(0, 3),
      {
        role: 'assistant',
        text: '已在表格末尾添加操作列。',
        meta: {
          schemaDigest: 'fnv1a-deadbeef',
          operations: [{ op: 'schema.patchColumns', nodeId: 'table-1', columns: [{ title: '操作' }] }],
        },
      },
    ], {
      schemaDigest: createSchemaDigest(currentSchema),
    });

    expect(output).not.toContain('[执行: schema.patchColumns(table-1)]');
  });
});
