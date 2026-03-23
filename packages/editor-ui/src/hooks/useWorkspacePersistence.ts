import { useEffect, useRef, useState } from 'react';
import type {
  TabManagerSnapshot,
  VirtualFileSystemAdapter,
} from '@shenbi/editor-core';
import type { PageSchema } from '@shenbi/schema';

export interface WorkspacePersistenceService {
  getJSON: <T>(namespace: string, key: string) => Promise<T | null | undefined>;
  setJSON: <T>(namespace: string, key: string, value: T) => Promise<void>;
}

export interface PersistedWorkspaceShellSession {
  tabs: TabManagerSnapshot;
  expandedIds: string[];
  focusedId?: string | undefined;
}

export interface WorkspacePersistenceKeys {
  namespace: string;
  activeScenarioKey: string;
  renderModeKey: string;
  shellSessionKey: string;
}

export interface UseWorkspacePersistenceOptions<TScenario extends string, TRenderMode extends string> {
  appMode: 'shell' | 'scenarios';
  activeProjectId: string;
  activeScenario: TScenario;
  setActiveScenario: (scenario: TScenario) => void;
  renderMode: TRenderMode;
  setRenderMode: (mode: TRenderMode) => void;
  fileEditor: {
    commands: {
      execute: (commandId: string, payload?: unknown) => Promise<unknown>;
    };
  };
  fileExplorerExpandedIds: string[];
  fileExplorerFocusedId?: string | undefined;
  setFileExplorerExpandedIds: (value: string[]) => void;
  setFileExplorerFocusedId: (value: string | undefined) => void;
  scenarioValues: readonly TScenario[];
  renderModeValues: readonly TRenderMode[];
  tabManager: {
    restoreSnapshot: (snapshot: TabManagerSnapshot) => void;
  };
  tabSnapshot: TabManagerSnapshot;
  vfs: Pick<VirtualFileSystemAdapter, 'listTree' | 'readFile'>;
  vfsInitialized: boolean;
  vfsInitializationFailed: boolean;
  workspacePersistence: WorkspacePersistenceService;
  persistenceKeys: WorkspacePersistenceKeys;
  createEmptySchema: () => PageSchema;
}

