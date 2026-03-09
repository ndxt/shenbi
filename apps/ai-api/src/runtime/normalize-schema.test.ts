import { describe, expect, it } from 'vitest';
import type { SchemaNode } from '@shenbi/schema';
import { normalizeGeneratedNode, normalizeGeneratedNodeWithDiagnostics } from './normalize-schema.ts';

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

  it('keeps alert message and maps legacy title to message', () => {
    const messageNode = normalizeGeneratedNode({
      component: 'Alert',
      props: {
        type: 'info',
        message: ['当前条件下暂无记录'],
      },
    });
    const titleNode = normalizeGeneratedNode({
      component: 'Alert',
      props: {
        type: 'warning',
        title: '旧版标题提示',
      },
    });

    expect(messageNode.props?.message).toBe('当前条件下暂无记录');
    expect(messageNode.props?.title).toBeUndefined();
    expect(titleNode.props?.message).toBe('旧版标题提示');
    expect(titleNode.props?.title).toBeUndefined();
  });

  it('migrates legacy props.children into top-level children', () => {
    const migrated = normalizeGeneratedNode({
      component: 'Button',
      props: {
        type: 'primary',
        children: ['查询'],
      },
    });
    const keepsTopLevel = normalizeGeneratedNode({
      component: 'Button',
      props: {
        children: ['错误文本'],
      },
      children: ['保留顶层'],
    });

    expect(migrated.children).toBe('查询');
    expect((migrated.props as Record<string, unknown>).children).toBeUndefined();
    expect(keepsTopLevel.children).toBe('保留顶层');
    expect((keepsTopLevel.props as Record<string, unknown>).children).toBeUndefined();
  });

  it('preserves low-risk button style props without recording unknown prop diagnostics', () => {
    const result = normalizeGeneratedNodeWithDiagnostics({
      component: 'Button',
      props: {
        type: 'text',
        block: true,
        style: {
          textAlign: 'left',
          padding: '8px 12px',
        },
      },
      children: ['查看详情'],
    });

    expect(result.node.props?.style).toEqual({
      textAlign: 'left',
      padding: '8px 12px',
    });
    expect(result.diagnostics).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        componentType: 'Button',
        propPath: 'style',
        action: 'drop',
      }),
    ]));
  });

  it('keeps layout containers directly under Form without generating fake form labels', () => {
    const normalized = normalizeGeneratedNode({
      component: 'Form',
      id: 'filter-form',
      props: { layout: 'vertical' },
      children: [
        {
          component: 'Container',
          id: 'fields-wrap',
          props: { direction: 'row', gap: 16 },
          children: [{
            component: 'Form.Item',
            id: 'keyword-item',
            props: { label: '关键词', name: 'keyword' },
            children: [{ component: 'Input', id: 'keyword-input', props: { placeholder: '请输入关键词' } }],
          }],
        },
        {
          component: 'Container',
          id: 'actions-wrap',
          props: { direction: 'row' },
          children: [{
            component: 'Space',
            id: 'actions-space',
            props: { size: 'small' },
            children: [{ component: 'Button', id: 'search-btn', props: { type: 'primary' }, children: '查询' }],
          }],
        },
      ],
    });

    expect(Array.isArray(normalized.children)).toBe(true);
    const formChildren = normalized.children as SchemaNode[];
    expect(formChildren[0]?.component).toBe('Container');
    expect(formChildren[1]?.component).toBe('Container');
    expect(formChildren.some((child) => child.component === 'Form.Item' && child.props?.label === '字段1')).toBe(false);
    expect(formChildren.some((child) => child.component === 'Form.Item' && child.props?.label === '字段2')).toBe(false);
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

  it('drops invalid standalone pagination function props and records diagnostics', () => {
    const result = normalizeGeneratedNodeWithDiagnostics({
      component: 'Pagination',
      props: {
        current: 1,
        total: 120,
        showTotal: '(total) => `共 ${total} 条`',
      },
    });

    expect(result.node.props?.showTotal).toBeUndefined();
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        componentType: 'Pagination',
        propPath: 'showTotal',
        action: 'drop',
      }),
    ]));
  });

  it('keeps JSFunction values for standalone pagination and nested table pagination', () => {
    const functionValue = {
      type: 'JSFunction',
      params: ['total', 'range'],
      body: 'return `共 ${total} 条`;',
    };
    const paginationNode = normalizeGeneratedNode({
      component: 'Pagination',
      props: {
        showTotal: functionValue,
      },
    });
    const tableNode = normalizeGeneratedNode({
      component: 'Table',
      props: {
        pagination: {
          showTotal: functionValue,
        },
      },
    });

    expect(paginationNode.props?.showTotal).toEqual(functionValue);
    expect((tableNode.props?.pagination as Record<string, unknown> | undefined)?.showTotal).toEqual(functionValue);
  });

  it('drops unknown table props and records diagnostics', () => {
    const result = normalizeGeneratedNodeWithDiagnostics({
      component: 'Table',
      props: {
        title: '订单列表',
        dataSource: [],
      },
    });

    expect(result.node.props?.title).toBeUndefined();
    expect(result.node.props?.dataSource).toEqual([]);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        componentType: 'Table',
        propPath: 'title',
        action: 'drop',
        rule: 'unknown prop',
      }),
    ]));
  });

  it('preserves table pagination=false via union contract', () => {
    const normalized = normalizeGeneratedNode({
      component: 'Table',
      props: {
        pagination: false,
      },
    });

    expect(normalized.props?.pagination).toBe(false);
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

  it('keeps JSFunction-based formatter props for breadcrumb, progress, and statistic', () => {
    const functionValue = {
      type: 'JSFunction',
      params: ['value'],
      body: 'return `${value}`;',
    };
    const breadcrumb = normalizeGeneratedNode({
      component: 'Breadcrumb',
      props: {
        itemRender: {
          type: 'JSFunction',
          params: ['currentRoute'],
          body: 'return currentRoute?.title ?? "";',
        },
      },
    });
    const progress = normalizeGeneratedNode({
      component: 'Progress',
      props: {
        percent: 80,
        format: functionValue,
      },
    });
    const statistic = normalizeGeneratedNode({
      component: 'Statistic',
      props: {
        title: '完成率',
        formatter: functionValue,
      },
    });

    expect(breadcrumb.props?.itemRender).toEqual({
      type: 'JSFunction',
      params: ['currentRoute'],
      body: 'return currentRoute?.title ?? "";',
    });
    expect(progress.props?.format).toEqual(functionValue);
    expect(statistic.props?.formatter).toEqual(functionValue);
    expect(statistic.props?.title).toBe('完成率');
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

  it('wraps form children into Form.Item and keeps original props', () => {
    const node: SchemaNode = {
      component: 'Form',
      children: [
        { component: 'Input', props: { placeholder: '姓名' } },
        { component: 'Form.Item', props: { label: '邮箱', name: 'email' }, children: [{ component: 'Input' }] },
      ],
    };

    const normalized = normalizeGeneratedNode(node);
    expect(Array.isArray(normalized.children)).toBe(true);
    const children = normalized.children as SchemaNode[];
    expect(children[0]?.component).toBe('Form.Item');
    expect(children[1]?.component).toBe('Form.Item');
    expect(children[1]?.props?.label).toBe('邮箱');
    expect(children[1]?.props?.name).toBe('email');
  });

  it('maps FormItem alias to Form.Item', () => {
    const normalized = normalizeGeneratedNode({
      component: 'FormItem',
      props: { label: '姓名', name: 'name' },
      children: [{ component: 'Input' }],
    });

    expect(normalized.component).toBe('Form.Item');
    expect(Array.isArray(normalized.children)).toBe(true);
  });

  it('keeps DatePicker.RangePicker as a supported component', () => {
    const normalized = normalizeGeneratedNode({
      component: 'DatePicker.RangePicker',
      props: { allowClear: true },
    });

    expect(normalized.component).toBe('DatePicker.RangePicker');
  });

  it('preserves Tabs.TabPane children for later items conversion', () => {
    const normalized = normalizeGeneratedNode({
      component: 'Tabs',
      children: [
        {
          component: 'Tabs.TabPane',
          props: { key: 'orders', tab: '订单列表' },
          children: [{ component: 'Table', props: { dataSource: [] }, columns: [] }],
        },
      ],
    });

    expect(Array.isArray(normalized.children)).toBe(true);
    const tabsChildren = normalized.children as SchemaNode[];
    expect(tabsChildren[0]?.component).toBe('Tabs.TabPane');
    expect(tabsChildren[0]?.props?.label).toBe('订单列表');
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
    expect(children[1]?.id).toMatch(/^employee-detail-layout-\d+$/);
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
