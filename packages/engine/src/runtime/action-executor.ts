import type { ActionChain, ExpressionContext } from '@shenbi/schema';
import type { DataSourceDef, MethodDef, PropValue } from '@shenbi/schema';
import type { StateAction } from '../types/contracts';
import { compileExpression, compileJSFunction, isExpression } from '../compiler/expression';
import { appendQuery, isObject } from './shared';

interface RouterAdapter {
  push?: (to: any) => void | Promise<void>;
  replace?: (to: any) => void | Promise<void>;
  back?: () => void | Promise<void>;
  setQuery?: (query: Record<string, any>) => void | Promise<void>;
}

interface EventBusAdapter {
  emit: (event: string, payload?: any) => void;
}

interface MessageAdapter {
  info?: (content: any) => void;
  success?: (content: any) => void;
  warning?: (content: any) => void;
  error?: (content: any) => void;
  loading?: (content: any) => void;
}

interface NotificationAdapter {
  info?: (config: { message: any; description?: any }) => void;
  success?: (config: { message: any; description?: any }) => void;
  warning?: (config: { message: any; description?: any }) => void;
  error?: (config: { message: any; description?: any }) => void;
}

type ConfirmType = 'confirm' | 'info' | 'success' | 'warning' | 'error';

interface ConfirmAdapter {
  (config: {
    type: ConfirmType;
    title: any;
    content?: any;
    onOk?: () => Promise<void>;
    onCancel?: () => Promise<void>;
  }): void;
}

export interface ExecutorOptions {
  methods: Record<string, MethodDef>;
  dataSources: Record<string, DataSourceDef>;
  refs: Record<string, any>;
  router?: RouterAdapter;
  eventBus?: EventBusAdapter;
  message?: MessageAdapter;
  notification?: NotificationAdapter;
  confirm?: ConfirmAdapter;
  fetcher?: typeof fetch;
  /** 将 Modal.confirm 挂载到页面容器而非 body */
  getPopupContainer?: () => HTMLElement;
}

const expressionCache = new Map<string, ReturnType<typeof compileExpression>>();
const debounceStateMap = new WeakMap<object, { timer: ReturnType<typeof setTimeout>; resolve: () => void }>();
const throttleTimeMap = new WeakMap<object, number>();
const throttleTimerMap = new WeakMap<object, ReturnType<typeof setTimeout>>();

type JSFunctionLike = { type?: string; __type?: string; params?: string[]; body?: string };
type JSExpressionLike = { type?: string; __type?: string; value?: string };

function isJSExpressionObject(value: unknown): value is JSExpressionLike {
  return (
    isObject(value) &&
    (value.type === 'JSExpression' || value.__type === 'JSExpression') &&
    typeof value.value === 'string'
  );
}

function isJSFunctionObject(value: unknown): value is JSFunctionLike {
  return (
    isObject(value) &&
    (value.type === 'JSFunction' || value.__type === 'JSFunction') &&
    typeof value.body === 'string'
  );
}

function toArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function getFetcher(options: ExecutorOptions): typeof fetch {
  if (options.fetcher) {
    return options.fetcher;
  }
  if (typeof fetch === 'function') {
    return fetch;
  }
  throw new Error('Fetch API 不可用');
}

function getCompiledExpression(raw: string) {
  const cached = expressionCache.get(raw);
  if (cached) {
    return cached;
  }
  const compiled = compileExpression(raw);
  expressionCache.set(raw, compiled);
  return compiled;
}

export function resolveValue(value: PropValue | unknown, ctx: ExpressionContext): any {
  if (value == null) {
    return value;
  }

  if (typeof value === 'string') {
    if (isExpression(value)) {
      return getCompiledExpression(value).fn(ctx);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, ctx));
  }

  if (isJSExpressionObject(value)) {
    return getCompiledExpression(value.value ?? '').fn(ctx);
  }

  if (isJSFunctionObject(value)) {
    const compiled = compileJSFunction(value.params ?? [], value.body ?? '');
    return (...args: any[]) => compiled(ctx, ...args);
  }

  if (isObject(value)) {
    const output: Record<string, any> = {};
    for (const [key, child] of Object.entries(value)) {
      output[key] = resolveValue(child, ctx);
    }
    return output;
  }

  return value;
}

