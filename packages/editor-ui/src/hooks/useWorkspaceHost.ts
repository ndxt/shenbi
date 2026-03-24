import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  type EditorStateSnapshot,
  type FSTreeNode,
  buildFSTree,
  type TabManager,
  type TabManagerSnapshot,
  cloneSchema,
  hasSchemaContent,
  type VirtualFileSystemAdapter,
} from '@shenbi/editor-core';
import type { PluginFileSystemService } from '@shenbi/editor-plugin-api';
import { useFileWorkspace } from '@shenbi/editor-plugin-files';
import type { PageSchema } from '@shenbi/schema';
import { useTabManager } from './useTabManager';

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

type SaveSource = 'manual' | 'auto';

export interface WorkspaceHostMessages {
  promptEnterFileName: string;
  promptConfirmClose: string;
  toolbarUntitled: string;
  importInvalidJSON: string;
  importMissingBody: string;
  importSuccess: string;
  importReadError: string;
  generationLockReasonFallback: string;
  statusNoActiveFile: string;
  statusUnsavedShort: string;
  statusAutoSaved: string;
  statusSavedShort: string;
}

export interface WorkspaceHostDialogs {
  promptFileName?: (defaultName: string) => string | null;
  confirmClose?: (message: string) => boolean;
}

export interface WorkspaceHostNotifications {
  warning: (message: string) => void;
  error: (message: string) => void;
  success: (message: string) => void;
}

export interface WorkspaceHostVfsAdapter extends Pick<
  VirtualFileSystemAdapter,
  | 'initialize'
  | 'listTree'
  | 'createFile'
  | 'readFile'
  | 'writeFile'
  | 'createDirectory'
> {
  hasFiles?: ((projectId: string) => Promise<boolean>) | undefined;
  copyProject?: ((sourceProjectId: string, targetProjectId: string) => Promise<void>) | undefined;
}

