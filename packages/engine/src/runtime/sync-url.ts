import { useEffect, useRef } from 'react';
import type { SyncToUrlDef } from '@shenbi/schema';
import type { StateAction } from '../types/contracts';
import { setByPathMutable } from '../utils';
import { getStatePathValue } from './shared';

function readQueryKey(def: SyncToUrlDef): string {
  return def.queryKey ?? def.stateKey;
}

function decodeValue(raw: string, transform: SyncToUrlDef['transform']): unknown {
  switch (transform) {
    case 'number': {
      const value = Number(raw);
      return Number.isNaN(value) ? undefined : value;
    }
    case 'boolean':
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      return undefined;
    case 'json':
      try {
        return JSON.parse(raw);
      } catch (_error) {
        return undefined;
      }
    default:
      return raw;
  }
}

function encodeValue(value: unknown, transform: SyncToUrlDef['transform']): string | undefined {
  if (value == null || value === '') {
    return undefined;
  }

  switch (transform) {
    case 'json':
      return JSON.stringify(value);
    default:
      return String(value);
  }
}

export function readUrlSyncedState(
  defs: SyncToUrlDef[] | undefined,
  search: string,
): Record<string, any> {
  if (!defs || defs.length === 0) {
    return {};
  }

  const params = new URLSearchParams(search);
  const restored: Record<string, any> = {};

  for (const def of defs) {
    const rawValue = params.get(readQueryKey(def));
    if (rawValue == null) {
      continue;
    }

    const decoded = decodeValue(rawValue, def.transform);
    if (decoded === undefined) {
      continue;
    }
    setByPathMutable(restored, def.stateKey, decoded);
  }

  return restored;
}

export function writeUrlSyncedState(
  defs: SyncToUrlDef[] | undefined,
  state: Record<string, any>,
  locationLike: Pick<Location, 'pathname' | 'search' | 'hash'>,
  historyLike: Pick<History, 'replaceState' | 'state'>,
): void {
  if (!defs || defs.length === 0) {
    return;
  }

  const search = new URLSearchParams(locationLike.search);

  for (const def of defs) {
    const queryKey = readQueryKey(def);
    const stateValue = getStatePathValue(state, def.stateKey);
    const encodedValue = encodeValue(stateValue, def.transform);
    if (encodedValue === undefined) {
      search.delete(queryKey);
    } else {
      search.set(queryKey, encodedValue);
    }
  }

  const nextSearch = search.toString();
  const currentSearch = locationLike.search.startsWith('?')
    ? locationLike.search.slice(1)
    : locationLike.search;
  if (nextSearch === currentSearch) {
    return;
  }

  const nextUrl = `${locationLike.pathname}${nextSearch ? `?${nextSearch}` : ''}${locationLike.hash}`;
  historyLike.replaceState(historyLike.state, '', nextUrl);
}

export function useSyncToUrl(
  defs: SyncToUrlDef[] | undefined,
  state: Record<string, any>,
  dispatch: (action: StateAction) => void,
): void {
  const restoredRef = useRef(false);
  const skipWriteOnceRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !defs || defs.length === 0) {
      restoredRef.current = true;
      return;
    }

    const restoredState = readUrlSyncedState(defs, window.location.search);
    if (Object.keys(restoredState).length > 0) {
      skipWriteOnceRef.current = true;
      dispatch({ type: 'MERGE', data: restoredState });
    }
    restoredRef.current = true;
  }, [defs, dispatch]);

  useEffect(() => {
    if (
      typeof window === 'undefined'
      || !defs
      || defs.length === 0
      || !restoredRef.current
    ) {
      return;
    }

    if (skipWriteOnceRef.current) {
      skipWriteOnceRef.current = false;
      return;
    }

    writeUrlSyncedState(defs, state, window.location, window.history);
  }, [defs, state]);
}
