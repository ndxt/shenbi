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

  it('throws when action or action input is missing', () => {
    expect(() => parseReActResponse('Action Input: {}')).toThrow('Missing Action field');
    expect(() => parseReActResponse('Action: finish')).toThrow('Missing Action Input field');
  });
});
