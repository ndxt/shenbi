import type { ActionChain, PageSchema } from '@shenbi/schema';
import type { DataSourceDef, ExpressionContext } from '@shenbi/schema';
import { useCallback, useEffect, useRef, useState } from 'react';
import { compileJSFunction } from '../compiler/expression';
import { resolveValue } from './action-executor';
import {
  appendQuery,
  clearTimerRecord,
  getStatePathValue,
  safeJsonSnapshot,
  toExpressionDataSources,
} from './shared';

interface DataSourceRuntimeState {
  data: any;
  loading: boolean;
  error: any;
}

type DataSourceRuntimeContext = Pick<ExpressionContext, 'params' | 'computed' | 'refs'>;
const EMPTY_DS_ENTRY: DataSourceRuntimeState = {
  data: null,
  loading: false,
  error: null,
};

function createExpressionContext(
  state: Record<string, any>,
  dsState: Record<string, DataSourceRuntimeState>,
  runtimeContext?: Partial<DataSourceRuntimeContext>,
): ExpressionContext {
  return {
    state,
    params: runtimeContext?.params ?? {},
    computed: runtimeContext?.computed ?? {},
    ds: toExpressionDataSources(dsState),
    utils: {},
    refs: runtimeContext?.refs ?? {},
  };
}

function createInitialDsState(dataSources: PageSchema['dataSources']): Record<string, DataSourceRuntimeState> {
  const output: Record<string, DataSourceRuntimeState> = {};
  for (const name of Object.keys(dataSources ?? {})) {
    output[name] = { ...EMPTY_DS_ENTRY };
  }
  return output;
}

function patchEntry(
  prev: Record<string, DataSourceRuntimeState>,
  name: string,
  patch: Partial<DataSourceRuntimeState>,
): Record<string, DataSourceRuntimeState> {
  return {
    ...prev,
    [name]: {
      ...(prev[name] ?? EMPTY_DS_ENTRY),
      ...patch,
    },
  };
}

