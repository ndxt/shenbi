import type { PageSchema } from '@shenbi/schema';
import type { ActionChain } from '@shenbi/schema';
import { useEffect, useRef } from 'react';
import { clearTimerRecord, getStatePathValue, safeJsonSnapshot } from './shared';

function readWatchValue(state: Record<string, any>, watch: string | string[]): any {
  if (Array.isArray(watch)) {
    return watch.map((path) => getStatePathValue(state, path));
  }
  return getStatePathValue(state, watch);
}

function hasChanged(nextValue: any, prevValue: any): boolean {
  if (Array.isArray(nextValue) && Array.isArray(prevValue)) {
    if (nextValue.length !== prevValue.length) {
      return true;
    }
    for (let i = 0; i < nextValue.length; i += 1) {
      if (!Object.is(nextValue[i], prevValue[i])) {
        return true;
      }
    }
    return false;
  }
  return !Object.is(nextValue, prevValue);
}

export function useWatchers(
  watchers: PageSchema['watchers'],
  state: Record<string, any>,
  executeActions: (actions: ActionChain, extra?: Record<string, any>) => Promise<void>,
): void {
  const initializedRef = useRef<boolean>(false);
  const prevValuesRef = useRef<Record<number, any>>({});
  const hasPrevValueRef = useRef<Record<number, boolean>>({});
  const prevDeepSnapshotRef = useRef<Record<number, string>>({});
  const debounceTimerRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const throttleLastRunRef = useRef<Record<number, number>>({});

  useEffect(() => {
    const watcherList = watchers ?? [];
    const activeIndexes = new Set<number>();

    watcherList.forEach((watcher, index) => {
      activeIndexes.add(index);
      const newValue = readWatchValue(state, watcher.watch);
      const oldValue = prevValuesRef.current[index];
      const hasPrevValue = hasPrevValueRef.current[index] === true;
      const deepSnapshot = watcher.deep ? safeJsonSnapshot(newValue) : '';
      const oldDeepSnapshot = prevDeepSnapshotRef.current[index];

      let shouldRun = false;
      if (!initializedRef.current && watcher.immediate) {
        shouldRun = true;
      } else if (watcher.deep) {
        shouldRun = initializedRef.current && deepSnapshot !== oldDeepSnapshot;
      } else if (hasPrevValue) {
        shouldRun = hasChanged(newValue, oldValue);
      }

      const run = async () => {
        await executeActions(watcher.handler, {
          watch: {
            newValue,
            oldValue,
          },
        });
      };

      if (shouldRun) {
        if (watcher.debounce && watcher.debounce > 0) {
          const existing = debounceTimerRef.current[index];
          if (existing) {
            clearTimeout(existing);
          }
          debounceTimerRef.current[index] = setTimeout(() => {
            void run();
          }, watcher.debounce);
        } else if (watcher.throttle && watcher.throttle > 0) {
          const now = Date.now();
          const last = throttleLastRunRef.current[index] ?? 0;
          if (now - last >= watcher.throttle) {
            throttleLastRunRef.current[index] = now;
            void run();
          }
        } else {
          void run();
        }
      }

      prevValuesRef.current[index] = newValue;
      hasPrevValueRef.current[index] = true;
      if (watcher.deep) {
        prevDeepSnapshotRef.current[index] = deepSnapshot;
      }
    });

    for (const key of Object.keys(prevValuesRef.current)) {
      const index = Number(key);
      if (!activeIndexes.has(index)) {
        delete prevValuesRef.current[index];
        delete hasPrevValueRef.current[index];
        delete prevDeepSnapshotRef.current[index];
        const timer = debounceTimerRef.current[index];
        if (timer) {
          clearTimeout(timer);
          delete debounceTimerRef.current[index];
        }
        delete throttleLastRunRef.current[index];
      }
    }

    initializedRef.current = true;
  }, [watchers, state, executeActions]);

  useEffect(() => {
    return () => {
      clearTimerRecord(debounceTimerRef.current);
    };
  }, []);
}
