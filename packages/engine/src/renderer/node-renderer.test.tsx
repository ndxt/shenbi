import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { CompiledNode } from '../types/contracts';
import { expr, renderWithContext } from '../test-utils';

describe('NodeRenderer', () => {
  it('静态渲染: Button 文本 props + children 正确渲染', () => {
    const node: CompiledNode = {
      Component: 'button',
      componentType: 'Button',
      staticProps: { type: 'button' },
      dynamicProps: {},
      childrenFn: expr('Submit', () => 'Submit'),
      allDeps: [],
    };
    renderWithContext(node);
    expect(screen.getByText('Submit')).toBeTruthy();
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
});
