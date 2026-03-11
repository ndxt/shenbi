import { useCallback, useEffect, useState } from 'react';
import { TabManager, type TabManagerSnapshot } from '@shenbi/editor-core';

export function useTabManager(tabManager: TabManager | undefined): TabManagerSnapshot {
  const [snapshot, setSnapshot] = useState<TabManagerSnapshot>(
    () => tabManager?.getSnapshot() ?? { tabs: [], activeTabId: undefined },
  );

  useEffect(() => {
    if (!tabManager) return;
    setSnapshot(tabManager.getSnapshot());
    return tabManager.subscribe(setSnapshot);
  }, [tabManager]);

  return snapshot;
}
