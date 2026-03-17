import type { PageSchema } from '@shenbi/schema';
import type { FileType } from './adapters/file-storage';

export interface TabState {
  fileId: string;
  filePath: string;
  fileType: FileType;
  fileName: string;
  schema: PageSchema;
  selectedNodeId?: string | undefined;
  isDirty: boolean;
  isGenerating?: boolean | undefined;
  readOnlyReason?: string | undefined;
  generationUpdatedAt?: number | undefined;
  historySnapshot?: unknown | undefined; // reserved for per-tab undo/redo
}

export interface TabManagerSnapshot {
  tabs: TabState[];
  activeTabId: string | undefined;
}

type TabManagerListener = (snapshot: TabManagerSnapshot) => void;

export class TabManager {
  private tabs = new Map<string, TabState>();
  private tabOrder: string[] = [];
  private activeTabId: string | undefined;
  private listeners = new Set<TabManagerListener>();

  openTab(fileId: string, state: Omit<TabState, 'fileId'>): void {
    if (this.tabs.has(fileId)) {
      this.activateTab(fileId);
      return;
    }
    this.tabs.set(fileId, { ...state, fileId });
    this.tabOrder.push(fileId);
    this.activeTabId = fileId;
    this.notify();
  }

  closeTab(fileId: string): void {
    if (!this.tabs.has(fileId)) return;

    this.tabs.delete(fileId);
    const index = this.tabOrder.indexOf(fileId);
    if (index >= 0) {
      this.tabOrder.splice(index, 1);
    }

    if (this.activeTabId === fileId) {
      // Activate adjacent tab
      if (this.tabOrder.length === 0) {
        this.activeTabId = undefined;
      } else {
        const nextIndex = Math.min(index, this.tabOrder.length - 1);
        this.activeTabId = this.tabOrder[nextIndex];
      }
    }
    this.notify();
  }

  activateTab(fileId: string): void {
    if (!this.tabs.has(fileId)) return;
    if (this.activeTabId === fileId) return;
    this.activeTabId = fileId;
    this.notify();
  }

  updateTab(fileId: string, patch: Partial<Omit<TabState, 'fileId'>>): void {
    const tab = this.tabs.get(fileId);
    if (!tab) return;
    Object.assign(tab, patch);
    this.notify();
  }

  markDirty(fileId: string, dirty: boolean): void {
    const tab = this.tabs.get(fileId);
    if (!tab || tab.isDirty === dirty) return;
    tab.isDirty = dirty;
    this.notify();
  }

  getTab(fileId: string): TabState | undefined {
    const tab = this.tabs.get(fileId);
    return tab ? { ...tab } : undefined;
  }

  getActiveTab(): TabState | undefined {
    if (!this.activeTabId) return undefined;
    return this.getTab(this.activeTabId);
  }

  getActiveTabId(): string | undefined {
    return this.activeTabId;
  }

  getTabs(): TabState[] {
    return this.tabOrder
      .map((id) => this.tabs.get(id))
      .filter((tab): tab is TabState => Boolean(tab))
      .map((tab) => ({ ...tab }));
  }

  getSnapshot(): TabManagerSnapshot {
    return {
      tabs: this.getTabs(),
      activeTabId: this.activeTabId,
    };
  }

  restoreSnapshot(snapshot: TabManagerSnapshot): void {
    this.tabs.clear();
    this.tabOrder = [];

    for (const tab of snapshot.tabs) {
      this.tabs.set(tab.fileId, { ...tab });
      this.tabOrder.push(tab.fileId);
    }

    if (snapshot.activeTabId && this.tabs.has(snapshot.activeTabId)) {
      this.activeTabId = snapshot.activeTabId;
    } else {
      this.activeTabId = this.tabOrder[0];
    }

    this.notify();
  }

  closeOtherTabs(fileId: string): void {
    const idsToClose = this.tabOrder.filter((id) => id !== fileId);
    for (const id of idsToClose) {
      this.tabs.delete(id);
    }
    this.tabOrder = this.tabs.has(fileId) ? [fileId] : [];
    this.activeTabId = this.tabOrder[0];
    this.notify();
  }

  closeAllTabs(): void {
    this.tabs.clear();
    this.tabOrder = [];
    this.activeTabId = undefined;
    this.notify();
  }

  closeSavedTabs(): void {
    const dirtyIds = new Set(
      [...this.tabs.values()].filter((t) => t.isDirty).map((t) => t.fileId),
    );
    for (const id of this.tabOrder) {
      if (!dirtyIds.has(id)) this.tabs.delete(id);
    }
    this.tabOrder = this.tabOrder.filter((id) => dirtyIds.has(id));
    if (this.activeTabId && !this.tabs.has(this.activeTabId)) {
      this.activeTabId = this.tabOrder[0];
    }
    this.notify();
  }

  moveTab(fromIndex: number, toIndex: number): void {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 || fromIndex >= this.tabOrder.length ||
      toIndex < 0 || toIndex >= this.tabOrder.length
    ) return;
    const id = this.tabOrder.splice(fromIndex, 1)[0];
    if (!id) return;
    this.tabOrder.splice(toIndex, 0, id);
    this.notify();
  }

  subscribe(listener: TabManagerListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
