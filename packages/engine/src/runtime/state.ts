import type { PageSchema } from '@shenbi/schema';
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import type { StateAction } from '../types/contracts';
import { isObject } from './shared';

export interface PageStateController {
  state: Record<string, any>;
  dispatch: (action: StateAction) => void;
}

function setByPathImmutable(source: Record<string, any>, path: string, value: any): Record<string, any> {
  const keys = path.split('.').filter(Boolean);
  if (keys.length === 0) {
    return source;
  }

  if (keys.length === 1) {
    const key = keys[0]!;
    return { ...source, [key]: value };
  }

  const [head, ...rest] = keys;
  const current = source[head!] as unknown;
  const base = isObject(current) ? current : {};

  return {
    ...source,
    [head!]: setByPathImmutable(base, rest.join('.'), value),
  };
}

export function createInitialState(page: PageSchema): Record<string, any> {
  const stateDef = page.state ?? {};
  const initial: Record<string, any> = {};

  for (const [key, field] of Object.entries(stateDef)) {
    initial[key] = field?.default ?? null;
  }

  return initial;
}

export function pageStateReducer(state: Record<string, any>, action: StateAction): Record<string, any> {
  switch (action.type) {
    case 'SET':
      return setByPathImmutable(state, action.key, action.value);
    case 'MERGE':
      return {
        ...state,
        ...action.data,
      };
    case 'RESET':
      return {
        ...action.initial,
      };
    default:
      return state;
  }
}

function serializeStateSignature(state: Record<string, any>): string {
  try {
    return JSON.stringify(state);
  } catch (_error) {
    return String(Object.keys(state).length);
  }
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function usePageState(page: PageSchema): PageStateController {
  const initialState = useMemo(() => createInitialState(page), [page]);
  const initialSignature = useMemo(() => serializeStateSignature(initialState), [initialState]);
  const [state, dispatch] = useReducer(pageStateReducer, initialState);
  const lastResetSignatureRef = useRef<string>(initialSignature);

  // Use layout effect to avoid visible stale state between page switches.
  useIsomorphicLayoutEffect(() => {
    if (lastResetSignatureRef.current === initialSignature) {
      return;
    }
    lastResetSignatureRef.current = initialSignature;
    dispatch({ type: 'RESET', initial: initialState });
  }, [initialSignature, initialState]);

  return {
    state,
    dispatch,
  };
}
