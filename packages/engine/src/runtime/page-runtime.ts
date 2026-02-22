import type { ActionChain, ExpressionContext, PageSchema } from '@shenbi/schema';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { PageRuntime } from '../types/contracts';
import { executeActions, type ExecutorOptions } from './action-executor';
import { useComputed } from './computed';
import { useDataSources } from './datasource';
import { isObject, toExpressionDataSources } from './shared';
import { usePageState } from './state';
import { useSyncToUrl } from './sync-url';
import { useWatchers } from './watcher';

interface DataSourceRuntimeState {
  data: any;
  loading: boolean;
  error: any;
}

type RuntimeAdapters = Omit<Partial<ExecutorOptions>, 'methods' | 'dataSources' | 'refs'>;
type RuntimeContextExtras = Pick<ExpressionContext, 'params' | 'computed' | 'refs'>;

export interface UsePageRuntimeOptions extends RuntimeAdapters {
  params?: Record<string, any>;
}

function readDialogPayloads(state: Record<string, any>): Record<string, any> {
  const payloads = state.__dialogPayloads;
  return isObject(payloads) ? payloads : {};
}

function readPageParams(page: PageSchema): Record<string, any> {
  return isObject(page.params) ? page.params : {};
}

function mergeRuntimeParams(page: PageSchema, options: UsePageRuntimeOptions): Record<string, any> {
  return {
    ...readPageParams(page),
    ...(options.params ?? {}),
  };
}

export function usePageRuntime(
  page: PageSchema,
  options: UsePageRuntimeOptions = {},
): PageRuntime {
  const { state, dispatch } = usePageState(page);
  const computed = useComputed(page.computed, state);

  const pageRef = useRef(page);
  const mountedPageRef = useRef(page);
  const paramsRef = useRef<Record<string, any>>(mergeRuntimeParams(page, options));
  const adaptersRef = useRef<RuntimeAdapters>(options);
  const stateRef = useRef<Record<string, any>>(state);
  const computedRef = useRef<Record<string, any>>(computed);
  const refsRef = useRef<Record<string, any>>({});
  const dsStateRef = useRef<Record<string, DataSourceRuntimeState>>({});

  pageRef.current = page;
  paramsRef.current = mergeRuntimeParams(page, options);
  adaptersRef.current = options;
  stateRef.current = state;
  computedRef.current = computed;

  const getContext = useCallback(
    (extra?: Partial<ExpressionContext>): ExpressionContext => ({
      state: stateRef.current,
      params: paramsRef.current,
      computed: computedRef.current,
      ds: toExpressionDataSources(dsStateRef.current),
      refs: refsRef.current,
      utils: {},
      ...extra,
    }),
    [],
  );

  const getDataSourceRuntimeContext = useCallback(
    (): RuntimeContextExtras => ({
      params: paramsRef.current,
      computed: computedRef.current,
      refs: refsRef.current,
    }),
    [],
  );

  const runActionChain = useCallback(
    (actions: ActionChain, extra?: Record<string, any>, eventData?: any) => {
      const contextExtra = eventData === undefined
        ? extra
        : { ...(extra ?? {}), event: eventData };

      return executeActions(actions, getContext(contextExtra), dispatch, {
        methods: pageRef.current.methods ?? {},
        dataSources: pageRef.current.dataSources ?? {},
        refs: refsRef.current,
        ...adaptersRef.current,
      });
    },
    [dispatch, getContext],
  );

  const executeWithExtra = useCallback(
    (actions: ActionChain, extra?: Record<string, any>) => runActionChain(actions, extra),
    [runActionChain],
  );

  const dsState = useDataSources(
    page.dataSources,
    state,
    executeWithExtra,
    getDataSourceRuntimeContext,
  );
  dsStateRef.current = dsState as Record<string, DataSourceRuntimeState>;

  useWatchers(page.watchers, state, executeWithExtra);
  useSyncToUrl(page.syncToUrl, state, dispatch);

  useEffect(() => {
    const mountedPage = mountedPageRef.current;
    const executeLifecycle = (actions: ActionChain) =>
      executeActions(actions, getContext(), dispatch, {
        methods: mountedPage.methods ?? {},
        dataSources: mountedPage.dataSources ?? {},
        refs: refsRef.current,
        ...adaptersRef.current,
      });

    // 业务约束：生命周期 onLoad/onMount 只在首次挂载触发一次。
    if (mountedPage.lifecycle?.onLoad) {
      void executeLifecycle(mountedPage.lifecycle.onLoad);
    }
    if (mountedPage.lifecycle?.onMount) {
      void executeLifecycle(mountedPage.lifecycle.onMount);
    }
    return () => {
      if (mountedPage.lifecycle?.onUnmount) {
        void executeLifecycle(mountedPage.lifecycle.onUnmount);
      }
    };
  }, []);

  const dialogPayloads = useMemo(() => readDialogPayloads(state), [state]);

  return useMemo(
    () => ({
      state,
      dispatch,
      executeActions: (actions: ActionChain, eventData?: any, extraContext?: Record<string, any>) =>
        runActionChain(actions, extraContext, eventData),
      getContext,
      computed,
      dialogPayloads,
      registerRef(id: string, ref: any) {
        if (ref == null) {
          delete refsRef.current[id];
          return;
        }
        refsRef.current[id] = ref;
      },
    }),
    [computed, dialogPayloads, dispatch, getContext, runActionChain, state],
  );
}
