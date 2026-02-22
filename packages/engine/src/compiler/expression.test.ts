import { describe, expect, it } from 'vitest';
import type { ExpressionContext } from '@shenbi/schema';
import {
  compileExpression,
  compileJSFunction,
  compilePropValue,
  extractDeps,
  isExpression,
} from './expression';

function createContext(state: Record<string, any> = {}): ExpressionContext {
  return {
    state,
    params: { route: { id: '123' } },
    computed: { filteredList: [1, 2, 3] },
    ds: {},
    utils: {
      dayjs: () => ({
        format: (_fmt: string) => '2026',
      }),
    },
    refs: {},
  };
}

describe('compiler/expression', () => {
  it('识别表达式字符串', () => {
    expect(isExpression('{{state.count}}')).toBe(true);
  });

  it('普通字符串不识别为表达式', () => {
    expect(isExpression('hello')).toBe(false);
  });

  it('支持简单属性访问', () => {
    const compiled = compileExpression('{{state.count}}');
    expect(compiled.fn(createContext({ count: 5 }))).toBe(5);
  });

  it('支持算术运算', () => {
    const compiled = compileExpression('{{state.count + 1}}');
    expect(compiled.fn(createContext({ count: 5 }))).toBe(6);
  });

  it('支持三元表达式', () => {
    const compiled = compileExpression("{{state.count > 3 ? 'many' : 'few'}}");
    expect(compiled.fn(createContext({ count: 5 }))).toBe('many');
  });

  it('支持模板字面量', () => {
    const compiled = compileExpression('{{`hello ${state.name}`}}');
    expect(compiled.fn(createContext({ name: 'test' }))).toBe('hello test');
  });

  it('支持嵌套路径访问', () => {
    const compiled = compileExpression('{{params.route.id}}');
    expect(compiled.fn(createContext())).toBe('123');
  });

  it('支持数组方法表达式', () => {
    const compiled = compileExpression('{{state.list.filter(x => x > 1).length}}');
    expect(compiled.fn(createContext({ list: [0, 1, 2, 3] }))).toBe(2);
  });

  it('支持逻辑运算', () => {
    const compiled = compileExpression('{{state.a && state.b}}');
    expect(compiled.fn(createContext({ a: true, b: false }))).toBe(false);
  });

  it('支持可选链', () => {
    const compiled = compileExpression('{{state.user?.name}}');
    expect(compiled.fn(createContext({}))).toBeUndefined();
  });

  it('支持 loop 变量访问', () => {
    const compiled = compileExpression('{{item.label + "-" + index}}');
    const ctx = {
      ...createContext(),
      item: { label: 'Tag' },
      index: 2,
    } as ExpressionContext;
    expect(compiled.fn(ctx)).toBe('Tag-2');
  });

  it('支持 render 变量访问', () => {
    const compiled = compileExpression("{{`${text}-${record.id}-${index}`}}");
    const ctx = {
      ...createContext(),
      text: 'name',
      record: { id: 7 },
      index: 1,
    } as ExpressionContext;
    expect(compiled.fn(ctx)).toBe('name-7-1');
  });

  it('支持 utils 访问', () => {
    const compiled = compileExpression("{{utils.dayjs().format('YYYY')}}");
    expect(compiled.fn(createContext())).toBe('2026');
  });

  it('支持 computed 访问', () => {
    const compiled = compileExpression('{{computed.filteredList.length}}');
    expect(compiled.fn(createContext())).toBe(3);
  });

  it('无效表达式返回 undefined 而不是抛错', () => {
    const compiled = compileExpression('{{state.count + }}');
    expect(compiled.fn(createContext({ count: 1 }))).toBeUndefined();
  });

  it('空表达式返回 undefined', () => {
    const compiled = compileExpression('{{}}');
    expect(compiled.fn(createContext())).toBeUndefined();
  });

  it('compilePropValue 对普通字符串返回 null', () => {
    expect(compilePropValue('hello')).toBeNull();
  });

  it('compilePropValue 支持 JSExpression 对象', () => {
    const compiled = compilePropValue({
      __type: 'JSExpression',
      value: '{{state.count + 2}}',
    });
    if (!compiled || typeof compiled === 'function') {
      throw new Error('预期 JSExpression 编译结果为 CompiledExpression');
    }
    expect(compiled.fn(createContext({ count: 3 }))).toBe(5);
  });

  it('compilePropValue 支持 __type JSFunction 对象', () => {
    const compiled = compilePropValue({
      __type: 'JSFunction',
      params: ['v'],
      body: 'return v * 2;',
    });
    if (typeof compiled !== 'function') {
      throw new Error('预期 JSFunction 编译结果为函数');
    }
    expect(compiled(createContext(), 4)).toBe(8);
  });

  it('compilePropValue 支持 type JSFunction 对象', () => {
    const compiled = compilePropValue({
      type: 'JSFunction',
      params: ['v'],
      body: 'return v + state.offset;',
    });
    if (typeof compiled !== 'function') {
      throw new Error('预期 JSFunction 编译结果为函数');
    }
    expect(compiled(createContext({ offset: 3 }), 4)).toBe(7);
  });

  it('compileJSFunction 支持访问上下文', () => {
    const fn = compileJSFunction(['v'], 'return v + state.delta;');
    expect(fn(createContext({ delta: 10 }), 5)).toBe(15);
  });

  it('compileJSFunction 无显式 return 时会按表达式自动返回', () => {
    const fn = compileJSFunction(['a', 'b'], 'a.value - b.value + state.delta');
    const result = fn(createContext({ delta: 2 }), { value: 9 }, { value: 3 });
    expect(result).toBe(8);
  });

  it('compileJSFunction 语法错误时返回 undefined', () => {
    const fn = compileJSFunction(['v'], 'return v + ;');
    expect(fn(createContext(), 5)).toBeUndefined();
  });

  it('extractDeps 提取多路径并去重', () => {
    const deps = extractDeps('{{state.a + state.a + params.route.id + computed.list.length}}');
    expect(deps).toEqual(['state.a', 'params.route.id', 'computed.list.length']);
  });

  it('extractDeps 处理可选链路径', () => {
    const deps = extractDeps('{{state.user?.name ?? params.route.id}}');
    expect(deps).toEqual(['state.user.name', 'params.route.id']);
  });

  it('extractDeps 遇到函数调用会回退到可监听路径', () => {
    const deps = extractDeps('{{state.list.filter(x => x > 1).length}}');
    expect(deps).toEqual(['state.list']);
  });

  it('支持不带花括号的表达式字符串', () => {
    const compiled = compileExpression('state.count + 1');
    expect(compiled.fn(createContext({ count: 9 }))).toBe(10);
  });

  it('性能基线：10000 次编译在可接受时间内', () => {
    const start = Date.now();
    for (let i = 0; i < 10000; i += 1) {
      compileExpression('{{state.count + 1}}');
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });
});
