import { describe, expect, it } from 'vitest';
import { assembleSchema, buildSkeletonSchema } from './page-schema';
import type { AssembleSchemaInput, PagePlan } from '../types';

function createPlan(): PagePlan {
  return {
    pageTitle: '经营工作台',
    pageType: 'dashboard',
    layout: [
      { blocks: ['header-block'] },
      { columns: [{ span: 16, blocks: ['main-block'] }, { span: 8, blocks: ['side-block'] }] },
    ],
    blocks: [
      {
        id: 'header-block',
        description: '页面标题与概览',
        components: ['Typography.Title', 'Typography.Text'],
        priority: 1,
        complexity: 'simple',
      },
      {
        id: 'main-block',
        description: '主数据区域',
        components: ['Table'],
        priority: 2,
        complexity: 'medium',
      },
      {
        id: 'side-block',
        description: '侧边说明',
        components: ['Card'],
        priority: 3,
        complexity: 'simple',
      },
    ],
  };
}

describe('page-schema', () => {
  it('builds a skeleton schema with a dedicated header shell when the first block is a header block', () => {
    const schema = buildSkeletonSchema(createPlan());
    const root = schema.body[0];

    expect(root?.id).toBe('page-root');
    expect(Array.isArray(root?.children)).toBe(true);
    expect(root && Array.isArray(root.children) ? root.children.map((child) => child.id) : []).toEqual([
      'page-header-shell',
      'page-content-shell',
    ]);
  });

  it('assembles generated blocks into the planned layout', () => {
    const input: AssembleSchemaInput = {
      plan: createPlan(),
      request: {
        prompt: '创建经营工作台',
        context: {
          schemaSummary: 'empty',
          componentSummary: 'Card, Table',
        },
      },
      blocks: [
        { blockId: 'header-block', node: { id: 'header-card', component: 'Card' } },
        { blockId: 'main-block', node: { id: 'main-table', component: 'Table' } },
        { blockId: 'side-block', node: { id: 'side-card', component: 'Card' } },
      ],
    };

    const schema = assembleSchema(input);
    const root = schema.body[0];
    const contentShell = root && Array.isArray(root.children) ? root.children[1] : undefined;
    const contentRow = contentShell && Array.isArray(contentShell.children) ? contentShell.children[0] : undefined;

    expect(contentRow?.component).toBe('Row');
    expect(Array.isArray(contentRow?.children)).toBe(true);
    expect(contentRow && Array.isArray(contentRow.children) ? contentRow.children.map((child) => child.component) : []).toEqual([
      'Col',
      'Col',
    ]);
  });
});
