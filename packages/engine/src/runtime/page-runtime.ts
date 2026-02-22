import type { ActionChain, ExpressionContext, PageSchema } from '@shenbi/schema';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { PageRuntime } from '../types/contracts';
import { executeActions, type ExecutorOptions } from './action-executor';
import { useComputed } from './computed';
import { useDataSources } from './datasource';
import { isObject } from './shared';
import { usePageState } from './state';
import { useWatchers } from './watcher';

interface DataSourceRuntimeState {
  data: any;
  loading: boolean;
  error: any;
}

type RuntimeAdapters = Omit<Partial<ExecutorOptions>, 'methods' | 'dataSources' | 'refs'>;

export interface UsePageRuntimeOptions extends RuntimeAdapters {
  params?: Record<string, any>;
}

function toExpressionDataSources(dsState: Record<string, DataSourceRuntimeState>): Record<string, any> {
  const output: Record<string, any> = {};
  for (const [name, item] of Object.entries(dsState)) {
    output[name] = item?.data;
  }
  return output;
}

function readDialogPayloads(state: Record<string, any>): Record<string, any> {
  const payloads = state.__dialogPayloads;
  return isObject(payloads) ? payloads : {};
}

export function usePageRuntime(
  page: PageSchema,
  options: UsePageRuntimeOptions = {},
): PageRuntime {
  const { state, dispatch } = usePageState(page);
  const computed = useComputed(page.computed, state);

  const pageRef = useRef(page);
  const paramsRef = useRef<Record<string, any>>(options.params ?? {});
  const adaptersRef = useRef<RuntimeAdapters>(options);
  const stateRef = useRef<Record<string, any>>(state);
  const computedRef = useRef<Record<string, any>>(computed);
  const refsRef = useRef<Record<string, any>>({});
  const dsStateRef = useRef<Record<string, DataSourceRuntimeState>>({});

  pageRef.current = page;
  paramsRef.current = options.params ?? {};
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

  const runActionChain = useCallback(
    async (actions: ActionChain, extra?: Record<string, any>, eventData?: any) => {
      const contextExtra = eventData === undefined
        ? extra
        : { ...(extra ?? {}), event: eventData };

      await executeActions(actions, getContext(contextExtra), dispatch, {
        methods: pageRef.current.methods ?? {},
        dataSources: pageRef.current.dataSources ?? {},
        refs: refsRef.current,
        ...adaptersRef.current,
      });
    },
    [dispatch, getContext],
  );

  const executeWithExtra = useCallback(
    async (actions: ActionChain, extra?: Record<string, any>) => {
      await runActionChain(actions, extra);
    },
    [runActionChain],
  );

  const dsState = useDataSources(page.dataSources, state, executeWithExtra);
  dsStateRef.current = dsState as Record<string, DataSourceRuntimeState>;

  useWatchers(page.watchers, state, executeWithExtra);

  useEffect(() => {
    if (page.lifecycle?.onLoad) {
      void executeWithExtra(page.lifecycle.onLoad);
    }
    if (page.lifecycle?.onMount) {
      void executeWithExtra(page.lifecycle.onMount);
    }
    return () => {
      if (page.lifecycle?.onUnmount) {
        void executeWithExtra(page.lifecycle.onUnmount);
      }
    };
  }, [executeWithExtra, page]);

  const dialogPayloads = useMemo(() => readDialogPayloads(state), [state]);

  return useMemo(
    () => ({
      state,
      dispatch,
      executeActions: (actions: ActionChain, eventData?: any) =>
        runActionChain(actions, undefined, eventData),
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