export interface WorkspaceHostState {
  vfs: WorkspaceHostVfsAdapter;
  tabManager: TabManager;
  vfsInitialized: boolean;
  vfsInitializationFailed: boolean;
  fsTree: FSTreeNode[];
  fileExplorerExpandedIds: string[];
  fileExplorerFocusedId?: string | undefined;
  setFileExplorerExpandedIds: Dispatch<SetStateAction<string[]>>;
  setFileExplorerFocusedId: Dispatch<SetStateAction<string | undefined>>;
  handleExpandedIdsChange: (nextExpandedIds: string[]) => void;
  handleFocusedIdChange: (nextFocusedId: string | undefined) => void;
  tabSnapshot: TabManagerSnapshot;
  dirtyFileIds: Set<string>;
  activeFileName?: string | undefined;
  filesPrimaryPanelOptions: unknown;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  fileExplorerStatusText: string;
  shellGenerationLock: boolean;
  shellGenerationReason: string;
  notifyGenerationLock: () => boolean;
  filesystemService?: PluginFileSystemService | undefined;
  handleSaveGuarded: () => void;
  handleUndoGuarded: () => void;
  handleRedoGuarded: () => void;
  ensureCurrentShellTab: () => Promise<string | undefined>;
  refreshFsTree: () => void;
  handleActivateTab: (fileId: string) => void;
  handleCloseTab: (fileId: string) => void;
  handleCloseOtherTabs: (fileId: string) => void;
  handleCloseAllTabs: () => void;
  handleCloseSavedTabs: () => void;
  handleMoveTab: (fromIndex: number, toIndex: number) => void;
  handleOpenFileFromTree: (fileId: string) => void;
  handleCreateFile: (parentId: string | null, name: string, fileType: string) => void;
  handleCreateDirectory: (parentId: string | null, name: string) => void;
  handleDeleteNode: (nodeId: string) => void;
  handleRenameNode: (nodeId: string, newName: string) => void;
  handleMoveNode: (nodeId: string, newParentId: string | null, afterNodeId: string | null) => void;
  handleImportJSONFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export interface UseWorkspaceHostOptions {
  appMode: 'shell' | 'scenarios';
  activeProjectId: string;
  activeScenarioSnapshot: EditorStateSnapshot;
  consumePendingMigration: () => { sourceProjectId: string; targetProjectId: string } | null;
  fileEditor: {
    commands: {
      execute: (commandId: string, payload?: unknown) => Promise<unknown>;
    };
    eventBus?: {
      on?: (event: string, handler: (...args: any[]) => void) => (() => void) | undefined;
    } | undefined;
  };
  shellSnapshot: {
    schema: PageSchema;
    currentFileId?: string | undefined;
    isDirty: boolean;
    canUndo: boolean;
    canRedo: boolean;
  };
  tabManager: TabManager;
  vfs: WorkspaceHostVfsAdapter;
  createEmptySchema: () => PageSchema;
  messages: WorkspaceHostMessages;
  dialogs?: WorkspaceHostDialogs;
  notifications: WorkspaceHostNotifications;
  activeDocument?: {
    state: {
      isDirty: boolean;
      canUndo: boolean;
      canRedo: boolean;
    };
    actions: {
      save: () => void | Promise<void>;
      undo: () => void | Promise<void>;
      redo: () => void | Promise<void>;
    };
  } | undefined;
}

export function useWorkspaceHost({
  appMode,
  activeProjectId,
  activeScenarioSnapshot,
  consumePendingMigration,
  fileEditor,
  shellSnapshot,
  tabManager,
  vfs,
  createEmptySchema,
  messages,
  dialogs,
  notifications,
  activeDocument,
}: UseWorkspaceHostOptions): WorkspaceHostState {
  const tabSnapshot = useTabManager(tabManager);
  const [vfsInitialized, setVfsInitialized] = useState(false);
  const [vfsInitializationFailed, setVfsInitializationFailed] = useState(false);
  const [fsTree, setFsTree] = useState<FSTreeNode[]>([]);
  const [fileExplorerExpandedIds, setFileExplorerExpandedIds] = useState<string[]>([]);
  const [fileExplorerFocusedId, setFileExplorerFocusedId] = useState<string | undefined>();
  const [shellSaveSources, setShellSaveSources] = useState<Record<string, SaveSource>>({});

  useEffect(() => {
    setVfsInitialized(false);
    setVfsInitializationFailed(false);
    setFsTree([]);
  }, [activeProjectId]);

  useEffect(() => {
    if (typeof indexedDB === 'undefined') {
      setVfsInitializationFailed(true);
      return;
    }

    void vfs.initialize(activeProjectId)
      .then(async () => {
        const migration = consumePendingMigration();
        if (migration && vfs.hasFiles && vfs.copyProject) {
          try {
            const targetHasFiles = await vfs.hasFiles(migration.targetProjectId);
            if (!targetHasFiles) {
              const sourceHasFiles = await vfs.hasFiles(migration.sourceProjectId);
              if (sourceHasFiles) {
                await vfs.copyProject(migration.sourceProjectId, migration.targetProjectId);
              }
            }
          } catch {
            // Non-critical migration failure.
          }
        }
        setVfsInitialized(true);
      })
      .catch(() => {
        setVfsInitializationFailed(true);
      });
  }, [activeProjectId, consumePendingMigration, vfs]);

  const refreshFsTree = useCallback(() => {
    if (!vfsInitialized) {
      return;
    }
    void vfs.listTree(activeProjectId).then((nodes) => {
      setFsTree(buildFSTree(nodes));
    });
  }, [activeProjectId, vfs, vfsInitialized]);

  useEffect(() => {
    if (vfsInitialized && appMode === 'shell') {
      refreshFsTree();
    }
  }, [appMode, refreshFsTree, vfsInitialized]);

  useEffect(() => {
    if (appMode !== 'shell') {
      return;
    }
    const unsubscribe = fileEditor.eventBus?.on?.('fs:treeChanged', () => {
      refreshFsTree();
    });
    return unsubscribe;
  }, [appMode, fileEditor.eventBus, refreshFsTree]);

  useEffect(() => {
    const unsubscribe = fileEditor.eventBus?.on?.('file:saved', ({
      fileId,
      source,
    }: {
      fileId: string;
      source?: SaveSource;
    }) => {
      const nextSource = source ?? 'manual';
      setShellSaveSources((previous) => (
        previous[fileId] === nextSource
          ? previous
          : { ...previous, [fileId]: nextSource }
      ));
    });
    return unsubscribe;
  }, [fileEditor.eventBus]);

  const promptFileName = useCallback((defaultName: string) => {
    return dialogs?.promptFileName?.(defaultName) ?? null;
  }, [dialogs]);

  const {
    activeFileName,
    filesPrimaryPanelOptions,
    isDirty,
    canUndo,
    canRedo,
    handleSave,
    handleUndo,
    handleRedo,
  } = useFileWorkspace({
    mode: appMode,
    snapshot: {
      currentFileId: appMode === 'shell' ? shellSnapshot.currentFileId : activeScenarioSnapshot.currentFileId,
      activeFileType: appMode === 'shell'
        ? tabSnapshot.tabs.find((tab) => tab.fileId === tabSnapshot.activeTabId)?.fileType
        : undefined,
      schemaName: (appMode === 'shell' ? shellSnapshot.schema : activeScenarioSnapshot.schema).name,
      isDirty: appMode === 'shell' ? shellSnapshot.isDirty : activeScenarioSnapshot.isDirty,
      canUndo: appMode === 'shell' ? shellSnapshot.canUndo : activeScenarioSnapshot.canUndo,
      canRedo: appMode === 'shell' ? shellSnapshot.canRedo : activeScenarioSnapshot.canRedo,
    },
    commands: fileEditor.commands,
    onError: notifications.error,
    promptFileName,
    documentState: appMode === 'shell' ? activeDocument?.state : undefined,
    documentActions: appMode === 'shell' ? activeDocument?.actions : undefined,
  });

  const dirtyFileIds = useMemo(
    () => new Set(tabSnapshot.tabs.filter((tab) => tab.isDirty).map((tab) => tab.fileId)),
    [tabSnapshot.tabs],
  );

  const activeShellSaveSource = useMemo(
    () => (tabSnapshot.activeTabId ? shellSaveSources[tabSnapshot.activeTabId] : undefined),
    [shellSaveSources, tabSnapshot.activeTabId],
  );
  const activeShellTab = useMemo(
    () => tabSnapshot.tabs.find((tab) => tab.fileId === tabSnapshot.activeTabId),
    [tabSnapshot.activeTabId, tabSnapshot.tabs],
  );
  const shellGenerationLock = appMode === 'shell' && Boolean(activeShellTab?.isGenerating);
  const shellGenerationReason =
    activeShellTab?.readOnlyReason ?? messages.generationLockReasonFallback;

  const fileExplorerStatusText = useMemo(() => {
    if (!tabSnapshot.activeTabId) {
      return messages.statusNoActiveFile;
    }
    if (isDirty) {
      return messages.statusUnsavedShort;
    }
    return activeShellSaveSource === 'auto'
      ? messages.statusAutoSaved
      : messages.statusSavedShort;
  }, [
    activeShellSaveSource,
    isDirty,
    messages.statusAutoSaved,
    messages.statusNoActiveFile,
    messages.statusSavedShort,
    messages.statusUnsavedShort,
    tabSnapshot.activeTabId,
  ]);

  const notifyGenerationLock = useCallback(() => {
    if (!shellGenerationLock) {
      return false;
    }
    notifications.warning(shellGenerationReason);
    return true;
  }, [notifications, shellGenerationLock, shellGenerationReason]);

  const ensureCurrentShellTab = useCallback(async () => {
    if (appMode !== 'shell' || !vfsInitialized) {
      return undefined;
    }

    if (tabSnapshot.activeTabId) {
      return tabSnapshot.activeTabId;
    }

    if (shellSnapshot.currentFileId) {
      await fileEditor.commands.execute('tab.open', { fileId: shellSnapshot.currentFileId });
      return shellSnapshot.currentFileId;
    }

    const schema = cloneSchema(shellSnapshot.schema);
    const emptySchema = createEmptySchema();
    const shouldMaterialize = shellSnapshot.isDirty
      || hasSchemaContent(schema)
      || ((schema.name?.trim().length ?? 0) > 0 && schema.name !== emptySchema.name);
    if (!shouldMaterialize) {
      return undefined;
    }

    const createdNode = await fileEditor.commands.execute('fs.createFile', {
      parentId: null,
      name: schema.name?.trim() || messages.toolbarUntitled,
      fileType: 'page',
      content: schema,
    }) as { id?: string } | undefined;
    if (!createdNode?.id) {
      throw new Error('Failed to materialize current shell page as a tab');
    }

    await fileEditor.commands.execute('tab.open', { fileId: createdNode.id });
    return createdNode.id;
  }, [
    appMode,
    createEmptySchema,
    fileEditor.commands,
    messages.toolbarUntitled,
    shellSnapshot.currentFileId,
    shellSnapshot.isDirty,
    shellSnapshot.schema,
    tabSnapshot.activeTabId,
    vfsInitialized,
  ]);

  const filesystemService = useMemo<PluginFileSystemService | undefined>(() => {
    if (!vfsInitialized) {
      return undefined;
    }
    return {
      createFile: async (
        name: string,
        fileType: string,
        content: Record<string, unknown>,
        parentId?: string,
      ) => {
        const node = await vfs.createFile(activeProjectId, parentId ?? null, name, fileType as 'page', content);
        refreshFsTree();
        return node.id;
      },
      readFile: async (fileId: string) => {
        return await vfs.readFile(activeProjectId, fileId) as Record<string, unknown>;
      },
      writeFile: async (fileId: string, content: Record<string, unknown>) => {
        await vfs.writeFile(activeProjectId, fileId, content);
      },
    };
  }, [activeProjectId, refreshFsTree, vfs, vfsInitialized]);

  const handleActivateTab = useCallback((fileId: string) => {
    void fileEditor.commands.execute('tab.activate', { fileId });
  }, [fileEditor.commands]);

  const handleCloseTab = useCallback((fileId: string) => {
    const isActive = tabManager.getActiveTabId() === fileId;
    const isDirtyCheck = isActive ? shellSnapshot.isDirty : tabManager.getTab(fileId)?.isDirty;
    if (isDirtyCheck && dialogs?.confirmClose && !dialogs.confirmClose(messages.promptConfirmClose)) {
      return;
    }
    void fileEditor.commands.execute('tab.close', { fileId });
  }, [dialogs, fileEditor.commands, messages.promptConfirmClose, shellSnapshot.isDirty, tabManager]);

  const handleCloseOtherTabs = useCallback((fileId: string) => {
    void fileEditor.commands.execute('tab.closeOthers', { fileId });
  }, [fileEditor.commands]);

  const handleCloseAllTabs = useCallback(() => {
    void fileEditor.commands.execute('tab.closeAll');
  }, [fileEditor.commands]);

  const handleCloseSavedTabs = useCallback(() => {
    void fileEditor.commands.execute('tab.closeSaved');
  }, [fileEditor.commands]);

  const handleMoveTab = useCallback((fromIndex: number, toIndex: number) => {
    tabManager.moveTab(fromIndex, toIndex);
  }, [tabManager]);

  const handleOpenFileFromTree = useCallback((fileId: string) => {
    void fileEditor.commands.execute('tab.open', { fileId });
  }, [fileEditor.commands]);

  const handleCreateFile = useCallback((parentId: string | null, name: string, fileType: string) => {
    void fileEditor.commands.execute('fs.createFile', { parentId, name, fileType }).then((result: any) => {
      if (result?.id) {
        void fileEditor.commands.execute('tab.open', { fileId: result.id });
      }
    });
  }, [fileEditor.commands]);

  const handleCreateDirectory = useCallback((parentId: string | null, name: string) => {
    void fileEditor.commands.execute('fs.createDirectory', { parentId, name });
  }, [fileEditor.commands]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    void fileEditor.commands.execute('fs.deleteNode', { nodeId });
  }, [fileEditor.commands]);

