import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import type { PageSchema } from '@shenbi/schema';
import { createInitialState, pageStateReducer, usePageState, type PageStateController } from './state';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function renderStateHook(page: PageSchema) {
  let latest: PageStateController | null = null;

  function Harness(props: { schema: PageSchema }) {
    latest = usePageState(props.schema);
    return null;
  }

  const container = document.createElement('div');
  const root = createRoot(container);

  act(() => {
    root.render(createElement(Harness, { schema: page }));
  });

  return {
    getLatest() {
      if (!latest) {
        throw new Error('Hook 尚未初始化');
      }
      return latest;
    },
    rerender(nextPage: PageSchema) {
      act(() => {
        root.render(createElement(Harness, { schema: nextPage }));
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
    },
  };
}

describe('runtime/state', () => {
  it('初始化会从 StateFieldDef 提取 default 值', () => {
    const page: PageSchema = {
      body: { component: 'Container' },
      state: {
        loading: { default: false },
        keyword: { default: 'abc' },
      },
    };

    expect(createInitialState(page)).toEqual({
      loading: false,
      keyword: 'abc',
    });
  });

  it('default 缺失时初始化为 null', () => {
    const page: PageSchema = {
      body: { component: 'Container' },
      state: {
        maybe: {},
      },
    };

    expect(createInitialState(page)).toEqual({
      maybe: null,
    });
  });

  it('SET 支持单层 key 更新', () => {
    const next = pageStateReducer(
      { loading: false },
      { type: 'SET', key: 'loading', value: true },
    );

    expect(next.loading).toBe(true);
  });

  it('SET 支持路径 a.b.c 深层不可变更新', () => {
    const prev = { form: { user: { name: 'old' }, age: 18 }, keep: 1 };
    const next = pageStateReducer(prev, {
      type: 'SET',
      key: 'form.user.name',
      value: 'new',
    });

    expect(next.form.user.name).toBe('new');
    expect(next.keep).toBe(1);
    expect(next).not.toBe(prev);
    expect(next.form).not.toBe(prev.form);
    expect(next.form.user).not.toBe(prev.form.user);
  });

  it('MERGE 为浅合并且不丢失未覆盖字段', () => {
    const next = pageStateReducer(
      { a: 1, b: 2, c: 3 },
      { type: 'MERGE', data: { b: 20 } },
    );

    expect(next).toEqual({ a: 1, b: 20, c: 3 });
  });

  it('RESET 会恢复到 initial', () => {
    const next = pageStateReducer(
      { a: 1, b: 2 },
      { type: 'RESET', initial: { a: 9, b: 8 } },
    );

    expect(next).toEqual({ a: 9, b: 8 });
  });

  it('usePageState 可通过 dispatch 驱动状态变化', () => {
    const page: PageSchema = {
      body: { component: 'Container' },
      state: {
        loading: { default: false },
        form: { default: { name: 'a' } },
      },
    };

    const harness = renderStateHook(page);
    expect(harness.getLatest().state.loading).toBe(false);

    act(() => {
      harness.getLatest().dispatch({ type: 'SET', key: 'loading', value: true });
      harness.getLatest().dispatch({ type: 'SET', key: 'form.name', value: 'b' });
    });

    expect(harness.getLatest().state.loading).toBe(true);
    expect(harness.getLatest().state.form.name).toBe('b');

    harness.unmount();
  });

  it('页面初始状态变化时会自动 RESET 到新初始值', () => {
    const pageA: PageSchema = {
      id: 'page-a',
      body: { component: 'Container' },
      state: {
        loading: { default: false },
        keyword: { default: 'A' },
      },
    };
    const pageB: PageSchema = {
      id: 'page-b',
      body: { component: 'Container' },
      state: {
        loading: { default: true },
        keyword: { default: 'B' },
      },
    };

    const harness = renderStateHook(pageA);
    act(() => {
      harness.getLatest().dispatch({ type: 'SET', key: 'keyword', value: 'CHANGED' });
    });
    expect(harness.getLatest().state.keyword).toBe('CHANGED');

    harness.rerender(pageB);
    expect(harness.getLatest().state.loading).toBe(true);
    expect(harness.getLatest().state.keyword).toBe('B');
    harness.unmount();
  });
});
