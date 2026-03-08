import { describe, expect, it } from 'vitest';
import type { SchemaNode } from '@shenbi/schema';
import { normalizeGeneratedNode } from './normalize-schema.ts';

describe('normalizeGeneratedNode', () => {
  it('maps html tags to supported components', () => {
    const node: SchemaNode = {
      component: 'div',
      children: [
        { component: 'span', children: 'hello' },
      ],
    };

    const normalized = normalizeGeneratedNode(node);
    expect(normalized.component).toBe('Container');
    expect(Array.isArray(normalized.children)).toBe(true);
    const child = (normalized.children as SchemaNode[])[0];
    expect(child?.component).toBe('Typography.Text');
  });

  it('drops children for none-children components', () => {
    const node: SchemaNode = {
      component: 'Alert',
      children: [{ component: 'Button', children: 'x' }],
    };

    const normalized = normalizeGeneratedNode(node);
    expect(normalized.children).toBeUndefined();
  });

  it('normalizes typography children to text safely', () => {
    const node: SchemaNode = {
      component: 'Typography.Title',
      props: {
        title: { component: 'span', children: '标题' } as unknown as string,
      },
      children: [{ component: 'Button', children: 'bad' }],
    };

    const normalized = normalizeGeneratedNode(node);
    expect(normalized.children).toBe('bad');
  });

  it('moves table props.columns into node.columns and strips object renderers', () => {
    const node: SchemaNode = {
      component: 'Table',
      props: {
        columns: [
          {
            title: { component: 'Typography.Text', children: '姓名' },
            render: { component: 'Tag', children: 'bad' },
          },
        ],
      },
    };

    const normalized = normalizeGeneratedNode(node);
    expect(Array.isArray(normalized.columns)).toBe(true);
    expect(normalized.props?.columns).toBeUndefined();
    expect(normalized.columns?.[0]?.title).toBe('姓名');
    expect(normalized.columns?.[0]?.render).toBeUndefined();
  });

  it('sanitizes unsafe table pagination callbacks', () => {
    const node: SchemaNode = {
      component: 'Table',
      props: {
        pagination: {
          showTotal: { component: 'Typography.Text', children: '总数' },
          itemRender: { component: 'Button', children: '页码' },
          showQuickJumper: {
            goButton: { component: 'Button', children: '跳转' },
          },
        },
      },
    };

    const normalized = normalizeGeneratedNode(node);
    const pagination = normalized.props?.pagination as Record<string, unknown> | undefined;
    expect(pagination?.showTotal).toBeUndefined();
    expect(pagination?.itemRender).toBeUndefined();
    expect(
      pagination?.showQuickJumper
      && typeof pagination.showQuickJumper === 'object'
      && !Array.isArray(pagination.showQuickJumper)
        ? (pagination.showQuickJumper as Record<string, unknown>).goButton
        : undefined,
    ).toBeUndefined();
  });

  it('normalizes breadcrumb items and drops unsafe breadcrumb props', () => {
    const node: SchemaNode = {
      component: 'Breadcrumb',
      props: {
        separator: { component: 'Typography.Text', children: '>' },
        itemRender: { component: 'Button', children: 'bad' } as any,
        items: [
          { title: { component: 'Typography.Text', children: '员工管理' } },
          { title: ['员工详情'] },
        ],
      },
    };

    const normalized = normalizeGeneratedNode(node);
    expect(normalized.props?.separator).toBe('>');
    expect(normalized.props?.itemRender).toBeUndefined();
    expect(Array.isArray(normalized.props?.items)).toBe(true);
    const items = normalized.props?.items as Array<Record<string, unknown>>;
    expect(items[0]?.title).toBe('员工管理');
    expect(items[1]?.title).toBe('员工详情');
  });

  it('builds breadcrumb items from text children when items are missing', () => {
    const node: SchemaNode = {
      component: 'Breadcrumb',
      children: ['员工管理', '员工详情'],
    };

    const normalized = normalizeGeneratedNode(node);
    expect(normalized.children).toBeUndefined();
    expect(Array.isArray(normalized.props?.items)).toBe(true);
    const items = normalized.props?.items as Array<Record<string, unknown>>;
    expect(items.map((item) => item.title)).toEqual(['员工管理', '员工详情']);
  });

  it('normalizes steps items and drops unsafe step props', () => {
    const node: SchemaNode = {
      component: 'Steps',
      props: {
        progressDot: { component: 'Button', children: 'bad' } as any,
        items: [
          {
            title: { component: 'Typography.Text', children: '提交申请' },
            description: ['员工发起申请'],
            icon: { component: 'Tag', children: 'bad' },
          },
        ],
      },
    };

    const normalized = normalizeGeneratedNode(node);
    expect(normalized.props?.progressDot).toBeUndefined();
    expect(Array.isArray(normalized.props?.items)).toBe(true);
    const items = normalized.props?.items as Array<Record<string, unknown>>;
    expect(items[0]?.title).toBe('提交申请');
    expect(items[0]?.description).toBe('员工发起申请');
    expect(items[0]?.icon).toBeUndefined();
  });

  it('drops unsafe progress formatter props', () => {
    const node: SchemaNode = {
      component: 'Progress',
      props: {
        percent: 80,
        format: { component: 'Typography.Text', children: '80%' } as any,
        success: {
          percent: 60,
          format: { component: 'Typography.Text', children: 'done' },
          strokeColor: { bad: true },
        },
      },
    };

    const normalized = normalizeGeneratedNode(node);
    expect(normalized.props?.format).toBeUndefined();
    const success = normalized.props?.success as Record<string, unknown> | undefined;
    expect(success?.format).toBeUndefined();
    expect(success?.strokeColor).toBeUndefined();
  });

  it('normalizes avatar text and strips unsafe avatar icon', () => {
    const node: SchemaNode = {
      component: 'Avatar',
      props: {
        icon: { component: 'Tag', children: 'bad' } as any,
      },
      children: ['张三丰'],
    };

    const normalized = normalizeGeneratedNode(node);
    expect(normalized.props?.icon).toBeUndefined();
    expect(normalized.children).toBe('张三');
  });

  it('wraps avatar group children into avatars', () => {
    const node: SchemaNode = {
      component: 'Avatar.Group',
      children: ['张三', { component: 'Avatar', children: '李四' }],
    };

    const normalized = normalizeGeneratedNode(node);
    expect(Array.isArray(normalized.children)).toBe(true);
    const children = normalized.children as SchemaNode[];
    expect(children[0]?.component).toBe('Avatar');
    expect(children[1]?.component).toBe('Avatar');
  });

  it('normalizes badge and result text props safely', () => {
    const node: SchemaNode = {
      component: 'Result',
      props: {
        title: { component: 'Typography.Text', children: '成功' } as any,
        subTitle: [{ component: 'Typography.Text', children: '已保存' }] as any,
        icon: { component: 'Tag', children: 'bad' } as any,
        extra: { component: 'Button', children: '返回' } as any,
      },
    };

    const normalized = normalizeGeneratedNode(node);
    expect(normalized.props?.title).toBe('成功');
    expect(normalized.props?.subTitle).toBe('已保存');
    expect(normalized.props?.icon).toBeUndefined();
    expect(normalized.props?.extra).toBeDefined();
  });

  it('normalizes badge text and empty image safely', () => {
    const badgeNode: SchemaNode = {
      component: 'Badge',
      props: {
        text: { component: 'Typography.Text', children: '审批中' } as any,
        count: [{ component: 'Typography.Text', children: '8' }] as any,
      },
      children: [{ component: 'Button', children: '查看' }],
    };

    const normalizedBadge = normalizeGeneratedNode(badgeNode);
    expect(normalizedBadge.props?.text).toBe('审批中');
    expect(normalizedBadge.props?.count).toBe('8');

    const emptyNode: SchemaNode = {
      component: 'Empty',
      props: {
        image: { component: 'Typography.Text', children: 'bad' } as any,
        description: { component: 'Typography.Text', children: '暂无数据' } as any,
      },
    };
    const normalizedEmpty = normalizeGeneratedNode(emptyNode);
    expect(normalizedEmpty.props?.image).toBeUndefined();
    expect(normalizedEmpty.props?.description).toBe('暂无数据');
  });

  it('wraps row children into cols', () => {
    const node: SchemaNode = {
      component: 'Row',
      children: [{ component: 'Card', children: 'KPI' }],
    };

    const normalized = normalizeGeneratedNode(node);
    const child = Array.isArray(normalized.children) ? normalized.children[0] : undefined;
    expect(child && typeof child === 'object' && 'component' in child ? child.component : undefined).toBe('Col');
  });

  it('wraps form children into FormItem and keeps Form.Item alias', () => {
    const node: SchemaNode = {
      component: 'Form',
      children: [
        { component: 'Input', props: { placeholder: '姓名' } },
        { component: 'Form.Item', children: [{ component: 'Input' }] },
      ],
    };

    const normalized = normalizeGeneratedNode(node);
    expect(Array.isArray(normalized.children)).toBe(true);
    const children = normalized.children as SchemaNode[];
    expect(children[0]?.component).toBe('FormItem');
    expect(children[1]?.component).toBe('FormItem');
  });

  it('wraps descriptions children into descriptions items', () => {
    const node: SchemaNode = {
      component: 'Descriptions',
      children: ['张三'],
    };

    const normalized = normalizeGeneratedNode(node);
    const item = Array.isArray(normalized.children) ? normalized.children[0] : undefined;
    expect(item && typeof item === 'object' && 'component' in item ? item.component : undefined).toBe('Descriptions.Item');
  });

  it('drops descriptions.items to force child rendering', () => {
    const node: SchemaNode = {
      component: 'Descriptions',
      props: {
        column: 2,
        items: [{ label: '姓名', children: '张明' }] as any,
      },
      children: [
        {
          component: 'Descriptions.Item',
          props: { label: '姓名' },
          children: ['张明'],
        },
      ],
    };

    const normalized = normalizeGeneratedNode(node);
    expect(normalized.props?.items).toBeUndefined();
    expect(Array.isArray(normalized.children)).toBe(true);
  });

  it('preserves mixed children by converting text into Typography.Text nodes', () => {
    const node: SchemaNode = {
      component: 'Container',
      children: [
        { component: 'Button', children: '查询' },
        '辅助说明',
      ],
    };

    const normalized = normalizeGeneratedNode(node);
    expect(Array.isArray(normalized.children)).toBe(true);
    const children = normalized.children as SchemaNode[];
    expect(children).toHaveLength(2);
    expect(children[1]?.component).toBe('Typography.Text');
  });

  it('deduplicates repeated node ids recursively', () => {
    const node: SchemaNode = {
      id: 'employee-detail-layout',
      component: 'Container',
      children: [
        {
          id: 'employee-detail-layout',
          component: 'Card',
          children: [
            { id: 'employee-detail-layout', component: 'Typography.Text', children: 'A' },
          ],
        },
        {
          id: 'employee-detail-layout',
          component: 'Card',
          children: 'B',
        },
      ],
    };

    const normalized = normalizeGeneratedNode(node);
    const children = normalized.children as SchemaNode[];
    expect(normalized.id).toBe('employee-detail-layout');
    expect(children[0]?.id).toBe('employee-detail-layout-2');
    expect(children[1]?.id).toBe('employee-detail-layout-3');
    const grandchild = children[0]?.children as SchemaNode[];
    expect(grandchild[0]?.id).toBeTruthy();
    const ids = [
      normalized.id,
      children[0]?.id,
      children[1]?.id,
      grandchild[0]?.id,
    ].filter((id): id is string => typeof id === 'string');
    expect(new Set(ids).size).toBe(ids.length);
  });
});
