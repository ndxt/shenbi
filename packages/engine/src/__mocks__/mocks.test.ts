import { describe, expect, it } from 'vitest';
import type { ExpressionContext } from '@shenbi/schema';
import {
  createMockResolver,
  createMockRuntime,
  mockCompiledButtonNode,
  mockCompiledLoopNode,
  mockPageSchema,
} from './index';

function createExprContext(state: Record<string, any>): ExpressionContext {
  return {
    state,
    params: {},
    computed: {},
    ds: {},
    utils: {},
    refs: {},
  };
}

describe('运行时 Mock', () => {
  it('支持 SET 路径更新', () => {
    const runtime = createMockRuntime({ form: { name: 'old' } });
    runtime.dispatch({ type: 'SET', key: 'form.name', value: 'new' });
    expect(runtime.state.form.name).toBe('new');
  });

  it('记录 executeActions 调用', async () => {
    const runtime = createMockRuntime();
    await runtime.executeActions([{ type: 'setState', key: 'a', value: 1 }]);
    expect(runtime.__executedActions).toHaveLength(1);
    expect(runtime.__executedActions[0]?.actions[0]).toMatchObject({
      type: 'setState',
      key: 'a',
    });
  });

  it('注册 refs 并在上下文中可见', () => {
    const runtime = createMockRuntime();
    runtime.registerRef('formRef', { validateFields: () => Promise.resolve() });
    const ctx = runtime.getContext();
    expect(ctx.refs.formRef).toBeTruthy();
  });
});

describe('Resolver Mock', () => {
  it('可解析已注册组件与 __fragment', () => {
    const Button = () => null;
    const resolver = createMockResolver({ Button });
    expect(resolver.resolve('Button')).toBe(Button);
    expect(resolver.resolve('__fragment')).toBeTruthy();
    expect(resolver.resolve('Unknown')).toBeNull();
  });
});

describe('编译节点 Mock', () => {
  it('可求值按钮动态属性与 children', () => {
    const disabledExpr = mockCompiledButtonNode.dynamicProps.disabled;
    const childrenExpr = mockCompiledButtonNode.childrenFn;

    expect(disabledExpr).toBeTruthy();
    expect(childrenExpr).toBeTruthy();

    const ctx = createExprContext({ loading: true, submitText: 'Save' });
    expect(disabledExpr?.fn(ctx)).toBe(true);
    expect(childrenExpr?.fn(ctx)).toBe('Save');
  });

  it('可求值循环表达式与 body 字段', () => {
    const loop = mockCompiledLoopNode.loop;
    expect(loop).toBeTruthy();

    const listCtx = createExprContext({
      tags: [{ id: 1, label: 'Tag A', color: 'blue' }],
    });
    expect(loop?.dataFn.fn(listCtx)).toHaveLength(1);

    const itemCtx = {
      ...listCtx,
      item: { id: 9, label: 'Tag X', color: 'gold' },
      index: 0,
    } as ExpressionContext;
    expect(loop?.keyFn.fn(itemCtx)).toBe(9);
    expect(loop?.body.dynamicProps.color?.fn(itemCtx)).toBe('gold');
    expect(loop?.body.childrenFn?.fn(itemCtx)).toBe('Tag X');
  });
});

describe('页面 Schema Mock', () => {
  it('包含最小可交互字段', () => {
    expect(mockPageSchema.id).toBe('demo_page');
    expect(mockPageSchema.state?.loading?.default).toBe(false);
    expect(mockPageSchema.methods?.handleSubmit?.body[0]).toMatchObject({
      type: 'setState',
      key: 'loading',
      value: true,
    });
    const body = mockPageSchema.body;
    if (Array.isArray(body)) {
      throw new Error('当前 mock 约定 mockPageSchema.body 必须是单节点');
    }
    expect(Array.isArray(body.children)).toBe(true);
  });
});
