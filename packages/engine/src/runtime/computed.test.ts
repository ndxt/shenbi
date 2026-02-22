import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import type { PageSchema } from '@shenbi/schema';
import { useComputed } from './computed';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function renderComputedHook(def: PageSchema['computed'], state: Record<string, any>) {
  let latest: Record<string, any> = {};

  function Harness(props: { computedDef: PageSchema['computed']; runtimeState: Record<string, any> }) {
    latest = useComputed(props.computedDef, props.runtimeState);
    return null;
  }

  const container = document.createElement('div');
  const root = createRoot(container);

  act(() => {
    root.render(createElement(Harness, { computedDef: def, runtimeState: state }));
  });

  return {
    getLatest() {
      return latest;
    },
    rerender(nextDef: PageSchema['computed'], nextState: Record<string, any>) {
      act(() => {
        root.render(createElement(Harness, { computedDef: nextDef, runtimeState: nextState }));
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
    },
  };
}

describe('runtime/computed', () => {
  it('computed 基本求值正确', () => {
    const computedDef: PageSchema['computed'] = {
      plusOne: {
        deps: ['state.count'],
        expr: '{{state.count + 1}}',
      },
    };

    const harness = renderComputedHook(computedDef, { count: 5 });
    expect(harness.getLatest().plusOne).toBe(6);
    harness.unmount();
  });

  it('deps 不变时走缓存不重新计算', () => {
    (globalThis as any).__computedCounter = 0;
    const computedDef: PageSchema['computed'] = {
      cached: {
        deps: ['state.seed'],
        expr: '{{(globalThis.__computedCounter = (globalThis.__computedCounter ?? 0) + 1)}}',
      },
    };

    const harness = renderComputedHook(computedDef, { seed: 1, other: 1 });
    const first = harness.getLatest().cached;

    harness.rerender(computedDef, { seed: 1, other: 2 });
    const second = harness.getLatest().cached;

    expect(first).toBe(1);
    expect(second).toBe(1);
    expect((globalThis as any).__computedCounter).toBe(1);
    harness.unmount();
  });

  it('deps 变化时会触发重算', () => {
    (globalThis as any).__computedCounter = 0;
    const computedDef: PageSchema['computed'] = {
      cached: {
        deps: ['state.seed'],
        expr: '{{(globalThis.__computedCounter = (globalThis.__computedCounter ?? 0) + 1)}}',
      },
    };

    const harness = renderComputedHook(computedDef, { seed: 1 });
    expect(harness.getLatest().cached).toBe(1);

    harness.rerender(computedDef, { seed: 2 });
    expect(harness.getLatest().cached).toBe(2);
    expect((globalThis as any).__computedCounter).toBe(2);
    harness.unmount();
  });

  it('支持 computed 依赖 computed', () => {
    const computedDef: PageSchema['computed'] = {
      base: {
        deps: ['state.count'],
        expr: '{{state.count + 1}}',
      },
      total: {
        deps: ['computed.base'],
        expr: '{{computed.base + 10}}',
      },
    };

    const harness = renderComputedHook(computedDef, { count: 1 });
    expect(harness.getLatest().base).toBe(2);
    expect(harness.getLatest().total).toBe(12);
    harness.unmount();
  });

  it('检测到循环依赖时抛出错误', () => {
    const computedDef: PageSchema['computed'] = {
      a: {
        deps: ['computed.b'],
        expr: '{{computed.b + 1}}',
      },
      b: {
        deps: ['computed.a'],
        expr: '{{computed.a + 1}}',
      },
    };

    expect(() => {
      renderComputedHook(computedDef, {});
    }).toThrow('循环依赖');
  });

  it('computedDef 为空时返回空对象', () => {
    const harness = renderComputedHook(undefined, { count: 1 });
    expect(harness.getLatest()).toEqual({});
    harness.unmount();
  });
});
