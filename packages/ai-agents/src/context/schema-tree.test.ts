import { describe, expect, it } from 'vitest';
import type { PageSchema } from '@shenbi/schema';
import { serializeSchemaTree } from './schema-tree';

function createSchema(): PageSchema {
  return {
    id: 'page-1',
    name: 'User Dashboard',
    state: {
      total: { type: 'number' },
      users: { default: [] },
    },
    body: [
      {
        id: 'row-1',
        component: 'Row',
        children: [
          {
            id: 'col-1',
            component: 'Col',
            props: { span: 12 },
            children: [
              {
                id: 'card-1',
                component: 'Card',
                props: { title: '用户统计' },
                children: [
                  {
                    id: 'stat-1',
                    component: 'Statistic',
                    props: { title: '总用户数', value: '{{state.total}}' },
                  },
                ],
              },
            ],
          },
          {
            id: 'col-2',
            component: 'Col',
            props: { span: 12 },
            children: [
              {
                id: 'table-1',
                component: 'Table',
                props: {
                  dataSource: '{{state.users}}',
                  columns: [{ title: '姓名' }, { title: '年龄' }],
                },
              },
            ],
          },
        ],
      },
    ],
    dialogs: [
      {
        id: 'modal-1',
        component: 'Modal',
        props: { title: '编辑用户' },
        children: [
          {
            id: 'form-1',
            component: 'Form',
            children: [
              {
                id: 'fi-1',
                component: 'Form.Item',
                props: { label: '姓名', name: 'name' },
                children: [{ id: 'input-1', component: 'Input' }],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('serializeSchemaTree', () => {
  it('serializes body, dialogs, and state with key props', () => {
    const tree = serializeSchemaTree(createSchema());

    expect(tree).toContain('[body]');
    expect(tree).toContain('Card#card-1(title="用户统计")');
    expect(tree).toContain('Statistic#stat-1(title="总用户数", value="{{state.total}}")');
    expect(tree).toContain('Table#table-1(columns=["姓名", "年龄"], dataSource="{{state.users}}")');
    expect(tree).toContain('[dialogs]');
    expect(tree).toContain('Form.Item#fi-1(label="姓名", name="name") -> Input#input-1');
    expect(tree).toContain('[state]');
    expect(tree).toContain('  total: number');
    expect(tree).toContain('  users: array');
  });

  it('folds deep nodes when maxDepth is reached', () => {
    const schema: PageSchema = {
      id: 'deep-page',
      body: {
        id: 'root',
        component: 'Container',
        children: [
          {
            id: 'nested-1',
            component: 'Container',
            children: [
              {
                id: 'nested-2',
                component: 'Container',
                children: [{ id: 'leaf', component: 'Text' }],
              },
            ],
          },
        ],
      },
    };

    const tree = serializeSchemaTree(schema, { maxDepth: 1, maxNodes: 20 });

    expect(tree).toContain('Container#root');
    expect(tree).toContain('  Container#nested-1');
    expect(tree).toContain('    -> 1 children');
  });
});
