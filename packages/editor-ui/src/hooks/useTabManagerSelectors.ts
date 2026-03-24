import { useSyncExternalStore, useCallback, useRef } from 'react';
import type { TabManager, TabManagerSnapshot, TabState } from '@shenbi/editor-core';

/**
 * Generic selector hook for TabManager. Only triggers re-render when the
 * selected slice changes (by reference equality).
 */
export function useTabManagerSelector<T>(
  tabManager: TabManager | undefined,
  selector: (snapshot: TabManagerSnapshot) => T,
): T {
  const emptySnapshot: TabManagerSnapshot = { tabs: [], activeTabId: undefined };

  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const cachedRef = useRef<{ snapshot: TabManagerSnapshot; value: T } | undefined>(undefined);

  const getSnapshot = useCallback((): T => {
    const raw = tabManager?.getSnapshot() ?? emptySnapshot;
    const cached = cachedRef.current;
    if (cached && cached.snapshot === raw) {
      return cached.value;
    }
    const value = selectorRef.current(raw);
    cachedRef.current = { snapshot: raw, value };
    return value;
  }, [tabManager]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!tabManager) return () => {};
      return tabManager.subscribe(() => {
        // Invalidate cache so getSnapshot re-evaluates
        cachedRef.current = undefined;
        onStoreChange();
      });
    },
    [tabManager],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ── Convenience selectors ──────────────────────────────────

/** Returns the full TabManagerSnapshot (same as useTabManager). */
export function useTabSnapshot(tabManager: TabManager | undefined): TabManagerSnapshot {
  return useTabManagerSelector(tabManager, (s) => s);
}

/** Returns only the active tab id. */
export function useActiveTabId(tabManager: TabManager | undefined): string | undefined {
  return useTabManagerSelector(tabManager, (s) => s.activeTabId);
}

/** Returns only the active tab state. */
export function useActiveTab(tabManager: TabManager | undefined): TabState | undefined {
  return useTabManagerSelector(
    tabManager,
    (s) => s.tabs.find((t) => t.fileId === s.activeTabId),
  );
}

/** Returns the tab list (re-renders only when tabs array reference changes). */
export function useTabList(tabManager: TabManager | undefined): TabState[] {
  return useTabManagerSelector(tabManager, (s) => s.tabs);
}

/** Returns whether a specific tab is dirty. */
export function useTabDirty(tabManager: TabManager | undefined, fileId: string | undefined): boolean {
  return useTabManagerSelector(
    tabManager,
    (s) => (fileId ? s.tabs.find((t) => t.fileId === fileId)?.isDirty ?? false : false),
  );
}