async function loadAntdModule(): Promise<any | null> {
  try {
    const importer = new Function('specifier', 'return import(specifier);') as (
      specifier: string,
    ) => Promise<any>;
    return await importer('antd');
  } catch (_error) {
    return null;
  }
}

async function executeIfPresent(
  actions: ActionChain | undefined,
  ctx: ExpressionContext,
  dispatch: (action: StateAction) => void,
  options: ExecutorOptions,
) {
  if (!actions || actions.length === 0) {
    return;
  }
  await executeActions(actions, ctx, dispatch, options);
}

function createMethodContext(
  ctx: ExpressionContext,
  resolvedParams: unknown,
): ExpressionContext {
  if (!isObject(resolvedParams)) {
    return ctx;
  }

  return {
    ...ctx,
    ...resolvedParams,
    params: {
      ...(ctx.params ?? {}),
      ...resolvedParams,
    },
  };
}

function setOverlayState(
  type: 'modal' | 'drawer',
  id: string,
  open: boolean,
  payload: unknown,
  ctx: ExpressionContext,
  dispatch: (action: StateAction) => void,
) {
  const visibleKey = type === 'modal' ? `__dialog_${id}` : `__drawer_${id}`;
  dispatch({ type: 'SET', key: visibleKey, value: open });
  dispatch({
    type: 'SET',
    key: `__dialogPayloads.${id}`,
    value: open && payload !== undefined ? resolveValue(payload, ctx) : null,
  });
}

function resolveFormRef(actionFormRef: string, options: ExecutorOptions, ctx: ExpressionContext): any {
  return options.refs[actionFormRef] ?? ctx.refs?.[actionFormRef];
}

function resolveFetchConfig(
  action: Extract<ActionChain[number], { type: 'fetch' }>,
  ctx: ExpressionContext,
  options: ExecutorOptions,
): {
  dataSourceDef: DataSourceDef | undefined;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers: HeadersInit;
  data: unknown;
} {
  const dataSourceDef = action.datasource ? options.dataSources[action.datasource] : undefined;
  if (action.datasource && !dataSourceDef) {
    throw new Error(`DataSource "${action.datasource}" not found`);
  }

  const method = (action.method ?? dataSourceDef?.api.method ?? 'GET').toUpperCase() as
    'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  const headers = {
    ...resolveValue(dataSourceDef?.api.headers ?? {}, ctx),
    ...resolveValue(action.headers ?? {}, ctx),
  } as HeadersInit;
  const params = {
    ...resolveValue(dataSourceDef?.api.params ?? {}, ctx),
    ...resolveValue(action.params ?? {}, ctx),
  };
  const data = action.data !== undefined
    ? resolveValue(action.data, ctx)
    : resolveValue(dataSourceDef?.api.data, ctx);
  const rawUrl = action.url !== undefined
    ? resolveValue(action.url, ctx)
    : resolveValue(dataSourceDef?.api.url, ctx);

  if (rawUrl == null) {
    throw new Error('Fetch action requires `datasource` or `url`');
  }

  const resolvedUrl = String(rawUrl);
  const url = method === 'GET' ? appendQuery(resolvedUrl, params) : resolvedUrl;
  return { dataSourceDef, method, url, headers, data };
}

