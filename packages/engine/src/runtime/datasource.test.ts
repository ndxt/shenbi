import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PageSchema } from '@shenbi/schema';
import { useDataSources } from './datasource';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function createResponse(data: any, ok = true, status = 200) {
  return {
    ok,
    status,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
    },
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response;
}

function renderDataSourceHook(
  dataSources: PageSchema['dataSources'],
  state: Record<string, any>,
  executeActions: (actions: any, extra?: any) => Promise<void>,
  getRuntimeContext?: () => { params?: Record<string, any>; computed?: Record<string, any>; refs?: Record<string, any> },
) {
  let latest: Record<string, any> = {};

  function Harness(props: {
    defs: PageSchema['dataSources'];
    runtimeState: Record<string, any>;
    onExecute: (actions: any, extra?: any) => Promise<void>;
    getContext?: () => { params?: Record<string, any>; computed?: Record<string, any>; refs?: Record<string, any> };
  }) {
    latest = useDataSources(props.defs, props.runtimeState, props.onExecute, props.getContext);
    return null;
  }

  const container = document.createElement('div');
  const root = createRoot(container);

  const render = async (defs: PageSchema['dataSources'], runtimeState: Record<string, any>) => {
    await act(async () => {
      const harnessProps: {
        defs: PageSchema['dataSources'];
        runtimeState: Record<string, any>;
        onExecute: (actions: any, extra?: any) => Promise<void>;
        getContext?: () => { params?: Record<string, any>; computed?: Record<string, any>; refs?: Record<string, any> };
      } = {
        defs,
        runtimeState,
        onExecute: executeActions,
      };

      if (getRuntimeContext) {
        harnessProps.getContext = getRuntimeContext;
      }

      root.render(
        createElement(Harness, harnessProps),
      );
    });
  };

  return {
    async mount() {
      await render(dataSources, state);
    },
    async rerender(nextDefs: PageSchema['dataSources'], nextState: Record<string, any>) {
      await render(nextDefs, nextState);
    },
    getLatest() {
      return latest;
    },
    async flush() {
      await act(async () => {
        await Promise.resolve();
      });
      await act(async () => {
        await Promise.resolve();
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
    },
  };
}

describe('runtime/datasource', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('auto 为 true 时会在初始化自动请求', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createResponse({ list: [1, 2] }));
    vi.stubGlobal('fetch', fetchMock);

    const defs: PageSchema['dataSources'] = {
      users: {
        auto: true,
        api: { method: 'GET', url: '/api/users' },
      },
    };

    const harness = renderDataSourceHook(defs, {}, vi.fn(async () => {}));
    await harness.mount();
    await harness.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(harness.getLatest().users.data).toEqual({ list: [1, 2] });
    expect(harness.getLatest().users.loading).toBe(false);
    await harness.unmount();
  });

  it('deps 变化会触发重新请求', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createResponse({ ok: 1 }))
      .mockResolvedValueOnce(createResponse({ ok: 2 }));
    vi.stubGlobal('fetch', fetchMock);

    const defs: PageSchema['dataSources'] = {
      users: {
        auto: true,
        deps: ['state.keyword'],
        api: { method: 'GET', url: '/api/users', params: { q: '{{state.keyword}}' } },
      },
    };

    const harness = renderDataSourceHook(defs, { keyword: 'a' }, vi.fn(async () => {}));
    await harness.mount();
    await harness.flush();

    await harness.rerender(defs, { keyword: 'b' });
    await harness.flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toContain('q=b');
    await harness.unmount();
  });

  it('表达式参数会在请求前解析', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const defs: PageSchema['dataSources'] = {
      users: {
        auto: true,
        api: { method: 'GET', url: '/api/users', params: { q: '{{state.keyword}}', page: 2 } },
      },
    };

    const harness = renderDataSourceHook(defs, { keyword: 'test' }, vi.fn(async () => {}));
    await harness.mount();
    await harness.flush();

    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/users?q=test&page=2');
    await harness.unmount();
  });

  it('datasource 表达式可访问 params/computed/refs 上下文', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const defs: PageSchema['dataSources'] = {
      users: {
        auto: true,
        api: {
          method: 'GET',
          url: '/api/users',
          params: {
            q: '{{params.keyword}}',
            total: '{{computed.total}}',
            form: '{{refs.formRef.id}}',
          },
        },
      },
    };

    const harness = renderDataSourceHook(
      defs,
      {},
      vi.fn(async () => {}),
      () => ({
        params: { keyword: 'from-params' },
        computed: { total: 3 },
        refs: { formRef: { id: 'FORM-1' } },
      }),
    );
    await harness.mount();
    await harness.flush();

    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/users?q=from-params&total=3&form=FORM-1');
    await harness.unmount();
  });

  it('transform 会对响应数据做转换', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createResponse({ items: [1, 2, 3] }));
    vi.stubGlobal('fetch', fetchMock);

    const defs: PageSchema['dataSources'] = {
      users: {
        auto: true,
        api: { method: 'GET', url: '/api/users' },
        transform: {
          type: 'JSFunction',
          params: ['data'],
          body: 'return data.items.map((n) => n * 2);',
        },
      },
    };

    const harness = renderDataSourceHook(defs, {}, vi.fn(async () => {}));
    await harness.mount();
    await harness.flush();

    expect(harness.getLatest().users.data).toEqual([2, 4, 6]);
    await harness.unmount();
  });

  it('onSuccess/onError 会触发对应动作链', async () => {
    const executeActions = vi.fn(async () => {});

    const successFetch = vi.fn().mockResolvedValue(createResponse({ ok: true }, true));
    vi.stubGlobal('fetch', successFetch);

    const successDefs: PageSchema['dataSources'] = {
      users: {
        auto: true,
        api: { method: 'GET', url: '/api/users' },
        onSuccess: [{ type: 'setState', key: 'ok', value: true }],
      },
    };

    const successHarness = renderDataSourceHook(successDefs, {}, executeActions);
    await successHarness.mount();
    await successHarness.flush();

    expect(executeActions).toHaveBeenCalledWith(
      successDefs.users?.onSuccess,
      expect.objectContaining({ dataSource: 'users' }),
    );
    await successHarness.unmount();

    executeActions.mockClear();

    const errorFetch = vi.fn().mockResolvedValue(createResponse({ ok: false }, false, 500));
    vi.stubGlobal('fetch', errorFetch);

    const errorDefs: PageSchema['dataSources'] = {
      users: {
        auto: true,
        api: { method: 'GET', url: '/api/users' },
        onError: [{ type: 'setState', key: 'ok', value: false }],
      },
    };

    const errorHarness = renderDataSourceHook(errorDefs, {}, executeActions);
    await errorHarness.mount();
    await errorHarness.flush();

    expect(executeActions).toHaveBeenCalledWith(
      errorDefs.users?.onError,
      expect.objectContaining({ dataSource: 'users' }),
    );
    await errorHarness.unmount();
  });

  it('请求过程中 loading=true，请求完成后 loading=false', async () => {
    let resolveFetch: (response: Response) => void = () => {};
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const defs: PageSchema['dataSources'] = {
      users: {
        auto: true,
        api: { method: 'GET', url: '/api/users' },
      },
    };

    const harness = renderDataSourceHook(defs, {}, vi.fn(async () => {}));
    await harness.mount();
    await harness.flush();

    expect(harness.getLatest().users.loading).toBe(true);

    resolveFetch(createResponse({ ok: true }, true));
    await harness.flush();

    expect(harness.getLatest().users.loading).toBe(false);
    await harness.unmount();
  });

  it('deps + debounce 连续变化时只请求最后一次', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(createResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const defs: PageSchema['dataSources'] = {
      users: {
        deps: ['state.keyword'],
        debounce: 100,
        api: { method: 'GET', url: '/api/users', params: { q: '{{state.keyword}}' } },
      },
    };

    const harness = renderDataSourceHook(defs, { keyword: 'a' }, vi.fn(async () => {}));
    await harness.mount();

    await harness.rerender(defs, { keyword: 'b' });
    await harness.rerender(defs, { keyword: 'c' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await harness.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('q=c');
    await harness.unmount();
  });

  it('deps + debounce 排队后不会被无关重渲染取消', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(createResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const defs: PageSchema['dataSources'] = {
      users: {
        deps: ['state.keyword'],
        debounce: 100,
        api: { method: 'GET', url: '/api/users', params: { q: '{{state.keyword}}' } },
      },
    };

    const harness = renderDataSourceHook(defs, { keyword: 'a', other: 1 }, vi.fn(async () => {}));
    await harness.mount();

    await harness.rerender(defs, { keyword: 'b', other: 1 });
    await harness.rerender(defs, { keyword: 'b', other: 2 });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await harness.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('q=b');
    await harness.unmount();
  });

  it('过期请求不会触发 onSuccess/onFinally 回调', async () => {
    const resolvers: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const executeActions = vi.fn(async () => {});
    const defs: PageSchema['dataSources'] = {
      users: {
        auto: true,
        deps: ['state.keyword'],
        api: { method: 'GET', url: '/api/users', params: { q: '{{state.keyword}}' } },
        onSuccess: [{ type: 'setState', key: 'ok', value: true }],
        onFinally: [{ type: 'setState', key: 'done', value: true }],
      },
    };

    const harness = renderDataSourceHook(defs, { keyword: 'a' }, executeActions);
    await harness.mount();
    await harness.rerender(defs, { keyword: 'b' });

    resolvers[0]?.(createResponse({ from: 'old' }, true));
    await harness.flush();
    expect(executeActions).toHaveBeenCalledTimes(0);

    resolvers[1]?.(createResponse({ from: 'new' }, true));
    await harness.flush();
    expect(executeActions).toHaveBeenCalledTimes(2);
    await harness.unmount();
  });

  it('移除 datasource 配置时会中止在途请求且不触发回调', async () => {
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined;
          signal?.addEventListener('abort', () => {
            const abortError = new Error('Aborted');
            (abortError as any).name = 'AbortError';
            reject(abortError);
          });
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const executeActions = vi.fn(async () => {});
    const defs: PageSchema['dataSources'] = {
      users: {
        auto: true,
        api: { method: 'GET', url: '/api/users' },
        onError: [{ type: 'setState', key: 'err', value: true }],
        onFinally: [{ type: 'setState', key: 'done', value: true }],
      },
    };

    const harness = renderDataSourceHook(defs, {}, executeActions);
    await harness.mount();
    await harness.rerender({}, {});
    await harness.flush();

    expect(executeActions).not.toHaveBeenCalled();
    await harness.unmount();
  });

  it('deps 含循环引用对象时不会抛错', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const defs: PageSchema['dataSources'] = {
      users: {
        auto: true,
        deps: ['state.filters'],
        api: { method: 'GET', url: '/api/users' },
      },
    };

    const filters: Record<string, any> = { keyword: 'a' };
    filters.self = filters;

    const harness = renderDataSourceHook(defs, { filters }, vi.fn(async () => {}));
    await harness.mount();
    await harness.flush();

    filters.keyword = 'b';
    await harness.rerender(defs, { filters });
    await harness.flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    await harness.unmount();
  });

  it('组件卸载后，请求返回不会再触发回调动作', async () => {
    let resolveFetch: (response: Response) => void = () => {};
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const executeActions = vi.fn(async () => {});
    const defs: PageSchema['dataSources'] = {
      users: {
        auto: true,
        api: { method: 'GET', url: '/api/users' },
        onSuccess: [{ type: 'setState', key: 'ok', value: true }],
        onFinally: [{ type: 'setState', key: 'done', value: true }],
      },
    };

    const harness = renderDataSourceHook(defs, {}, executeActions);
    await harness.mount();
    await harness.unmount();

    resolveFetch(createResponse({ ok: true }, true));
    await act(async () => {
      await Promise.resolve();
    });

    expect(executeActions).not.toHaveBeenCalled();
  });
});