  const handleRenameNode = useCallback((nodeId: string, newName: string) => {
    void fileEditor.commands.execute('fs.rename', { nodeId, newName });
  }, [fileEditor.commands]);

  const handleMoveNode = useCallback((
    nodeId: string,
    newParentId: string | null,
    afterNodeId: string | null,
  ) => {
    void fileEditor.commands.execute('fs.move', { nodeId, newParentId, afterNodeId });
  }, [fileEditor.commands]);

  const handleImportJSONFile = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const input = event.target;
    input.value = '';

    try {
      if (notifyGenerationLock()) {
        return;
      }
      const text = await file.text();
      let schema: PageSchema;

      try {
        schema = JSON.parse(text) as PageSchema;
      } catch {
        notifications.error(messages.importInvalidJSON);
        return;
      }

      if (!schema || typeof schema !== 'object' || !('body' in schema)) {
        notifications.error(messages.importMissingBody);
        return;
      }

      await fileEditor.commands.execute('editor.restoreSnapshot', {
        snapshot: {
          schema,
          isDirty: true,
          ...(shellSnapshot.currentFileId ? { currentFileId: shellSnapshot.currentFileId } : {}),
        },
      });

      notifications.success(messages.importSuccess);
    } catch {
      notifications.error(messages.importReadError);
    }
  }, [
    fileEditor.commands,
    messages.importInvalidJSON,
    messages.importMissingBody,
    messages.importReadError,
    messages.importSuccess,
    notifications,
    notifyGenerationLock,
    shellSnapshot.currentFileId,
  ]);

  const handleSaveGuarded = useCallback(() => {
    if (!notifyGenerationLock()) {
      handleSave();
    }
  }, [handleSave, notifyGenerationLock]);

  const handleUndoGuarded = useCallback(() => {
    if (!notifyGenerationLock()) {
      handleUndo();
    }
  }, [handleUndo, notifyGenerationLock]);

  const handleRedoGuarded = useCallback(() => {
    if (!notifyGenerationLock()) {
      handleRedo();
    }
  }, [handleRedo, notifyGenerationLock]);

  const stableExpandedIds = useCallback((nextExpandedIds: string[]) => {
    setFileExplorerExpandedIds((previous) => (
      areStringArraysEqual(previous, nextExpandedIds) ? previous : nextExpandedIds
    ));
  }, []);

  const stableFocusedId = useCallback((nextFocusedId: string | undefined) => {
    setFileExplorerFocusedId((previous) => (
      previous === nextFocusedId ? previous : nextFocusedId
    ));
  }, []);

  return {
    vfs,
    tabManager,
    vfsInitialized,
    vfsInitializationFailed,
    fsTree,
    fileExplorerExpandedIds,
    fileExplorerFocusedId,
    setFileExplorerExpandedIds,
    setFileExplorerFocusedId,
    handleExpandedIdsChange: stableExpandedIds,
    handleFocusedIdChange: stableFocusedId,
    tabSnapshot,
    dirtyFileIds,
    activeFileName,
    filesPrimaryPanelOptions,
    isDirty,
    canUndo,
    canRedo,
    fileExplorerStatusText,
    shellGenerationLock,
    shellGenerationReason,
    notifyGenerationLock,
    filesystemService,
    handleSaveGuarded,
    handleUndoGuarded,
    handleRedoGuarded,
    ensureCurrentShellTab,
    refreshFsTree,
    handleActivateTab,
    handleCloseTab,
    handleCloseOtherTabs,
    handleCloseAllTabs,
    handleCloseSavedTabs,
    handleMoveTab,
    handleOpenFileFromTree,
    handleCreateFile,
    handleCreateDirectory,
    handleDeleteNode,
    handleRenameNode,
    handleMoveNode,
    handleImportJSONFile,
  };
}
