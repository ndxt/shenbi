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
});
