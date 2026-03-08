import { describe, expect, it, vi } from 'vitest';
import type { ExpressionContext, SchemaNode } from '@shenbi/schema';
import type { ComponentResolver } from '../types/contracts';
import { compileSchema } from './schema';

function createResolver(map: Record<string, any> = {}): ComponentResolver & { __resolve: ReturnType<typeof vi.fn> } {
  const components = { ...map };
  const resolve = vi.fn((componentType: string) => components[componentType] ?? null);
  return {
    __resolve: resolve,
    resolve,
    register(componentType, component) {
      components[componentType] = component;
    },
    registerAll(componentMap) {
      Object.assign(components, componentMap);
    },
    has(componentType) {
      return resolve(componentType) !== null;
    },
  };
}

function createCtx(state: Record<string, any> = {}): ExpressionContext {
  return {
    state,
    params: {},
    computed: {},
    ds: {},
    utils: {},
    refs: {},
  };
}

describe('compiler/schema', () => {
  it('静态节点会把 props 归入 staticProps', () => {
    const resolver = createResolver({ Button: 'button' });
    const schema: SchemaNode = {
      id: 'btn_1',
      component: 'Button',
      props: { type: 'primary', size: 'small' },
      children: '提交',
    };

    const compiled = compileSchema(schema, resolver);
    if (Array.isArray(compiled)) {
      throw new Error('预期编译结果为单节点');
    }

    expect(compiled.componentType).toBe('Button');
    expect(compiled.Component).toBe('button');
    expect(compiled.staticProps).toMatchObject({
      type: 'primary',
      size: 'small',
      children: '提交',
    });
    expect(Object.keys(compiled.dynamicProps)).toHaveLength(0);
  });

  it('动态节点会把表达式 props 归入 dynamicProps', () => {
    const resolver = createResolver({ Button: 'button' });
    const schema: SchemaNode = {
      component: 'Button',
      props: { loading: '{{state.loading}}' },
    };

    const compiled = compileSchema(schema, resolver);
    if (Array.isArray(compiled)) {
      throw new Error('预期编译结果为单节点');
    }

    expect(compiled.dynamicProps.loading).toBeTruthy();
    expect(compiled.dynamicProps.loading?.fn(createCtx({ loading: true }))).toBe(true);
    expect(compiled.allDeps).toContain('state.loading');
  });

  it('混合节点会正确拆分静态和动态 props', () => {
    const resolver = createResolver({ Button: 'button' });
    const schema: SchemaNode = {
      component: 'Button',
      props: {
        type: 'primary',
        disabled: '{{state.disabled}}',
      },
    };

    const compiled = compileSchema(schema, resolver);
    if (Array.isArray(compiled)) {
      throw new Error('预期编译结果为单节点');
    }

    expect(compiled.staticProps.type).toBe('primary');
    expect(compiled.dynamicProps.disabled?.fn(createCtx({ disabled: false }))).toBe(false);
  });

  it('嵌套对象 props 会被整体编译为动态表达式', () => {
    const resolver = createResolver({ Table: 'table' });
    const schema: SchemaNode = {
      component: 'Table',
      props: {
        pagination: {
          current: '{{state.page}}',
          pageSize: 10,
          showTotal: {
            type: 'JSFunction',
            params: ['total'],
            body: 'total + state.offset',
          } as any,
        },
      },
    };

    const compiled = compileSchema(schema, resolver);
    if (Array.isArray(compiled)) {
      throw new Error('预期编译结果为单节点');
    }

    const pagination = compiled.dynamicProps.pagination?.fn(createCtx({ page: 2, offset: 1 }));
    expect(pagination?.current).toBe(2);
    expect(pagination?.pageSize).toBe(10);
    expect(typeof pagination?.showTotal).toBe('function');
    expect(pagination?.showTotal(20)).toBe(21);
  });

  it('全静态嵌套对象 props 保持在 staticProps', () => {
    const resolver = createResolver({ Table: 'table' });
    const schema: SchemaNode = {
      component: 'Table',
      props: {
        pagination: {
          current: 1,
          pageSize: 10,
        },
      },
    };

    const compiled = compileSchema(schema, resolver);
    if (Array.isArray(compiled)) {
      throw new Error('预期编译结果为单节点');
    }

    expect(compiled.staticProps.pagination).toEqual({ current: 1, pageSize: 10 });
    expect(compiled.dynamicProps.pagination).toBeUndefined();
  });

  it('嵌套 children 会递归编译子树', () => {
    const resolver = createResolver({ Container: 'div', Button: 'button' });
    const schema: SchemaNode = {
      component: 'Container',
      children: [
        {
          component: 'Button',
          props: { disabled: '{{state.loading}}' },
        },
      ],
    };

    const compiled = compileSchema(schema, resolver);
    if (Array.isArray(compiled)) {
      throw new Error('预期编译结果为单节点');
    }

    expect(compiled.compiledChildren).toHaveLength(1);
    expect(compiled.compiledChildren?.[0]?.componentType).toBe('Button');
    expect(compiled.compiledChildren?.[0]?.dynamicProps.disabled?.fn(createCtx({ loading: true }))).toBe(
      true,
    );
  });

  it('文本 children 表达式会编译为 childrenFn', () => {
    const resolver = createResolver({ Text: 'span' });
    const schema: SchemaNode = {
      component: 'Text',
      children: '{{state.message}}',
    };

    const compiled = compileSchema(schema, resolver);
    if (Array.isArray(compiled)) {
      throw new Error('预期编译结果为单节点');
    }

    expect(compiled.childrenFn?.fn(createCtx({ message: 'Hello' }))).toBe('Hello');
    expect(compiled.staticProps.children).toBeUndefined();
  });

  it('数组形式的静态文本 children 会保留为 static children', () => {
    const resolver = createResolver({ 'Descriptions.Item': 'div' });
    const schema: SchemaNode = {
      component: 'Descriptions.Item',
      children: ['张明'],
    };

    const compiled = compileSchema(schema, resolver);
    if (Array.isArray(compiled)) {
      throw new Error('预期编译结果为单节点');
    }

    expect(compiled.staticProps.children).toEqual(['张明']);
  });

  it('slots 会按节点与节点数组递归编译', () => {
    const resolver = createResolver({ Card: 'div', Text: 'span', Button: 'button' });
    const schema: SchemaNode = {
      component: 'Card',
      slots: {
        title: { component: 'Text', children: '标题' },
        extra: [{ component: 'Button', children: 'A' }, { component: 'Button', children: 'B' }],
      },
    };

    const compiled = compileSchema(schema, resolver);
    if (Array.isArray(compiled)) {
      throw new Error('预期编译结果为单节点');
    }

    expect(compiled.compiledSlots?.title).toBeTruthy();
    expect(Array.isArray(compiled.compiledSlots?.extra)).toBe(true);
    expect((compiled.compiledSlots?.extra as any[])?.length).toBe(2);
  });

  it('columns 的 render 会编译为 compiledRender 并保留 renderParams', () => {
    const resolver = createResolver({ Table: 'table', Tag: 'span' });
    const schema: SchemaNode = {
      component: 'Table',
      columns: [
        {
          title: '名称',
          dataIndex: 'name',
          render: { component: 'Tag', children: '{{text}}' },
          renderParams: ['text', 'record', 'index'],
        } as any,
      ],
    };

    const compiled = compileSchema(schema, resolver);
    if (Array.isArray(compiled)) {
      throw new Error('预期编译结果为单节点');
    }

    expect(compiled.compiledColumns).toHaveLength(1);
    expect(compiled.compiledColumns?.[0]?.compiledRender?.componentType).toBe('Tag');
    expect(compiled.compiledColumns?.[0]?.renderParams).toEqual(['text', 'record', 'index']);
    expect(compiled.compiledColumns?.[0]?.config.dataIndex).toBe('name');
  });

  it('columns 的 editRender 会编译为 compiledEditRender', () => {
    const resolver = createResolver({ Table: 'table', Input: 'input' });
    const schema: SchemaNode = {
      component: 'Table',
      columns: [
        {
          title: '数量',
          dataIndex: 'count',
          editRender: { component: 'Input', props: { value: '{{record.count}}' } },
        },
      ],
    };

    const compiled = compileSchema(schema, resolver);
    if (Array.isArray(compiled)) {
      throw new Error('预期编译结果为单节点');
    }

    expect(compiled.compiledColumns?.[0]?.compiledEditRender?.componentType).toBe('Input');
  });

  it('columns 的 if 条件会编译为 ifFn', () => {
    const resolver = createResolver({ Table: 'table' });
    const schema: SchemaNode = {
      component: 'Table',
      columns: [
        {
          title: '条件列',
          dataIndex: 'x',
          if: '{{state.showColumn}}',
        },
      ],
    };

    const compiled = compileSchema(schema, resolver);
    if (Array.isArray(compiled)) {
      throw new Error('预期编译结果为单节点');
    }

    expect(compiled.compiledColumns?.[0]?.ifFn?.fn(createCtx({ showColumn: true }))).toBe(true);
  });

  it('loop 会分离为 dataFn/keyFn/body', () => {
    const resolver = createResolver({ Tag: 'span' });
    const schema: SchemaNode = {
      component: 'Tag',
      props: {
        color: '{{item.color}}',
      },
      children: '{{item.label}}',
      loop: {
        data: '{{state.tags}}',
        itemKey: 'item',
        indexKey: 'idx',
        key: '{{item.id}}',
      },
    };

    const compiled = compileSchema(schema, resolver);
    if (Array.isArray(compiled)) {
      throw new Error('预期编译结果为单节点');
    }

    expect(compiled.loop).toBeTruthy();
    expect(compiled.loop?.dataFn.fn(createCtx({ tags: [{ id: 1 }] }))).toEqual([{ id: 1 }]);
    expect(compiled.loop?.keyFn.fn({ ...createCtx(), item: { id: 9 }, idx: 2 })).toBe(9);
    expect(compiled.loop?.body.dynamicProps.color?.fn({ ...createCtx(), item: { color: 'blue' } })).toBe(
      'blue',
    );
    expect(compiled.loop?.body.childrenFn?.fn({ ...createCtx(), item: { label: 'A' } })).toBe('A');
  });

  it('if / show 会分别编译为 ifFn / showFn', () => {
    const resolver = createResolver({ Alert: 'div' });
    const schema: SchemaNode = {
      component: 'Alert',
      if: '{{state.enabled}}',
      show: '{{state.visible}}',
    };

    const compiled = compileSchema(schema, resolver);
    if (Array.isArray(compiled)) {
      throw new Error('预期编译结果为单节点');
    }

    expect(compiled.ifFn?.fn(createCtx({ enabled: true }))).toBe(true);
    expect(compiled.showFn?.fn(createCtx({ visible: false }))).toBe(false);
  });

  it('会调用 resolver.resolve 解析组件', () => {
    const resolver = createResolver({ Container: 'div', Button: 'button' });
    const schema: SchemaNode = {
      component: 'Container',
      children: [{ component: 'Button' }],
    };

    compileSchema(schema, resolver);

    expect(resolver.__resolve).toHaveBeenCalledWith('Container');
    expect(resolver.__resolve).toHaveBeenCalledWith('Button');
  });

  it('未知组件返回 null 且不抛错', () => {
    const resolver = createResolver({});
    const schema: SchemaNode = {
      component: 'UnknownComponent',
    };

    const compiled = compileSchema(schema, resolver);
    if (Array.isArray(compiled)) {
      throw new Error('预期编译结果为单节点');
    }

    expect(compiled.Component).toBeNull();
  });

  it('JSFunction props 会编译为可执行函数', () => {
    const resolver = createResolver({ Table: 'table' });
    const schema: SchemaNode = {
      component: 'Table',
      props: {
        sorter: {
          type: 'JSFunction',
          params: ['a', 'b'],
          body: 'return a.v - b.v + state.offset;',
        } as any,
      },
    };

    const compiled = compileSchema(schema, resolver);
    if (Array.isArray(compiled)) {
      throw new Error('预期编译结果为单节点');
    }

    const sorterFactory = compiled.dynamicProps.sorter?.fn(createCtx({ offset: 1 }));
    expect(typeof sorterFactory).toBe('function');
    expect(sorterFactory?.({ v: 4 }, { v: 2 })).toBe(3);
  });

  it('allDeps 会聚合所有子表达式依赖并去重', () => {
    const resolver = createResolver({
      Container: 'div',
      Button: 'button',
      Text: 'span',
      Table: 'table',
      Tag: 'span',
    });
    const schema: SchemaNode = {
      component: 'Container',
      props: {
        a: '{{state.a}}',
      },
      if: '{{state.visible}}',
      show: '{{state.visible}}',
      className: '{{state.cls}}',
      style: { color: '{{state.color}}', padding: 8 },
      children: [{ component: 'Button', props: { disabled: '{{state.disabled}}' } }],
      slots: {
        title: { component: 'Text', children: '{{state.slotText}}' },
      },
      columns: [
        {
          title: 'x',
          dataIndex: 'x',
          if: '{{state.showCol}}',
          render: { component: 'Tag', children: '{{text}}' },
        },
      ],
      loop: {
        data: '{{state.list}}',
      },
    };

    const compiled = compileSchema(schema, resolver);
    if (Array.isArray(compiled)) {
      throw new Error('预期编译结果为单节点');
    }

    expect(compiled.allDeps).toEqual(
      expect.arrayContaining([
        'state.a',
        'state.visible',
        'state.cls',
        'state.color',
        'state.disabled',
        'state.slotText',
        'state.showCol',
        'state.list',
      ]),
    );
    expect(new Set(compiled.allDeps).size).toBe(compiled.allDeps.length);
  });

  it('__raw 会保留原始 SchemaNode 引用', () => {
    const resolver = createResolver({ Button: 'button' });
    const schema: SchemaNode = {
      component: 'Button',
      props: { type: 'primary' },
    };

    const compiled = compileSchema(schema, resolver);
    if (Array.isArray(compiled)) {
      throw new Error('预期编译结果为单节点');
    }

    expect(compiled.__raw).toBe(schema);
  });

  it('支持传入节点数组并返回编译数组', () => {
    const resolver = createResolver({ Button: 'button', Text: 'span' });
    const schema: SchemaNode[] = [{ component: 'Button' }, { component: 'Text' }];

    const compiled = compileSchema(schema, resolver);
    expect(Array.isArray(compiled)).toBe(true);
    expect((compiled as any[]).length).toBe(2);
    expect((compiled as any[])[0]?.componentType).toBe('Button');
    expect((compiled as any[])[1]?.componentType).toBe('Text');
  });
});