export function useDataSources(
  dataSources: PageSchema['dataSources'],
  state: Record<string, any>,
  executeActions: (actions: ActionChain, extra?: Record<string, any>) => Promise<void>,
  getRuntimeContext?: () => Partial<DataSourceRuntimeContext>,
): Record<string, any> {
  const [dsState, setDsState] = useState<Record<string, DataSourceRuntimeState>>(() =>
    createInitialDsState(dataSources),
  );
  const dsStateRef = useRef<Record<string, DataSourceRuntimeState>>(dsState);
  const initializedRef = useRef<Record<string, boolean>>({});
  const prevDepKeyRef = useRef<Record<string, string>>({});
  const debounceTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const requestSeqRef = useRef<Record<string, number>>({});
  const abortControllerRef = useRef<Record<string, AbortController | null>>({});
  const mountedRef = useRef<boolean>(true);

  dsStateRef.current = dsState;

  useEffect(() => {
    setDsState((prev) => {
      const next: Record<string, DataSourceRuntimeState> = {};
      for (const name of Object.keys(dataSources ?? {})) {
        next[name] = prev[name] ?? { ...EMPTY_DS_ENTRY };
      }
      return next;
    });
  }, [dataSources]);

  const runDataSource = useCallback(
    async (name: string, def: DataSourceDef) => {
      if (!mountedRef.current) {
        return;
      }

      const currentSeq = (requestSeqRef.current[name] ?? 0) + 1;
      requestSeqRef.current[name] = currentSeq;

      abortControllerRef.current[name]?.abort();
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      abortControllerRef.current[name] = controller;

      setDsState((prev) => patchEntry(prev, name, { loading: true, error: null }));

      const ctx = createExpressionContext(state, dsStateRef.current, getRuntimeContext?.());
      const method = def.api.method ?? 'GET';
      const url = String(resolveValue(def.api.url, ctx) ?? '');
      const headers = resolveValue(def.api.headers ?? {}, ctx) as HeadersInit;
      const params = resolveValue(def.api.params ?? {}, ctx) as Record<string, any>;
      const data = resolveValue(def.api.data, ctx);
      const requestUrl = method === 'GET' ? appendQuery(url, params) : url;
      const requestInit: RequestInit = { method, headers };
      if (method !== 'GET' && data != null) {
        requestInit.body = JSON.stringify(data);
      }
      if (controller) {
        requestInit.signal = controller.signal;
      }

      let responseData: any = null;
      let error: any = null;
      const isLatestActive = () => mountedRef.current && requestSeqRef.current[name] === currentSeq;

      try {
        const response = await fetch(requestUrl, requestInit);
        const contentType = response.headers.get('content-type') ?? '';
        responseData = contentType.includes('application/json')
          ? await response.json()
          : await response.text();

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        if (def.transform?.body) {
          const transform = compileJSFunction(def.transform.params ?? ['data'], def.transform.body);
          const transformed = transform(ctx, responseData);
          if (transformed !== undefined) {
            responseData = transformed;
          }
        }

        if (isLatestActive()) {
          setDsState((prev) =>
            patchEntry(prev, name, { data: responseData, loading: false, error: null }),
          );
        }

        if (isLatestActive() && def.onSuccess) {
          await executeActions(def.onSuccess, { dataSource: name, response: responseData });
        }
      } catch (fetchError) {
        if ((fetchError as any)?.name === 'AbortError') {
          return;
        }

        error = fetchError;
        if (isLatestActive()) {
          setDsState((prev) => patchEntry(prev, name, { loading: false, error: fetchError }));
        }

        if (isLatestActive() && def.onError) {
          await executeActions(def.onError, { dataSource: name, error: fetchError });
        }
      } finally {
        if (abortControllerRef.current[name] === controller) {
          abortControllerRef.current[name] = null;
        }

        if (isLatestActive()) {
          setDsState((prev) => patchEntry(prev, name, { loading: false }));
        }

        if (isLatestActive() && def.onFinally) {
          await executeActions(def.onFinally, {
            dataSource: name,
            response: responseData,
            error,
          });
        }
      }
    },
    [executeActions, getRuntimeContext, state],
  );

  useEffect(() => {
    const activeNames = new Set<string>();

    for (const [name, def] of Object.entries(dataSources ?? {})) {
      activeNames.add(name);
      const depValues = (def.deps ?? []).map((depPath) => getStatePathValue(state, depPath));
      const depKey = safeJsonSnapshot(depValues);
      const initialized = initializedRef.current[name] === true;
      const shouldAutoRun = Boolean(def.auto) && !initialized;
      const shouldDepsRun = initialized && (def.deps?.length ?? 0) > 0 && depKey !== prevDepKeyRef.current[name];

      const trigger = () => {
        void runDataSource(name, def);
      };

      if (shouldAutoRun || shouldDepsRun) {
        if (def.debounce && def.debounce > 0) {
          const timer = debounceTimerRef.current[name];
          if (timer) {
            clearTimeout(timer);
          }
          debounceTimerRef.current[name] = setTimeout(trigger, def.debounce);
        } else {
          trigger();
        }
      }

      prevDepKeyRef.current[name] = depKey;
      initializedRef.current[name] = true;
    }

    for (const name of Object.keys(initializedRef.current)) {
      if (activeNames.has(name)) {
        continue;
      }

      const timer = debounceTimerRef.current[name];
      if (timer) {
        clearTimeout(timer);
        delete debounceTimerRef.current[name];
      }

      abortControllerRef.current[name]?.abort();
      delete abortControllerRef.current[name];
      delete initializedRef.current[name];
      delete prevDepKeyRef.current[name];
      delete requestSeqRef.current[name];
    }
  }, [dataSources, runDataSource, state]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      clearTimerRecord(debounceTimerRef.current);
      for (const controller of Object.values(abortControllerRef.current)) {
        controller?.abort();
      }
      abortControllerRef.current = {};
    };
  }, []);

  return dsState;
}
