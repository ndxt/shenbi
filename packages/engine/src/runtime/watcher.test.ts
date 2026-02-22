import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { PageSchema } from '@shenbi/schema';
import { useWatchers } from './watcher';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function renderWatcherHook(
  watchers: PageSchema['watchers'],
  state: Record<string, any>,
  executeActions: (actions: any, extra?: any) => Promise<void>,
) {
  function Harness(props: {
    watcherDefs: PageSchema['watchers'];
    runtimeState: Record<string, any>;
    onExecute: (actions: any, extra?: any) => Promise<void>;
  }) {
    useWatchers(props.watcherDefs, props.runtimeState, props.onExecute);
    return null;
  }

  const container = document.createElement('div');
  const root = createRoot(container);

  const render = async (nextWatchers: PageSchema['watchers'], nextState: Record<string, any>) => {
    await act(async () => {
      root.render(
        createElement(Harness, {
          watcherDefs: nextWatchers,
          runtimeState: nextState,
          onExecute: executeActions,
        }),
      );
    });
  };

  return {
    async mount() {
      await render(watchers, state);
    },
    async rerender(nextWatchers: PageSchema['watchers'], nextState: Record<string, any>) {
      await render(nextWatchers, nextState);
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
    },
  };
}

describe('runtime/watcher', () => {
  it('单路径监听在值变化时触发 handler', async () => {
    const executeActions = vi.fn(async () => {});
    const watchers: PageSchema['watchers'] = [
      {
        watch: 'state.keyword',
        handler: [{ type: 'setState', key: 'x', value: 1 }],
      },
    ];

    const harness = renderWatcherHook(watchers, { keyword: 'a' }, executeActions);
    await harness.mount();
    expect(executeActions).toHaveBeenCalledTimes(0);

    await harness.rerender(watchers, { keyword: 'b' });
    expect(executeActions).toHaveBeenCalledTimes(1);
    await harness.unmount();
  });

  it('多路径监听任一变化都会触发', async () => {
    const executeActions = vi.fn(async () => {});
    const watchers: PageSchema['watchers'] = [
      {
        watch: ['state.a', 'state.b'],
        handler: [{ type: 'setState', key: 'x', value: 1 }],
      },
    ];

    const harness = renderWatcherHook(watchers, { a: 1, b: 1 }, executeActions);
    await harness.mount();

    await harness.rerender(watchers, { a: 1, b: 2 });
    expect(executeActions).toHaveBeenCalledTimes(1);
    await harness.unmount();
  });

  it('immediate 为 true 时初始化立即触发', async () => {
    const executeActions = vi.fn(async () => {});
    const watchers: PageSchema['watchers'] = [
      {
        watch: 'state.keyword',
        immediate: true,
        handler: [{ type: 'setState', key: 'x', value: 1 }],
      },
    ];

    const harness = renderWatcherHook(watchers, { keyword: 'a' }, executeActions);
    await harness.mount();

    expect(executeActions).toHaveBeenCalledTimes(1);
    await harness.unmount();
  });

  it('debounce 连续变化只触发最后一次', async () => {
    vi.useFakeTimers();
    const executeActions = vi.fn(async () => {});
    const watchers: PageSchema['watchers'] = [
      {
        watch: 'state.keyword',
        debounce: 100,
        handler: [{ type: 'setState', key: 'x', value: 1 }],
      },
    ];

    const harness = renderWatcherHook(watchers, { keyword: 'a' }, executeActions);
    await harness.mount();

    await harness.rerender(watchers, { keyword: 'b' });
    await harness.rerender(watchers, { keyword: 'c' });
    await vi.advanceTimersByTimeAsync(100);

    expect(executeActions).toHaveBeenCalledTimes(1);
    await harness.unmount();
  });

  it('debounce 不会被无关重渲染取消', async () => {
    vi.useFakeTimers();
    const executeActions = vi.fn(async () => {});
    const watchers: PageSchema['watchers'] = [
      {
        watch: 'state.keyword',
        debounce: 100,
        handler: [{ type: 'setState', key: 'x', value: 1 }],
      },
    ];

    const harness = renderWatcherHook(watchers, { keyword: 'a', other: 1 }, executeActions);
    await harness.mount();

    await harness.rerender(watchers, { keyword: 'b', other: 1 });
    await harness.rerender(watchers, { keyword: 'b', other: 2 });
    await vi.advanceTimersByTimeAsync(100);

    expect(executeActions).toHaveBeenCalledTimes(1);
    await harness.unmount();
  });

  it('throttle 在窗口内只触发一次', async () => {
    vi.useFakeTimers();
    const executeActions = vi.fn(async () => {});
    const watchers: PageSchema['watchers'] = [
      {
        watch: 'state.keyword',
        throttle: 100,
        handler: [{ type: 'setState', key: 'x', value: 1 }],
      },
    ];

    const harness = renderWatcherHook(watchers, { keyword: 'a' }, executeActions);
    await harness.mount();

    await harness.rerender(watchers, { keyword: 'b' });
    await harness.rerender(watchers, { keyword: 'c' });
    await vi.advanceTimersByTimeAsync(100);

    expect(executeActions).toHaveBeenCalledTimes(1);
    await harness.unmount();
  });

  it('deep 开启后对象内部变化会触发', async () => {
    const executeActions = vi.fn(async () => {});
    const watchers: PageSchema['watchers'] = [
      {
        watch: 'state.user',
        deep: true,
        handler: [{ type: 'setState', key: 'x', value: 1 }],
      },
    ];

    const user = { name: 'A' };
    const harness = renderWatcherHook(watchers, { user }, executeActions);
    await harness.mount();

    user.name = 'B';
    await harness.rerender(watchers, { user });

    expect(executeActions).toHaveBeenCalledTimes(1);
    await harness.unmount();
  });

  it('deep 模式下循环引用对象不会抛错且可触发', async () => {
    const executeActions = vi.fn(async () => {});
    const watchers: PageSchema['watchers'] = [
      {
        watch: 'state.user',
        deep: true,
        handler: [{ type: 'setState', key: 'x', value: 1 }],
      },
    ];

    const user: Record<string, any> = { name: 'A' };
    user.self = user;
    const harness = renderWatcherHook(watchers, { user }, executeActions);
    await harness.mount();

    user.name = 'B';
    await harness.rerender(watchers, { user });

    expect(executeActions).toHaveBeenCalledTimes(1);
    await harness.unmount();
  });

  it('watch 上下文会注入 newValue 与 oldValue', async () => {
    const executeActions = vi.fn(async () => {});
    const watchers: PageSchema['watchers'] = [
      {
        watch: 'state.count',
        handler: [{ type: 'setState', key: 'x', value: 1 }],
      },
    ];

    const harness = renderWatcherHook(watchers, { count: 1 }, executeActions);
    await harness.mount();
    await harness.rerender(watchers, { count: 2 });

    const firstCall = executeActions.mock.calls[0] as any[] | undefined;
    const extra = firstCall?.[1];
    expect(extra?.watch?.oldValue).toBe(1);
    expect(extra?.watch?.newValue).toBe(2);
    await harness.unmount();
  });

  it('旧值为 undefined 时，变化到有值也会触发', async () => {
    const executeActions = vi.fn(async () => {});
    const watchers: PageSchema['watchers'] = [
      {
        watch: 'state.maybe',
        handler: [{ type: 'setState', key: 'x', value: 1 }],
      },
    ];

    const harness = renderWatcherHook(watchers, {}, executeActions);
    await harness.mount();
    await harness.rerender(watchers, { maybe: 'value' });

    expect(executeActions).toHaveBeenCalledTimes(1);
    await harness.unmount();
  });
});