export async function executeActions(
  actions: ActionChain,
  ctx: ExpressionContext,
  dispatch: (action: StateAction) => void,
  options: ExecutorOptions,
): Promise<void> {
  for (const action of actions) {
    switch (action.type) {
      case 'setState': {
        const key = resolveValue(action.key, ctx);
        const value = resolveValue(action.value, ctx);
        dispatch({ type: 'SET', key: String(key), value });
        break;
      }
      case 'callMethod': {
        const method = options.methods[action.name];
        if (!method) {
          throw new Error(`Method "${action.name}" not found`);
        }

        const resolvedParams = resolveValue(action.params ?? {}, ctx);
        const methodCtx = createMethodContext(ctx, resolvedParams);

        await executeActions(method.body, methodCtx, dispatch, options);
        break;
      }
      case 'fetch': {
        const { dataSourceDef, method, url, headers, data } = resolveFetchConfig(action, ctx, options);
        const fetcher = getFetcher(options);

        let responseData: any;
        let fetchError: any;

        try {
          const requestInit: RequestInit = {
            method,
            headers: headers as HeadersInit,
          };
          if (method !== 'GET' && data != null) {
            requestInit.body = JSON.stringify(data);
          }

          const response = await fetcher(url, requestInit);

          const contentType = response.headers.get('content-type') ?? '';
          responseData = contentType.includes('application/json')
            ? await response.json()
            : await response.text();

          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
          }

          const successCtx: ExpressionContext = { ...ctx, response: responseData };
          await executeIfPresent(action.onSuccess, successCtx, dispatch, options);
          await executeIfPresent(dataSourceDef?.onSuccess, successCtx, dispatch, options);
        } catch (error) {
          fetchError = error;
          const errorCtx: ExpressionContext = { ...ctx, error };
          await executeIfPresent(action.onError, errorCtx, dispatch, options);
          await executeIfPresent(dataSourceDef?.onError, errorCtx, dispatch, options);
        } finally {
          const finalCtx: ExpressionContext = { ...ctx, response: responseData, error: fetchError };
          await executeIfPresent(action.onFinally, finalCtx, dispatch, options);
          await executeIfPresent(dataSourceDef?.onFinally, finalCtx, dispatch, options);
        }
        break;
      }
      case 'navigate': {
        if (action.back) {
          await options.router?.back?.();
          break;
        }
        const to = resolveValue(action.to, ctx);
        if (action.replace) {
          await options.router?.replace?.(to);
        } else {
          await options.router?.push?.(to);
        }
        break;
      }
      case 'message': {
        const level = action.level ?? 'info';
        const content = resolveValue(action.content, ctx);
        const fn = options.message?.[level];
        if (fn) {
          fn(content);
          break;
        }

        const mod = await loadAntdModule();
        mod?.message?.[level]?.(content);
        break;
      }
      case 'notification': {
        const level = action.level ?? 'info';
        const message = resolveValue(action.message, ctx);
        const description = resolveValue(action.description, ctx);
        const fn = options.notification?.[level];
        if (fn) {
          fn({ message, description });
          break;
        }

        const mod = await loadAntdModule();
        mod?.notification?.[level]?.({ message, description });
        break;
      }
      case 'confirm': {
        const confirmType: ConfirmType = action.confirmType ?? 'confirm';
        const title = resolveValue(action.title, ctx);
        const content = resolveValue(action.content, ctx);
        const onOk = action.onOk
          ? async () => {
              await executeActions(action.onOk ?? [], ctx, dispatch, options);
            }
          : undefined;
        const onCancel = action.onCancel
          ? async () => {
              await executeActions(action.onCancel ?? [], ctx, dispatch, options);
            }
          : undefined;

        if (options.confirm) {
          const confirmConfig: Parameters<ConfirmAdapter>[0] = { type: confirmType, title, content };
          if (onOk) {
            confirmConfig.onOk = onOk;
          }
          if (onCancel) {
            confirmConfig.onCancel = onCancel;
          }
          options.confirm(confirmConfig);
          break;
        }

        const mod = await loadAntdModule();
        const antdConfirmConfig: Record<string, any> = { title, content };
        if (onOk) {
          antdConfirmConfig.onOk = onOk;
        }
        if (onCancel) {
          antdConfirmConfig.onCancel = onCancel;
        }
        const modalFn = mod?.Modal?.[confirmType] ?? mod?.Modal?.confirm;
        if (options.getPopupContainer) {
          antdConfirmConfig.getContainer = options.getPopupContainer;
        }
        modalFn?.(antdConfirmConfig);
        break;
      }
      case 'modal': {
        setOverlayState('modal', action.id, action.open, action.payload, ctx, dispatch);
        break;
      }
      case 'drawer': {
        setOverlayState('drawer', action.id, action.open, action.payload, ctx, dispatch);
        break;
      }
      case 'validate': {
        const form = resolveFormRef(action.formRef, options, ctx);
        if (!form?.validateFields) {
          throw new Error(`Form ref "${action.formRef}" not found`);
        }

        try {
          const validateResult = await form.validateFields();
          const successCtx: ExpressionContext = { ...ctx, validateResult, values: validateResult };
          await executeIfPresent(action.onSuccess, successCtx, dispatch, options);
        } catch (error) {
          const errorCtx: ExpressionContext = { ...ctx, error, errorInfo: error };
          await executeIfPresent(action.onError, errorCtx, dispatch, options);
        }
        break;
      }
      case 'resetForm': {
        const form = resolveFormRef(action.formRef, options, ctx);
        form?.resetFields?.(action.fields);
        break;
      }
      case 'condition': {
        const condition = resolveValue(action.if, ctx);
        if (condition) {
          await executeIfPresent(action.then, ctx, dispatch, options);
        } else {
          await executeIfPresent(action.else, ctx, dispatch, options);
        }
        break;
      }
      case 'loop': {
        const data = resolveValue(action.data, ctx);
        const list = Array.isArray(data) ? data : [];
        const itemKey = action.itemKey ?? 'item';
        const indexKey = action.indexKey ?? 'index';

        for (let index = 0; index < list.length; index += 1) {
          const item = list[index];
          const loopCtx: ExpressionContext = {
            ...ctx,
            [itemKey]: item,
            [indexKey]: index,
            loop: { item, index },
          };
          await executeActions(action.body, loopCtx, dispatch, options);
        }
        break;
      }
      case 'script': {
        const scriptRunner = new Function('ctx', action.code) as (scriptCtx: ExpressionContext) => any;
        try {
          await scriptRunner(ctx);
        } catch (_error) {
          // 自定义脚本异常不阻塞主流程
        }
        break;
      }
      case 'copy': {
        const text = String(resolveValue(action.text, ctx) ?? '');
        if (typeof navigator !== 'undefined') {
          await navigator.clipboard?.writeText?.(text);
        }
        break;
      }
      case 'debounce': {
        await new Promise<void>((resolve) => {
          const previous = debounceStateMap.get(action);
          if (previous) {
            clearTimeout(previous.timer);
            previous.resolve();
          }

          const timer = setTimeout(async () => {
            debounceStateMap.delete(action);
            await executeActions(action.body, ctx, dispatch, options);
            resolve();
          }, action.wait);
          debounceStateMap.set(action, { timer, resolve });
        });
        break;
      }
      case 'throttle': {
        const now = Date.now();
        const lastRun = throttleTimeMap.get(action) ?? 0;
        const remaining = action.wait - (now - lastRun);

        if (remaining <= 0) {
          throttleTimeMap.set(action, now);
          await executeActions(action.body, ctx, dispatch, options);
          break;
        }

        await new Promise<void>((resolve) => {
          const pending = throttleTimerMap.get(action);
          if (pending) {
            resolve();
            return;
          }

          const timer = setTimeout(async () => {
            throttleTimeMap.set(action, Date.now());
            throttleTimerMap.delete(action);
            await executeActions(action.body, ctx, dispatch, options);
            resolve();
          }, remaining);
          throttleTimerMap.set(action, timer);
        });
        break;
      }
      case 'batch': {
        await executeActions(action.actions, ctx, dispatch, options);
        break;
      }
      case 'emit': {
        const payload = resolveValue(action.payload, ctx);
        options.eventBus?.emit(action.event, payload);
        break;
      }
      case 'callProp': {
        const propsFromParams = ctx.params?.props ?? {};
        const propFn = propsFromParams[action.name];
        if (typeof propFn === 'function') {
          const args = toArray(action.args).map((arg) => resolveValue(arg, ctx));
          await propFn(...args);
        }
        break;
      }
      case 'setQuery': {
        const query = resolveValue(action.query, ctx);
        await options.router?.setQuery?.(query);
        break;
      }
      case 'download': {
        const url = String(resolveValue(action.url, ctx) ?? '');
        const filename = resolveValue(action.filename, ctx);

        if (typeof document !== 'undefined' && filename) {
          const link = document.createElement('a');
          link.href = url;
          link.download = String(filename);
          link.click();
        } else if (typeof window !== 'undefined') {
          window.open(url, '_blank');
        }
        break;
      }
      default:
        break;
    }
  }
}
