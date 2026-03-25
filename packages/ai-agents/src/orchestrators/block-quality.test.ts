import { describe, expect, it } from 'vitest';
import type { GenerateBlockInput, GenerateBlockResult } from '../types';
import {
  assessBlockQuality,
  isMasterDetailPrompt,
  shouldUseRetryResult,
} from './block-quality';

function createInput(overrides: Partial<GenerateBlockInput> = {}): GenerateBlockInput {
  return {
    block: {
      id: 'filter-block',
      description: '筛选栏',
      components: ['Form', 'Button'],
      priority: 1,
      complexity: 'simple',
    },
    request: {
      prompt: '创建一个页面',
      context: {
        schemaSummary: 'empty',
        componentSummary: 'Form, Button',
      },
    },
    context: {
      prompt: '创建一个页面',
      document: {
        exists: false,
        summary: 'empty',
      },
      componentSummary: 'Form, Button',
      conversation: {
        history: [],
        turnCount: 0,
      },
      lastBlockIds: [],
    },
    ...overrides,
  };
}

function createNode(node: GenerateBlockResult['node']): GenerateBlockResult['node'] {
  return node;
}

describe('block-quality', () => {
  it('flags textless filter buttons as retry-worthy diagnostics', () => {
    const diagnostics = assessBlockQuality(
      createNode({
        id: 'filter-root',
        component: 'Form',
        children: [
          {
            id: 'search-button',
            component: 'Button',
            props: {
              type: 'primary',
            },
          },
        ],
      }),
      createInput(),
    );

    expect(diagnostics).toEqual([
      expect.objectContaining({
        rule: 'button-missing-text',
        severity: 'retry',
        componentType: 'Button',
      }),
    ]);
  });

  it('prefers the retry result only when its diagnostics score is lower', () => {
    expect(shouldUseRetryResult(
      [
        { blockId: 'block-1', rule: 'a', message: 'a', severity: 'retry' },
        { blockId: 'block-1', rule: 'b', message: 'b', severity: 'warn' },
      ],
      [
        { blockId: 'block-1', rule: 'c', message: 'c', severity: 'warn' },
      ],
    )).toBe(true);

    expect(shouldUseRetryResult(
      [{ blockId: 'block-1', rule: 'a', message: 'a', severity: 'warn' }],
      [{ blockId: 'block-1', rule: 'b', message: 'b', severity: 'retry' }],
    )).toBe(false);
  });

  it('detects master-detail prompts for follow-up layout guidance', () => {
    expect(isMasterDetailPrompt('左侧列表，右侧 tabs 展示详情和趋势')).toBe(true);
    expect(isMasterDetailPrompt('创建一个普通表单页面')).toBe(false);
  });
});
