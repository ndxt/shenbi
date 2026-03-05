import { describe, expect, it } from 'vitest';
import type { PageSchema } from '@shenbi/schema';
import {
  getSchemaNodeByTreeId,
  getTreeIdBySchemaNodeId,
  patchSchemaNodeColumns,
  patchSchemaNodeEvents,
  patchSchemaNodeLogic,
  patchSchemaNodeStyle,
} from './schema-editor';

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

  it('能回写 style，且支持清空 style', () => {
    const schema = createSchema();
    const withStyle = patchSchemaNodeStyle(schema, 'body.children.0', {
      style: { display: 'none' },
    });
    expect(getSchemaNodeByTreeId(withStyle, 'body.children.0')?.style).toEqual({ display: 'none' });

    const cleared = patchSchemaNodeStyle(withStyle, 'body.children.0', { style: null });
    expect(getSchemaNodeByTreeId(cleared, 'body.children.0')?.style).toBeUndefined();
  });

  it('能回写 logic 字段 if/show/loop', () => {
    const schema = createSchema();
    const next = patchSchemaNodeLogic(schema, 'body.children.0', {
      if: '{{false}}',
      show: '{{state.visible}}',
      loop: { data: '{{state.list}}', itemKey: 'item', indexKey: 'index' },
    });
    const node = getSchemaNodeByTreeId(next, 'body.children.0');
    expect(node?.if).toBe('{{false}}');
    expect(node?.show).toBe('{{state.visible}}');
    expect(node?.loop).toEqual({ data: '{{state.list}}', itemKey: 'item', indexKey: 'index' });
  });

  it('能回写 columns，且支持清空 columns', () => {
    const schema: PageSchema = {
      id: 'table-page',
      name: 'table-page',
      body: {
        id: 'table-node',
        component: 'Table',
        columns: [{ title: '姓名', dataIndex: 'name' }],
      },
    };

    const updated = patchSchemaNodeColumns(schema, 'body', [
      { title: '姓名', dataIndex: 'name', width: 180 },
      { title: '邮箱', dataIndex: 'email' },
    ]);
    expect(getSchemaNodeByTreeId(updated, 'body')?.columns).toEqual([
      { title: '姓名', dataIndex: 'name', width: 180 },
      { title: '邮箱', dataIndex: 'email' },
    ]);

    const cleared = patchSchemaNodeColumns(updated, 'body', null);
    expect(getSchemaNodeByTreeId(cleared, 'body')?.columns).toBeUndefined();
  });
});
