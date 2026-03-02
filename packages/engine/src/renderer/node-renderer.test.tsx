import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { CompiledNode } from '../types/contracts';
import { expr, renderWithContext } from '../test-utils';
import { NodeRenderer, ShenbiContext } from './node-renderer';

describe('NodeRenderer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('静态渲染: Button 文本 props + children 正确渲染', () => {
    const node: CompiledNode = {
      id: 'btn_1',
      Component: 'button',
      componentType: 'Button',
      staticProps: { type: 'button' },
      dynamicProps: {},
      childrenFn: expr('Submit', () => 'Submit'),
      allDeps: [],
    };
    renderWithContext(node);
    const button = screen.getByText('Submit');
    expect(button).toBeTruthy();
    expect(button.getAttribute('data-shenbi-node-id')).toBe('btn_1');
  });

  it('动态 props: 表达式 prop 正确求值', () => {
    const node: CompiledNode = {
      Component: 'button',
      componentType: 'Button',
      staticProps: {},
      dynamicProps: {
        disabled: expr('{{state.loading}}', (ctx) => ctx.state.loading),
      },
      childrenFn: expr('Go', () => 'Go'),
      allDeps: ['state.loading'],
    };
    renderWithContext(node, { loading: true });
    expect(screen.getByText('Go')).toHaveProperty('disabled', true);
  });

  it('if=false: 不渲染', () => {
    const node: CompiledNode = {
      Component: 'span',
      componentType: 'Text',
      staticProps: {},
      dynamicProps: {},
      ifFn: expr('false', () => false),
      childrenFn: expr('hidden', () => 'hidden'),
      allDeps: [],
    };
    renderWithContext(node);
    expect(screen.queryByText('hidden')).toBeNull();
  });

  it('if=true: 正常渲染', () => {
    const node: CompiledNode = {
      Component: 'span',
      componentType: 'Text',
      staticProps: {},
      dynamicProps: {},
      ifFn: expr('true', () => true),
      childrenFn: expr('visible', () => 'visible'),
      allDeps: [],
    };
    renderWithContext(node);
    expect(screen.getByText('visible')).toBeTruthy();
  });

  it('show=false: display:none 但 DOM 存在', () => {
    const node: CompiledNode = {
      Component: 'span',
      componentType: 'Text',
      staticProps: {},
      dynamicProps: {},
      showFn: expr('false', () => false),
      childrenFn: expr('ghost', () => 'ghost'),
      allDeps: [],
    };
    renderWithContext(node);
    const el = screen.getByText('ghost');
    expect(el.style.display).toBe('none');
  });

  it('loop: 3 个数据项 → 3 个节点', () => {
    const node: CompiledNode = {
      Component: 'div',
      componentType: 'Container',
      staticProps: {},
      dynamicProps: {},
      loop: {
        dataFn: expr('{{state.items}}', (ctx) => ctx.state.items),
        itemKey: 'item',
        indexKey: 'index',
        keyFn: expr('{{index}}', (ctx) => ctx.index),
        body: {
          Component: 'span',
          componentType: 'Tag',
          staticProps: {},
          dynamicProps: {},
          childrenFn: expr('{{item.name}}', (ctx) => ctx.item?.name),
          allDeps: [],
        },
      },
      allDeps: ['state.items'],
    };
    renderWithContext(node, {
      items: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    });
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
    expect(screen.getByText('C')).toBeTruthy();
  });

  it('loop + if: 循环内条件过滤', () => {
    const node: CompiledNode = {
      Component: 'div',
      componentType: 'Container',
      staticProps: {},
      dynamicProps: {},
      loop: {
        dataFn: expr('{{state.items}}', (ctx) => ctx.state.items),
        itemKey: 'item',
        indexKey: 'index',
        keyFn: expr('{{index}}', (ctx) => ctx.index),
        body: {
          Component: 'span',
          componentType: 'Tag',
          staticProps: {},
          dynamicProps: {},
          ifFn: expr('{{item.visible}}', (ctx) => ctx.item?.visible),
          childrenFn: expr('{{item.name}}', (ctx) => ctx.item?.name),
          allDeps: [],
        },
      },
      allDeps: [],
    };
    renderWithContext(node, {
      items: [
        { name: 'Show', visible: true },
        { name: 'Hide', visible: false },
      ],
    });
    expect(screen.getByText('Show')).toBeTruthy();
    expect(screen.queryByText('Hide')).toBeNull();
  });

  it('slots: Card title/extra 渲染到正确位置', () => {
    const CardComp = (props: any) =>
      createElement('div', { 'data-testid': 'card' },
        createElement('div', { 'data-testid': 'title' }, props.title),
        createElement('div', { 'data-testid': 'extra' }, props.extra),
        props.children,
      );
    const node: CompiledNode = {
      Component: CardComp,
      componentType: 'Card',
      staticProps: {},
      dynamicProps: {},
      compiledSlots: {
        title: {
          Component: 'span',
          componentType: 'Text',
          staticProps: {},
          dynamicProps: {},
          childrenFn: expr('标题', () => '标题'),
          allDeps: [],
        },
        extra: {
          Component: 'a',
          componentType: 'Link',
          staticProps: { href: '#' },
          dynamicProps: {},
          childrenFn: expr('更多', () => '更多'),
          allDeps: [],
        },
      },
      allDeps: [],
    };
    renderWithContext(node);
    expect(screen.getByText('标题')).toBeTruthy();
    expect(screen.getByText('更多')).toBeTruthy();
  });

  it('文本 children 表达式: {{state.msg}} 正确显示', () => {
    const node: CompiledNode = {
      Component: 'p',
      componentType: 'Text',
      staticProps: {},
      dynamicProps: {},
      childrenFn: expr('{{state.msg}}', (ctx) => ctx.state.msg),
      allDeps: ['state.msg'],
    };
    renderWithContext(node, { msg: 'Hello World' });
    expect(screen.getByText('Hello World')).toBeTruthy();
  });

  it('静态 children: staticProps.children 会被渲染', () => {
    const node: CompiledNode = {
      Component: 'span',
      componentType: 'Text',
      staticProps: { children: '静态文本' },
      dynamicProps: {},
      allDeps: [],
    };
    renderWithContext(node);
    expect(screen.getByText('静态文本')).toBeTruthy();
  });

  it('事件绑定: onClick 触发 executeActions', async () => {
    const chain = [{ type: 'callMethod' as const, name: 'handleSubmit' }];
    const node: CompiledNode = {
      Component: 'button',
      componentType: 'Button',
      staticProps: {},
      dynamicProps: {},
      events: { onClick: chain },
      childrenFn: expr('Click', () => 'Click'),
      allDeps: [],
    };
    const { runtime } = renderWithContext(node);
    await userEvent.click(screen.getByText('Click'));
    expect(runtime.__executedActions).toHaveLength(1);
    expect(runtime.__executedActions[0]!.actions).toBe(chain);
  });

  it('事件绑定: 会把 extraContext 透传给 executeActions', async () => {
    const chain = [{ type: 'callMethod' as const, name: 'handleSubmit' }];
    const node: CompiledNode = {
      Component: 'button',
      componentType: 'Button',
      staticProps: {},
      dynamicProps: {},
      events: { onClick: chain },
      childrenFn: expr('ClickWithCtx', () => 'ClickWithCtx'),
      allDeps: [],
    };
    const { runtime } = renderWithContext(node, {}, { record: { id: 1 }, index: 0 });
    await userEvent.click(screen.getByText('ClickWithCtx'));
    expect(runtime.__executedActions).toHaveLength(1);
    expect(runtime.__executedActions[0]?.extraContext).toEqual({ record: { id: 1 }, index: 0 });
  });

  it('注入 props: 透传到真实组件并与 schema 事件组合执行', async () => {
    const injectedOnChange = vi.fn();
    const chain = [{ type: 'callMethod' as const, name: 'handleChange' }];

    const InputLike = (props: { value?: string; onChange?: (value: string) => void }) =>
      createElement(
        'button',
        { onClick: () => props.onChange?.('next') },
        props.value ?? '',
      );

    const node: CompiledNode = {
      Component: InputLike,
      componentType: 'Input',
      staticProps: { value: 'schema-value' },
      dynamicProps: {},
      events: {
        onChange: chain,
      },
      allDeps: [],
    };

    const view = renderWithContext(node);
    render(
      createElement(
        ShenbiContext,
        { value: { runtime: view.runtime, resolver: view.resolver } },
        createElement(NodeRenderer, {
          node,
          value: 'injected-value',
          onChange: injectedOnChange,
        }),
      ),
    );

    await userEvent.click(screen.getByText('injected-value'));
    expect(injectedOnChange).toHaveBeenCalledWith('next');
    expect(view.runtime.__executedActions).toHaveLength(1);
    expect(view.runtime.__executedActions[0]?.actions).toBe(chain);
    expect(view.runtime.__executedActions[0]?.eventData).toBe('next');
  });

  it('事件绑定: 支持路径事件（如 rowSelection.onChange）', async () => {
    const chain = [{ type: 'callMethod' as const, name: 'handleSelect' }];
    const TableLike = (props: { rowSelection?: { onChange?: (keys: number[]) => void } }) =>
      createElement(
        'button',
        {
          onClick: () => props.rowSelection?.onChange?.([1, 2]),
        },
        'trigger-select',
      );

    const node: CompiledNode = {
      Component: TableLike,
      componentType: 'Table',
      staticProps: {
        rowSelection: {},
      },
      dynamicProps: {},
      events: {
        'rowSelection.onChange': chain,
      },
      allDeps: [],
    };

    const { runtime } = renderWithContext(node);
    await userEvent.click(screen.getByText('trigger-select'));
    expect(runtime.__executedActions).toHaveLength(1);
    expect(runtime.__executedActions[0]?.actions).toBe(chain);
    expect(runtime.__executedActions[0]?.eventData).toEqual([1, 2]);
  });

  it('事件绑定: 多参数事件会注入 event 参数数组', async () => {
    const chain = [{ type: 'callMethod' as const, name: 'handleTableChange' }];
    const TableLike = (props: { onChange?: (...args: any[]) => void }) =>
      createElement(
        'button',
        {
          onClick: () => props.onChange?.(
            { current: 2, pageSize: 20 },
            { status: ['enabled'] },
            { field: 'name', order: 'ascend' },
          ),
        },
        'trigger-table-change',
      );

    const node: CompiledNode = {
      Component: TableLike,
      componentType: 'Table',
      staticProps: {},
      dynamicProps: {},
      events: {
        onChange: chain,
      },
      allDeps: [],
    };

    const { runtime } = renderWithContext(node);
    await userEvent.click(screen.getByText('trigger-table-change'));
    expect(runtime.__executedActions).toHaveLength(1);
    expect(runtime.__executedActions[0]?.eventData).toEqual([
      { current: 2, pageSize: 20 },
      { status: ['enabled'] },
      { field: 'name', order: 'ascend' },
    ]);
  });

  it('事件绑定: executeActions reject 会被捕获避免未处理异常', async () => {
    const chain = [{ type: 'callMethod' as const, name: 'handleReject' }];
    const executeError = new Error('boom');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const node: CompiledNode = {
      Component: 'button',
      componentType: 'Button',
      staticProps: {},
      dynamicProps: {},
      events: { onClick: chain },
      childrenFn: expr('ClickReject', () => 'ClickReject'),
      allDeps: [],
    };

    const { runtime } = renderWithContext(node);
    runtime.executeActions = vi.fn(async () => {
      throw executeError;
    });

    await userEvent.click(screen.getByText('ClickReject'));
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalledWith('[shenbi] executeActions failed', executeError);
  });

  it('嵌套: Container > Card > Button 递归正确', () => {
    const button: CompiledNode = {
      Component: 'button',
      componentType: 'Button',
      staticProps: {},
      dynamicProps: {},
      childrenFn: expr('OK', () => 'OK'),
      allDeps: [],
    };
    const card: CompiledNode = {
      Component: 'div',
      componentType: 'Card',
      staticProps: { 'data-testid': 'nested-card' },
      dynamicProps: {},
      compiledChildren: [button],
      allDeps: [],
    };
    const container: CompiledNode = {
      Component: 'div',
      componentType: 'Container',
      staticProps: { 'data-testid': 'nested-container' },
      dynamicProps: {},
      compiledChildren: [card],
      allDeps: [],
    };
    renderWithContext(container);
    const containerEl = screen.getByTestId('nested-container');
    expect(containerEl).toBeTruthy();
    expect(screen.getByTestId('nested-card')).toBeTruthy();
    expect(screen.getByText('OK')).toBeTruthy();
  });

  it('未知组件: 显示红色错误框', () => {
    const node: CompiledNode = {
      Component: null,
      componentType: 'NonExistent',
      staticProps: {},
      dynamicProps: {},
      allDeps: [],
    };
    renderWithContext(node);
    expect(screen.getByText('未知组件: NonExistent')).toBeTruthy();
  });

  it('permission: 无权限则不渲染', () => {
    const node: CompiledNode = {
      Component: 'span',
      componentType: 'Text',
      staticProps: {},
      dynamicProps: {},
      permission: 'admin',
      childrenFn: expr('secret', () => 'secret'),
      allDeps: [],
    };
    renderWithContext(node, { __permissions: ['user'] });
    expect(screen.queryByText('secret')).toBeNull();
  });

  it('loop + if(在 loop 节点上): 循环内条件过滤', () => {
    const node: CompiledNode = {
      Component: 'div',
      componentType: 'Container',
      staticProps: {},
      dynamicProps: {},
      ifFn: expr('{{item.visible}}', (ctx) => ctx.item?.visible),
      loop: {
        dataFn: expr('{{state.items}}', (ctx) => ctx.state.items),
        itemKey: 'item',
        indexKey: 'index',
        keyFn: expr('{{index}}', (ctx) => ctx.index),
        body: {
          Component: 'span',
          componentType: 'Tag',
          staticProps: {},
          dynamicProps: {},
          childrenFn: expr('{{item.name}}', (ctx) => ctx.item?.name),
          allDeps: [],
        },
      },
      allDeps: ['state.items'],
    };
    renderWithContext(node, {
      items: [
        { name: 'Show', visible: true },
        { name: 'Hide', visible: false },
      ],
    });
    expect(screen.getByText('Show')).toBeTruthy();
    expect(screen.queryByText('Hide')).toBeNull();
  });

  it('permission: 有权限则正常渲染', () => {
    const node: CompiledNode = {
      Component: 'span',
      componentType: 'Text',
      staticProps: {},
      dynamicProps: {},
      permission: 'admin',
      childrenFn: expr('secret', () => 'secret'),
      allDeps: [],
    };
    renderWithContext(node, { __permissions: ['admin', 'user'] });
    expect(screen.getByText('secret')).toBeTruthy();
  });

  it('columns: render 函数正确生成', () => {
    const TableComp = (props: any) => {
      const cols = props.columns ?? [];
      return createElement('table', null,
        createElement('tbody', null,
          createElement('tr', null,
            cols.map((col: any, i: number) =>
              createElement('td', { key: i },
                col.render ? col.render('val', { name: 'test' }, 0) : col.title,
              ),
            ),
          ),
        ),
      );
    };
    const node: CompiledNode = {
      Component: TableComp,
      componentType: 'Table',
      staticProps: {},
      dynamicProps: {},
      compiledColumns: [
        {
          config: { title: 'Name', dataIndex: 'name' },
          compiledRender: {
            Component: 'span',
            componentType: 'Text',
            staticProps: {},
            dynamicProps: {},
            childrenFn: expr('{{record.name}}', (ctx) => ctx.record?.name),
            allDeps: [],
          },
        },
      ],
      allDeps: [],
    };
    renderWithContext(node);
    expect(screen.getByText('test')).toBeTruthy();
  });

  it('columns: dynamicConfig 会在渲染时求值', () => {
    const TableComp = (props: any) =>
      createElement('div', { 'data-testid': 'sorter-type' }, typeof props.columns?.[0]?.sorter);

    const node: CompiledNode = {
      Component: TableComp,
      componentType: 'Table',
      staticProps: {},
      dynamicProps: {},
      compiledColumns: [
        {
          config: { title: 'Name', dataIndex: 'name' },
          dynamicConfig: {
            sorter: expr('{{state.enableSorter}}', (ctx) =>
              ctx.state.enableSorter ? ((a: number, b: number) => a - b) : false),
          },
        },
      ],
      allDeps: [],
    };

    renderWithContext(node, { enableSorter: true });
    expect(screen.getByTestId('sorter-type').textContent).toBe('function');
  });

  it('columns: editable 行命中 editingKey 时优先渲染 editRender', () => {
    const TableComp = (props: any) => {
      const row = { id: 1, name: 'Alice' };
      const col = props.columns?.[0];
      return createElement('div', null, col?.render?.('Alice', row, 0));
    };

    const node: CompiledNode = {
      Component: TableComp,
      componentType: 'Table',
      staticProps: {
        rowKey: 'id',
        editable: { editingKey: 1 },
      },
      dynamicProps: {},
      compiledColumns: [
        {
          config: { title: 'Name', dataIndex: 'name' },
          compiledRender: {
            Component: 'span',
            componentType: 'Text',
            staticProps: {},
            dynamicProps: {},
            childrenFn: expr('展示态', () => '展示态'),
            allDeps: [],
          },
          compiledEditRender: {
            Component: 'span',
            componentType: 'Text',
            staticProps: {},
            dynamicProps: {},
            childrenFn: expr('编辑态', () => '编辑态'),
            allDeps: [],
          },
        },
      ],
      allDeps: [],
    };

    renderWithContext(node);
    expect(screen.getByText('编辑态')).toBeTruthy();
    expect(screen.queryByText('展示态')).toBeNull();
  });

  it('columns: 未命中 editingKey 时渲染普通 render', () => {
    const TableComp = (props: any) => {
      const row = { id: 2, name: 'Bob' };
      const col = props.columns?.[0];
      return createElement('div', null, col?.render?.('Bob', row, 0));
    };

    const node: CompiledNode = {
      Component: TableComp,
      componentType: 'Table',
      staticProps: {
        rowKey: 'id',
        editable: { editingKey: 1 },
      },
      dynamicProps: {},
      compiledColumns: [
        {
          config: { title: 'Name', dataIndex: 'name' },
          compiledRender: {
            Component: 'span',
            componentType: 'Text',
            staticProps: {},
            dynamicProps: {},
            childrenFn: expr('展示态', () => '展示态'),
            allDeps: [],
          },
          compiledEditRender: {
            Component: 'span',
            componentType: 'Text',
            staticProps: {},
            dynamicProps: {},
            childrenFn: expr('编辑态', () => '编辑态'),
            allDeps: [],
          },
        },
      ],
      allDeps: [],
    };

    renderWithContext(node);
    expect(screen.getByText('展示态')).toBeTruthy();
    expect(screen.queryByText('编辑态')).toBeNull();
  });

  it('columns: 仅有 editRender 且未命中 editingKey 时回退为文本', () => {
    const TableComp = (props: any) => {
      const row = { id: 2, name: 'Charlie' };
      const col = props.columns?.[0];
      return createElement('div', null, col?.render?.('原始文本', row, 0));
    };

    const node: CompiledNode = {
      Component: TableComp,
      componentType: 'Table',
      staticProps: {
        rowKey: 'id',
        editable: { editingKey: 1 },
      },
      dynamicProps: {},
      compiledColumns: [
        {
          config: { title: 'Name', dataIndex: 'name' },
          compiledEditRender: {
            Component: 'span',
            componentType: 'Text',
            staticProps: {},
            dynamicProps: {},
            childrenFn: expr('编辑态', () => '编辑态'),
            allDeps: [],
          },
        },
      ],
      allDeps: [],
    };

    renderWithContext(node);
    expect(screen.getByText('原始文本')).toBeTruthy();
  });

  it('Form: 自动创建实例并注册 ref，initialValues 变化时调用 setFieldsValue', () => {
    const formInstance = {
      setFieldsValue: vi.fn(),
      resetFields: vi.fn(),
      getFieldsValue: vi.fn(),
    };

    const FormComp = (props: any) => createElement('form', { 'data-testid': 'form-root' }, props.children);
    (FormComp as any).useForm = vi.fn(() => [formInstance]);

    const node: CompiledNode = {
      id: 'user-form',
      Component: FormComp,
      componentType: 'Form',
      staticProps: {},
      dynamicProps: {
        initialValues: expr('{{state.formInitial}}', (ctx) => ctx.state.formInitial),
      },
      allDeps: ['state.formInitial'],
    };

    const view = renderWithContext(node, { formInitial: { name: 'Alice' } });
    expect((FormComp as any).useForm).toHaveBeenCalledTimes(1);
    expect(view.runtime.__refs['user-form']).toBe(formInstance);
    expect(formInstance.setFieldsValue).toHaveBeenCalledWith({ name: 'Alice' });

    view.runtime.state.formInitial = { name: 'Bob' };
    view.rerender(
      createElement(
        ShenbiContext,
        { value: { runtime: view.runtime, resolver: view.resolver } },
        createElement(NodeRenderer, { node }),
      ),
    );
    expect(formInstance.setFieldsValue).toHaveBeenLastCalledWith({ name: 'Bob' });

    view.unmount();
    expect(view.runtime.__refs['user-form']).toBeUndefined();
  });

  it('__fragment: 不注入 ref', () => {
    const node: CompiledNode = {
      id: 'frag',
      Component: null,
      componentType: '__fragment',
      staticProps: {},
      dynamicProps: {},
      childrenFn: expr('fragment', () => 'fragment'),
      allDeps: [],
    };
    const { runtime } = renderWithContext(node);
    expect(screen.getByText('fragment')).toBeTruthy();
    expect(runtime.__refs.frag).toBeUndefined();
  });

  it('ref: 组件卸载时会清理 runtime refs', () => {
    const node: CompiledNode = {
      id: 'inputRef',
      Component: 'input',
      componentType: 'Input',
      staticProps: { value: 'x', readOnly: true },
      dynamicProps: {},
      allDeps: [],
    };

    const view = renderWithContext(node);
    expect(view.runtime.__refs.inputRef).toBeTruthy();

    view.unmount();
    expect(view.runtime.__refs.inputRef).toBeUndefined();
  });
});
