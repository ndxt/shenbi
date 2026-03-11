import { describe, expect, it } from 'vitest';
import type { PageSchema } from '@shenbi/schema';
import { createSchemaDigest } from '@shenbi/ai-contracts';
import type { BuildContextInput } from '../types';
import { buildRuntimeContext } from './build-context';

const schema: PageSchema = {
  id: 'page-1',
  name: 'Users',
  body: [
    {
      id: 'card-1',
      component: 'Card',
      props: { title: '用户统计' },
    },
  ],
};

function createInput(): BuildContextInput {
  return {
    request: {
      prompt: '把标题改成活跃用户',
      selectedNodeId: 'card-1',
      context: {
        schemaSummary: 'pageId=page-1; nodeCount=1',
        componentSummary: 'Card',
        schemaJson: schema,
        workspaceFileIds: ['page-1.json'],
      },
    },
    conversation: [
      { role: 'user', text: '生成一个用户页面' },
      {
        role: 'assistant',
        text: '已生成用户页面。',
        meta: {
          schemaDigest: createSchemaDigest(schema),
          operations: [{ op: 'schema.replace', schema }],
        },
      },
      { role: 'user', text: '再给我加一个统计卡片' },
      {
        role: 'assistant',
        text: '已添加统计卡片。',
        meta: {
          schemaDigest: createSchemaDigest(schema),
          operations: [{ op: 'schema.patchProps', nodeId: 'card-1', patch: { title: '活跃用户' } }],
        },
      },
    ],
    lastRunMetadata: { sessionId: 'session-1' },
    lastBlockIds: ['hero'],
  };
}

describe('buildRuntimeContext', () => {
  it('builds structured document and conversation context', () => {
    const context = buildRuntimeContext(createInput());

    expect(context.prompt).toBe('把标题改成活跃用户');
    expect(context.selectedNodeId).toBe('card-1');
    expect(context.document.exists).toBe(true);
    expect(context.document.summary).toContain('pageId=page-1');
    expect(context.document.schema).toEqual(schema);
    expect(context.document.schemaDigest).toBe(createSchemaDigest(schema));
    expect(context.document.tree).toContain('Card#card-1(title="用户统计")');
    expect(context.componentSummary).toBe('Card');
    expect(context.conversation.turnCount).toBe(2);
    expect(context.conversation.history).toHaveLength(4);
    expect(context.conversation.lastOperations).toEqual([
      { op: 'schema.patchProps', nodeId: 'card-1', patch: { title: '活跃用户' } },
    ]);
    expect(context.lastBlockIds).toEqual(['hero']);
  });

  it('treats empty schemas as document missing for routing heuristics', () => {
    const context = buildRuntimeContext({
      ...createInput(),
      request: {
        ...createInput().request,
        context: {
          schemaSummary: 'empty page; nodeCount=0',
          componentSummary: 'Card',
          schemaJson: {
            id: 'page-empty',
            body: [],
          },
        },
      },
    });

    expect(context.document.exists).toBe(false);
  });

  it('ignores stale operation history when schema digest no longer matches', () => {
    const context = buildRuntimeContext({
      ...createInput(),
      conversation: [
        { role: 'user', text: '把标题改成活跃用户' },
        {
          role: 'assistant',
          text: '已修改标题。',
          meta: {
            schemaDigest: 'fnv1a-deadbeef',
            operations: [{ op: 'schema.patchProps', nodeId: 'card-1', patch: { title: '活跃用户' } }],
          },
        },
      ],
    });

    expect(context.conversation.lastOperations).toBeUndefined();
  });
});