export function useWorkspacePersistence<TScenario extends string, TRenderMode extends string>({
  appMode,
  activeProjectId,
  activeScenario,
  setActiveScenario,
  renderMode,
  setRenderMode,
  fileEditor,
  fileExplorerExpandedIds,
  fileExplorerFocusedId,
  setFileExplorerExpandedIds,
  setFileExplorerFocusedId,
  scenarioValues,
  renderModeValues,
  tabManager,
  tabSnapshot,
  vfs,
  vfsInitialized,
  vfsInitializationFailed,
  workspacePersistence,
  persistenceKeys,
  createEmptySchema,
}: UseWorkspacePersistenceOptions<TScenario, TRenderMode>) {
  const [scenarioPersistenceHydrated, setScenarioPersistenceHydrated] = useState(false);
  const [renderModeHydrated, setRenderModeHydrated] = useState(false);
  const [shellSessionHydrated, setShellSessionHydrated] = useState(false);
  const setFileExplorerExpandedIdsRef = useRef(setFileExplorerExpandedIds);
  const setFileExplorerFocusedIdRef = useRef(setFileExplorerFocusedId);
  setFileExplorerExpandedIdsRef.current = setFileExplorerExpandedIds;
  setFileExplorerFocusedIdRef.current = setFileExplorerFocusedId;

  useEffect(() => {
    let cancelled = false;

    void workspacePersistence
      .getJSON<TScenario>(persistenceKeys.namespace, persistenceKeys.activeScenarioKey)
      .then((storedScenario) => {
        if (cancelled || !storedScenario || !scenarioValues.includes(storedScenario)) {
          return;
        }
        setActiveScenario(storedScenario);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setScenarioPersistenceHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [persistenceKeys.activeScenarioKey, persistenceKeys.namespace, scenarioValues, setActiveScenario, workspacePersistence]);

  useEffect(() => {
    if (!scenarioPersistenceHydrated) {
      return;
    }

    void workspacePersistence
      .setJSON(
        persistenceKeys.namespace,
        persistenceKeys.activeScenarioKey,
        activeScenario,
      )
      .catch(() => undefined);
  }, [
    activeScenario,
    persistenceKeys.activeScenarioKey,
    persistenceKeys.namespace,
    scenarioPersistenceHydrated,
    workspacePersistence,
  ]);

  useEffect(() => {
    let cancelled = false;
    void workspacePersistence
      .getJSON<TRenderMode>(persistenceKeys.namespace, persistenceKeys.renderModeKey)
      .then((storedMode) => {
        if (cancelled || !storedMode || !renderModeValues.includes(storedMode)) {
          return;
        }
        setRenderMode(storedMode);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setRenderModeHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [persistenceKeys.namespace, persistenceKeys.renderModeKey, renderModeValues, setRenderMode, workspacePersistence]);

  useEffect(() => {
    if (!renderModeHydrated) {
      return;
    }
    void workspacePersistence
      .setJSON(persistenceKeys.namespace, persistenceKeys.renderModeKey, renderMode)
      .catch(() => undefined);
  }, [
    persistenceKeys.namespace,
    persistenceKeys.renderModeKey,
    renderMode,
    renderModeHydrated,
    workspacePersistence,
  ]);

  const shellSessionHydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let didFinishHydration = false;

    if (appMode !== 'shell' || shellSessionHydrated || shellSessionHydratedRef.current) {
      return () => {
        cancelled = true;
      };
    }

    if (!vfsInitialized && !vfsInitializationFailed) {
      return () => {
        cancelled = true;
      };
    }

    // Mark as hydrating immediately (synchronous) to prevent re-entry while the
    // async restore is in flight. The cleanup resets this guard when React
    // StrictMode tears down the first effect pass before the real mount pass.
    shellSessionHydratedRef.current = true;

    if (typeof indexedDB === 'undefined' || vfsInitializationFailed) {
      didFinishHydration = true;
      setShellSessionHydrated(true);
      return () => {
        cancelled = true;
      };
    }

    void workspacePersistence
      .getJSON<PersistedWorkspaceShellSession>(persistenceKeys.namespace, persistenceKeys.shellSessionKey)
      .then(async (storedSession) => {
        if (cancelled || !storedSession) {
          return;
        }

        const nodes = await vfs.listTree(activeProjectId);
        if (cancelled) {
          return;
        }

        const nodeMap = new Map(nodes.map((node) => [node.id, node]));
        const restoredTabs: TabManagerSnapshot['tabs'] = [];

        for (const persistedTab of storedSession.tabs.tabs) {
          const liveNode = nodeMap.get(persistedTab.fileId);
          if (!liveNode || liveNode.type !== 'file') {
            continue;
          }

          let schema = persistedTab.schema;
          if (!persistedTab.isDirty) {
            try {
              schema = await vfs.readFile(activeProjectId, persistedTab.fileId) as typeof persistedTab.schema;
            } catch {
              continue;
            }
          }

          restoredTabs.push({
            ...persistedTab,
            schema,
            fileName: liveNode.name,
            filePath: liveNode.path,
            fileType: (liveNode.fileType ?? persistedTab.fileType) as typeof persistedTab.fileType,
            isGenerating: false,
            readOnlyReason: undefined,
            generationUpdatedAt: undefined,
          });
        }

        const activeTabId = storedSession.tabs.activeTabId
          && restoredTabs.some((tab) => tab.fileId === storedSession.tabs.activeTabId)
          ? storedSession.tabs.activeTabId
          : restoredTabs[0]?.fileId;

        tabManager.restoreSnapshot({
          tabs: restoredTabs,
          activeTabId,
        });

        const directoryIds = new Set(
          nodes.filter((node) => node.type === 'directory').map((node) => node.id),
        );
        setFileExplorerExpandedIdsRef.current(
          (storedSession.expandedIds ?? []).filter((id) => directoryIds.has(id)),
        );
        setFileExplorerFocusedIdRef.current(
          storedSession.focusedId && nodeMap.has(storedSession.focusedId)
            ? storedSession.focusedId
            : undefined,
        );

        const activeTab = activeTabId
          ? restoredTabs.find((tab) => tab.fileId === activeTabId)
          : undefined;

        await fileEditor.commands.execute('editor.restoreSnapshot', {
          snapshot: activeTab
            ? activeTab.fileType === 'api'
              ? {
                schema: createEmptySchema(),
                currentFileId: activeTab.fileId,
                isDirty: activeTab.isDirty,
              }
              : {
                schema: activeTab.schema,
                currentFileId: activeTab.fileId,
                isDirty: activeTab.isDirty,
                ...(activeTab.selectedNodeId ? { selectedNodeId: activeTab.selectedNodeId } : {}),
              }
            : {
              schema: createEmptySchema(),
              isDirty: false,
            },
        });
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          didFinishHydration = true;
          setShellSessionHydrated(true);
        }
      });

    return () => {
      cancelled = true;
      if (!didFinishHydration) {
        shellSessionHydratedRef.current = false;
      }
    };
  }, [
    activeProjectId,
    appMode,
    createEmptySchema,
    fileEditor.commands,
    persistenceKeys.namespace,
    persistenceKeys.shellSessionKey,
    shellSessionHydrated,
    tabManager,
    vfs,
    vfsInitializationFailed,
    vfsInitialized,
    workspacePersistence,
  ]);

  useEffect(() => {
    if (appMode !== 'shell' || !shellSessionHydrated || !vfsInitialized) {
      return;
    }

    void workspacePersistence
      .setJSON<PersistedWorkspaceShellSession>(
        persistenceKeys.namespace,
        persistenceKeys.shellSessionKey,
        {
          tabs: {
            ...tabSnapshot,
            tabs: tabSnapshot.tabs.map((tab) => ({
              ...tab,
              isGenerating: false,
              readOnlyReason: undefined,
              generationUpdatedAt: undefined,
            })),
          },
          expandedIds: fileExplorerExpandedIds,
          ...(fileExplorerFocusedId ? { focusedId: fileExplorerFocusedId } : {}),
        },
      )
      .catch(() => undefined);
  }, [
    appMode,
    fileExplorerExpandedIds,
    fileExplorerFocusedId,
    persistenceKeys.namespace,
    persistenceKeys.shellSessionKey,
    shellSessionHydrated,
    tabSnapshot,
    vfsInitialized,
    workspacePersistence,
  ]);
}
