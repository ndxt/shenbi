import { describe, expect, it } from 'vitest';
import { buildInsertNodePromptSpec } from './modify-node-generation';

describe('modify-node-generation', () => {
  it('builds insert-node prompt text for parent insertions', () => {
    const prompt = buildInsertNodePromptSpec({
      skeleton: {
        op: 'schema.insertNode',
        parentId: 'card-1',
        index: 0,
        description: '插入一个主要操作按钮',
        components: ['Button'],
      },
      documentTree: 'Card#card-1',
      componentContracts: 'Component: Button\nschema-example: {"component":"Button"}',
    });

    expect(prompt.systemText).toContain('## Component Contracts');
    expect(prompt.systemText).toContain('Component: Button');
    expect(prompt.systemText).toContain('schema-example');
    expect(prompt.userLines).toEqual([
      'Task: 插入一个主要操作按钮',
      'Parent node: card-1',
      'Insert position: index=0',
      '',
      'Schema Tree (for context):',
      'Card#card-1',
    ]);
  });

  it('falls back to root append messaging when parent and index are omitted', () => {
    const prompt = buildInsertNodePromptSpec({
      skeleton: {
        op: 'schema.insertNode',
        container: 'body',
        description: '追加一个概览卡片',
        components: ['Card'],
      },
      componentContracts: 'Component: Card',
    });

    expect(prompt.userLines).toEqual([
      'Task: 追加一个概览卡片',
      'Container: body (root level)',
      'Append at end',
      '',
      'Schema Tree (for context):',
      '',
    ]);
  });
});
