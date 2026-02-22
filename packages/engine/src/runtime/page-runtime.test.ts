import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PageSchema } from '@shenbi/schema';
import { usePageRuntime, type UsePageRuntimeOptions } from './page-runtime';

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

function renderPageRuntimeHook(page: PageSchema, options: UsePageRuntimeOptions = {}) {
  let latest = null as ReturnType<typeof usePageRuntime> | null;

  function Harness(props: { schema: PageSchema; runtimeOptions: UsePageRuntimeOptions }) {
    latest = usePageRuntime(props.schema, props.runtimeOptions);
    return null;
  }

  const container = document.createElement('div');
  const root = createRoot(container);

  const render = async (schema: PageSchema, runtimeOptions: UsePageRuntimeOptions) => {
    await act(async () => {
      root.render(createElement(Harness, { schema, runtimeOptions }));
    });
  };

  return {
    async mount() {
      await render(page, options);
    },
    async rerender(nextPage: PageSchema, nextOptions: UsePageRuntimeOptions = options) {
      await render(nextPage, nextOptions);
    },
    getLatest() {
      if (!latest) {
        throw new Error('Hook 尚未初始化');
      }
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

describe('runtime/page-runtime', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('params 会合并 page.params 与 options.params，且 options 优先', async () => {
    const page: PageSchema = {
      body: { component: 'Container' },
      params: {
        fromPage: 'page',
        override: 'page',
      },
    };

    const harness = renderPageRuntimeHook(page, {
      params: {
        fromOption: 'option',
        override: 'option',
      },
    });

    await harness.mount();
    const first = harness.getLatest().getContext().params;
    expect(first).toEqual({
      fromPage: 'page',
      fromOption: 'option',
      override: 'option',
    });

    await harness.rerender(page, {
      params: {
        fromOption: 'option-2',
        override: 'option-2',
      },
    });
    const second = harness.getLatest().getContext().params;
    expect(second).toEqual({
      fromPage: 'page',
      fromOption: 'option-2',
      override: 'option-2',
    });

    await harness.unmount();
  });

  it('onLoad/onMount 仅首次加载执行一次，onUnmount 在卸载时执行一次', async () => {
    const info = vi.fn();
    const pageA: PageSchema = {
      id: 'a',
      body: { component: 'Container' },
      lifecycle: {
        onLoad: [{ type: 'message', level: 'info', content: 'load-a' }],
        onMount: [{ type: 'message', level: 'info', content: 'mount-a' }],
        onUnmount: [{ type: 'message', level: 'info', content: 'unmount-a' }],
      },
    };
    const pageB: PageSchema = {
      id: 'b',
      body: { component: 'Container' },
      lifecycle: {
        onLoad: [{ type: 'message', level: 'info', content: 'load-b' }],
        onMount: [{ type: 'message', level: 'info', content: 'mount-b' }],
        onUnmount: [{ type: 'message', level: 'info', content: 'unmount-b' }],
      },
    };

    const harness = renderPageRuntimeHook(pageA, {
      message: { info },
    });
    await harness.mount();
    await harness.flush();

    expect(info).toHaveBeenCalledWith('load-a');
    expect(info).toHaveBeenCalledWith('mount-a');
    expect(info).not.toHaveBeenCalledWith('load-b');
    expect(info).not.toHaveBeenCalledWith('mount-b');

    await harness.rerender(pageB, {
      message: { info },
    });
    await harness.flush();

    expect(info).not.toHaveBeenCalledWith('load-b');
    expect(info).not.toHaveBeenCalledWith('mount-b');

    await harness.unmount();
    await harness.flush();

    const unmountCalls = info.mock.calls.filter(([message]) =>
      String(message).startsWith('unmount'),
    );
    expect(unmountCalls).toHaveLength(1);
  });

  it('datasource 会使用 runtime 注入的 params/computed 作为表达式上下文', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const page: PageSchema = {
      body: { component: 'Container' },
      state: {
        count: { default: 2 },
      },
      params: {
        keyword: 'from-page',
      },
      computed: {
        total: {
          deps: ['state.count'],
          expr: '{{state.count + 1}}',
        },
      },
      dataSources: {
        users: {
          auto: true,
          api: {
            method: 'GET',
            url: '/api/users',
            params: {
              q: '{{params.keyword}}',
              total: '{{computed.total}}',
            },
          },
        },
      },
    };

    const harness = renderPageRuntimeHook(page, {
      params: {
        keyword: 'from-option',
      },
    });
    await harness.mount();
    await harness.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/users?q=from-option&total=3');

    await harness.unmount();
  });

  it('datasource 在运行时可读取 registerRef 注入的 refs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const page: PageSchema = {
      body: { component: 'Container' },
      state: {
        trigger: { default: 0 },
      },
      dataSources: {
        users: {
          auto: false,
          deps: ['state.trigger'],
          api: {
            method: 'GET',
            url: '/api/users',
            params: {
              formId: '{{refs.formRef.id}}',
            },
          },
        },
      },
    };

    const harness = renderPageRuntimeHook(page);
    await harness.mount();
    expect(fetchMock).toHaveBeenCalledTimes(0);

    await act(async () => {
      harness.getLatest().registerRef('formRef', { id: 'FORM-42' });
      harness.getLatest().dispatch({ type: 'SET', key: 'trigger', value: 1 });
    });
    await harness.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/users?formId=FORM-42');

    await harness.unmount();
  });
});
