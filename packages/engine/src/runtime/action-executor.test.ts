import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ActionChain, ExpressionContext } from '@shenbi/schema';
import { executeActions, resolveValue, type ExecutorOptions } from './action-executor';

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

function createOptions(overrides: Partial<ExecutorOptions> = {}): ExecutorOptions {
  return {
    methods: {},
    dataSources: {},
    refs: {},
    ...overrides,
  };
}

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

describe('runtime/action-executor', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('setState 支持简单值和表达式值', async () => {
    const dispatch = vi.fn();
    const actions: ActionChain = [
      { type: 'setState', key: 'count', value: 1 },
      { type: 'setState', key: 'next', value: '{{state.count + 1}}' },
    ];

    await executeActions(actions, createCtx({ count: 2 }), dispatch, createOptions());

    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'SET', key: 'count', value: 1 });
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'SET', key: 'next', value: 3 });
  });

  it('callMethod 会查找方法并递归执行 body', async () => {
    const dispatch = vi.fn();
    const options = createOptions({
      methods: {
        handleSubmit: {
          body: [{ type: 'setState', key: 'loading', value: true }],
        },
      },
    });

    await executeActions([{ type: 'callMethod', name: 'handleSubmit' }], createCtx(), dispatch, options);

    expect(dispatch).toHaveBeenCalledWith({ type: 'SET', key: 'loading', value: true });
  });

  it('callMethod 方法不存在时抛错', async () => {
    await expect(
      executeActions(
        [{ type: 'callMethod', name: 'missingMethod' }],
        createCtx(),
        vi.fn(),
        createOptions(),
      ),
    ).rejects.toThrow('missingMethod');
  });

  it('condition 为 true 执行 then 分支', async () => {
    const dispatch = vi.fn();
    const action: ActionChain = [
      {
        type: 'condition',
        if: '{{state.ok}}',
        then: [{ type: 'setState', key: 'result', value: 'then' }],
        else: [{ type: 'setState', key: 'result', value: 'else' }],
      },
    ];

    await executeActions(action, createCtx({ ok: true }), dispatch, createOptions());

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET', key: 'result', value: 'then' });
  });

  it('condition 无 else 且条件为 false 时不执行任何动作', async () => {
    const dispatch = vi.fn();
    const action: ActionChain = [
      {
        type: 'condition',
        if: '{{state.ok}}',
        then: [{ type: 'setState', key: 'result', value: 'then' }],
      },
    ];

    await executeActions(action, createCtx({ ok: false }), dispatch, createOptions());

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('loop 会遍历数组并依次执行 body', async () => {
    const dispatch = vi.fn();
    const action: ActionChain = [
      {
        type: 'loop',
        data: '{{state.list}}',
        itemKey: 'item',
        indexKey: 'idx',
        body: [{ type: 'setState', key: 'last', value: '{{item + "-" + idx}}' }],
      },
    ];

    await executeActions(action, createCtx({ list: ['a', 'b'] }), dispatch, createOptions());

    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'SET', key: 'last', value: 'a-0' });
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'SET', key: 'last', value: 'b-1' });
  });

  it('batch 会按顺序执行多个 action', async () => {
    const dispatch = vi.fn();
    const action: ActionChain = [
      {
        type: 'batch',
        actions: [
          { type: 'setState', key: 'a', value: 1 },
          { type: 'setState', key: 'b', value: 2 },
        ],
      },
    ];

    await executeActions(action, createCtx(), dispatch, createOptions());

    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'SET', key: 'a', value: 1 });
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'SET', key: 'b', value: 2 });
  });

  it('message 会调用 message 适配器', async () => {
    const info = vi.fn();
    const action: ActionChain = [{ type: 'message', content: '{{state.msg}}', level: 'info' }];

    await executeActions(
      action,
      createCtx({ msg: 'ok' }),
      vi.fn(),
      createOptions({ message: { info } }),
    );

    expect(info).toHaveBeenCalledWith('ok');
  });

  it('fetch 成功会执行 onSuccess 和 onFinally', async () => {
    const dispatch = vi.fn();
    const fetcher = vi.fn().mockResolvedValue(createResponse({ user: { name: 'Tom' } }, true, 200));
    const action: ActionChain = [
      {
        type: 'fetch',
        datasource: 'loadUser',
        onSuccess: [{ type: 'setState', key: 'name', value: '{{response.user.name}}' }],
        onFinally: [{ type: 'setState', key: 'done', value: true }],
      },
    ];

    const options = createOptions({
      fetcher,
      dataSources: {
        loadUser: {
          api: {
            method: 'GET',
            url: '/api/user',
          },
        },
      },
    });

    await executeActions(action, createCtx(), dispatch, options);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'SET', key: 'name', value: 'Tom' });
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'SET', key: 'done', value: true });
  });

  it('fetch 支持直接 url + params（无 datasource）', async () => {
    const fetcher = vi.fn().mockResolvedValue(createResponse({ ok: true }));
    const dispatch = vi.fn();
    const action: ActionChain = [
      {
        type: 'fetch',
        url: '/api/users',
        params: {
          keyword: '{{state.keyword}}',
          page: '{{state.page}}',
        },
      },
    ];

    await executeActions(action, createCtx({ keyword: 'tom', page: 2 }), dispatch, createOptions({ fetcher }));

    const [calledUrl, calledInit] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('/api/users?');
    const queryString = calledUrl.split('?')[1] ?? '';
    const query = new URLSearchParams(queryString);
    expect(query.get('keyword')).toBe('tom');
    expect(query.get('page')).toBe('2');
    expect(calledInit.method).toBe('GET');
  });

  it('fetch 支持 datasource 配置与 action 参数覆盖', async () => {
    const fetcher = vi.fn().mockResolvedValue(createResponse({ ok: true }));
    const action: ActionChain = [
      {
        type: 'fetch',
        datasource: 'saveUser',
        method: 'POST',
        url: '/api/users/override',
        headers: {
          'x-action': 'yes',
        },
        data: {
          name: '{{state.name}}',
        },
      },
    ];

    await executeActions(
      action,
      createCtx({ name: 'Amy' }),
      vi.fn(),
      createOptions({
        fetcher,
        dataSources: {
          saveUser: {
            api: {
              method: 'PUT',
              url: '/api/users/from-ds',
              headers: {
                'x-ds': '1',
              },
              data: {
                from: 'datasource',
              },
            },
          },
        },
      }),
    );

    const [calledUrl, calledInit] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe('/api/users/override');
    expect(calledInit.method).toBe('POST');
    expect(calledInit.headers).toEqual({
      'x-ds': '1',
      'x-action': 'yes',
    });
    expect(calledInit.body).toBe(JSON.stringify({ name: 'Amy' }));
  });

  it('fetch 失败会执行 onError 和 onFinally', async () => {
    const dispatch = vi.fn();
    const fetcher = vi.fn().mockResolvedValue(createResponse({ error: 'bad' }, false, 500));
    const action: ActionChain = [
      {
        type: 'fetch',
        datasource: 'loadUser',
        onError: [{ type: 'setState', key: 'error', value: '{{error.message}}' }],
        onFinally: [{ type: 'setState', key: 'done', value: true }],
      },
    ];

    const options = createOptions({
      fetcher,
      dataSources: {
        loadUser: {
          api: {
            method: 'GET',
            url: '/api/user',
          },
        },
      },
    });

    await executeActions(action, createCtx(), dispatch, options);

    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: 'SET',
      key: 'error',
      value: 'Request failed with status 500',
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'SET', key: 'done', value: true });
  });

  it('modal/drawer 会写入显隐状态和 payload', async () => {
    const dispatch = vi.fn();
    const action: ActionChain = [
      { type: 'modal', id: 'user', open: true, payload: '{{state.id}}' },
      { type: 'drawer', id: 'detail', open: true, payload: { p: '{{state.id}}' } },
    ];

    await executeActions(action, createCtx({ id: 99 }), dispatch, createOptions());

    expect(dispatch).toHaveBeenCalledWith({ type: 'SET', key: '__dialog_user', value: true });
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET', key: '__dialogPayloads.user', value: 99 });
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET', key: '__drawer_detail', value: true });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET',
      key: '__dialogPayloads.detail',
      value: { p: 99 },
    });
  });

  it('modal close 会清空 payload', async () => {
    const dispatch = vi.fn();
    const action: ActionChain = [
      { type: 'modal', id: 'user', open: true, payload: '{{state.id}}' },
      { type: 'modal', id: 'user', open: false },
    ];

    await executeActions(action, createCtx({ id: 99 }), dispatch, createOptions());

    expect(dispatch).toHaveBeenCalledWith({ type: 'SET', key: '__dialog_user', value: false });
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET', key: '__dialogPayloads.user', value: null });
  });

  it('validate 校验通过执行 onSuccess', async () => {
    const dispatch = vi.fn();
    const validateFields = vi.fn().mockResolvedValue({});
    const action: ActionChain = [
      {
        type: 'validate',
        formRef: 'formRef',
        onSuccess: [{ type: 'setState', key: 'valid', value: true }],
      },
    ];

    await executeActions(
      action,
      createCtx(),
      dispatch,
      createOptions({ refs: { formRef: { validateFields } } }),
    );

    expect(validateFields).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET', key: 'valid', value: true });
  });

  it('validate 校验失败执行 onError', async () => {
    const dispatch = vi.fn();
    const validateFields = vi.fn().mockRejectedValue(new Error('invalid'));
    const action: ActionChain = [
      {
        type: 'validate',
        formRef: 'formRef',
        onError: [{ type: 'setState', key: 'valid', value: false }],
      },
    ];

    await executeActions(
      action,
      createCtx(),
      dispatch,
      createOptions({ refs: { formRef: { validateFields } } }),
    );

    expect(dispatch).toHaveBeenCalledWith({ type: 'SET', key: 'valid', value: false });
  });

  it('validate 在 ref 不存在时抛错', async () => {
    await expect(
      executeActions(
        [{ type: 'validate', formRef: 'missing' }],
        createCtx(),
        vi.fn(),
        createOptions(),
      ),
    ).rejects.toThrow('missing');
  });

  it('resetForm 支持按字段重置', async () => {
    const resetFields = vi.fn();
    const action: ActionChain = [
      {
        type: 'resetForm',
        formRef: 'formRef',
        fields: ['name', 'status'],
      },
    ];

    await executeActions(
      action,
      createCtx(),
      vi.fn(),
      createOptions({
        refs: { formRef: { resetFields } },
      }),
    );

    expect(resetFields).toHaveBeenCalledWith(['name', 'status']);
  });

  it('confirm 会传递 confirmType 并执行 onOk/onCancel', async () => {
    const dispatch = vi.fn();
    const confirm = vi.fn();
    const action: ActionChain = [
      {
        type: 'confirm',
        confirmType: 'warning',
        title: '确认',
        content: '是否继续',
        onOk: [{ type: 'setState', key: 'result', value: 'ok' }],
        onCancel: [{ type: 'setState', key: 'result', value: 'cancel' }],
      },
    ];

    await executeActions(action, createCtx(), dispatch, createOptions({ confirm }));

    expect(confirm).toHaveBeenCalledTimes(1);
    const config = confirm.mock.calls[0]![0] as {
      type: 'warning';
      onOk?: () => Promise<void>;
      onCancel?: () => Promise<void>;
    };
    expect(config.type).toBe('warning');
    await config.onOk?.();
    await config.onCancel?.();

    expect(dispatch).toHaveBeenCalledWith({ type: 'SET', key: 'result', value: 'ok' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET', key: 'result', value: 'cancel' });
  });

  it('debounce 连续调用只执行最后一次', async () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const debounceAction: ActionChain[number] = {
      type: 'debounce',
      wait: 100,
      body: [{ type: 'setState', key: 'v', value: '{{state.v}}' }],
    };

    const p1 = executeActions([debounceAction], createCtx({ v: 1 }), dispatch, createOptions());
    const p2 = executeActions([debounceAction], createCtx({ v: 2 }), dispatch, createOptions());

    await vi.advanceTimersByTimeAsync(100);
    await Promise.all([p1, p2]);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET', key: 'v', value: 2 });
  });

  it('throttle 在窗口期内只追加一次延后执行', async () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const throttleAction: ActionChain[number] = {
      type: 'throttle',
      wait: 100,
      body: [{ type: 'setState', key: 'v', value: '{{state.v}}' }],
    };

    const p1 = executeActions([throttleAction], createCtx({ v: 1 }), dispatch, createOptions());
    const p2 = executeActions([throttleAction], createCtx({ v: 2 }), dispatch, createOptions());

    await vi.advanceTimersByTimeAsync(100);
    await Promise.all([p1, p2]);

    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'SET', key: 'v', value: 1 });
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'SET', key: 'v', value: 2 });
  });

  it('emit/callProp/setQuery 会调用对应适配器', async () => {
    const emit = vi.fn();
    const setQuery = vi.fn();
    const propFn = vi.fn();

    const action: ActionChain = [
      { type: 'emit', event: 'saved', payload: '{{state.id}}' },
      { type: 'callProp', name: 'onSubmit', args: ['{{state.id}}'] },
      { type: 'setQuery', query: { id: '{{state.id}}' } },
    ];

    await executeActions(
      action,
      {
        ...createCtx({ id: 7 }),
        params: {
          props: {
            onSubmit: propFn,
          },
        },
      },
      vi.fn(),
      createOptions({
        eventBus: { emit },
        router: { setQuery },
      }),
    );

    expect(emit).toHaveBeenCalledWith('saved', 7);
    expect(propFn).toHaveBeenCalledWith(7);
    expect(setQuery).toHaveBeenCalledWith({ id: 7 });
  });

  it('copy 和 download 会调用浏览器能力', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const action: ActionChain = [
      { type: 'copy', text: '{{state.txt}}' },
      { type: 'download', url: '{{state.url}}' },
    ];

    await executeActions(action, createCtx({ txt: 'abc', url: '/file.txt' }), vi.fn(), createOptions());

    expect(writeText).toHaveBeenCalledWith('abc');
    expect(open).toHaveBeenCalledWith('/file.txt', '_blank');
  });

  it('resolveValue 可解析表达式、数组和对象', () => {
    const ctx = createCtx({ a: 1, b: 2 });
    expect(resolveValue('{{state.a + state.b}}', ctx)).toBe(3);
    expect(resolveValue(['{{state.a}}', 2], ctx)).toEqual([1, 2]);
    expect(resolveValue({ x: '{{state.b}}', y: 'ok' }, ctx)).toEqual({ x: 2, y: 'ok' });
  });
});
