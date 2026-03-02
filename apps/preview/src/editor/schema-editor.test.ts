import { describe, expect, it } from 'vitest';
import type { PageSchema } from '@shenbi/schema';
import { getSchemaNodeByTreeId, getTreeIdBySchemaNodeId, patchSchemaNodeEvents } from './schema-editor';

function createSchema(): PageSchema {
  return {
    id: 'test-page',
    name: 'test-page',
    body: {
      id: 'root',
      component: 'Container',
      children: [
        {
          id: 'submit-btn',
          component: 'Button',
          props: { type: 'primary' },
          events: {
            onClick: [{ type: 'callMethod', name: 'fetchUsers' }],
          },
          children: '查询',
        },
      ],
    },
  };
}

describe('schema-editor/patchSchemaNodeEvents', () => {
  it('能按 treeId 回写事件链', () => {
    const schema = createSchema();
    const next = patchSchemaNodeEvents(schema, 'body.children.0', {
      onClick: [
        { type: 'setState', key: 'keyword', value: 'User 3' },
        { type: 'callMethod', name: 'fetchUsers' },
      ],
    });

    expect(next).not.toBe(schema);
    const node = getSchemaNodeByTreeId(next, 'body.children.0');
    expect(node?.events?.onClick).toEqual([
      { type: 'setState', key: 'keyword', value: 'User 3' },
      { type: 'callMethod', name: 'fetchUsers' },
    ]);
  });

  it('treeId 不存在时返回原 schema', () => {
    const schema = createSchema();
    const next = patchSchemaNodeEvents(schema, 'body.children.99', {
      onClick: [],
    });
    expect(next).toBe(schema);
  });

  it('能通过 schema node id 反查 treeId', () => {
    const schema = createSchema();
    expect(getTreeIdBySchemaNodeId(schema, 'submit-btn')).toBe('body.children.0');
    expect(getTreeIdBySchemaNodeId(schema, 'missing-id')).toBeUndefined();
  });
});
