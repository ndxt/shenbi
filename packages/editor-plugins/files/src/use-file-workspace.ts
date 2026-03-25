import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PrimaryPanelContribution, SidebarTabContribution } from '@shenbi/editor-plugin-api';
import { useCurrentLocale, useTranslation } from '@shenbi/i18n';
import type { FilePanelFileItem } from './FilePanel';
import { FilePanel } from './FilePanel';
import {
  createFilesSidebarTab,
  type CreateFilesSidebarTabOptions,
} from './sidebar-tab';
import './i18n';

export type EditorMode = 'shell' | 'scenarios';

export interface FileWorkspaceSnapshot {
  currentFileId: string | undefined;
  activeFileType?: string | undefined;
  schemaName: string | undefined;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

export interface FileCommandExecutor {
  execute(commandId: string, args?: unknown): Promise<unknown>;
}

export interface UseFileWorkspaceOptions {
  mode: EditorMode;
  snapshot: FileWorkspaceSnapshot;
  commands: FileCommandExecutor;
  onError?: (message: string) => void;
  promptFileName?: (defaultName: string) => string | null | Promise<string | null>;
  documentState?: {
    isDirty: boolean;
    canUndo: boolean;
    canRedo: boolean;
  } | undefined;
  documentActions?: {
    save: () => void | Promise<void>;
    undo: () => void | Promise<void>;
    redo: () => void | Promise<void>;
  } | undefined;
}

export interface UseFileWorkspaceResult {
  activeFileId: string | undefined;
  activeFileName: string | undefined;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  fileStatus: string;
  activeFileType: string | undefined;
  showPageContextPanel: boolean;
  filesPrimaryPanel: PrimaryPanelContribution | undefined;
  filesPrimaryPanelOptions: CreateFilesSidebarTabOptions | undefined;
  filesSidebarTab: SidebarTabContribution | undefined;
  filesSidebarTabOptions: CreateFilesSidebarTabOptions | undefined;
  handleSave: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  refreshFiles: () => void;
}

type FileStatusState =
  | { kind: 'idle' }
  | { kind: 'saved'; fileId: string }
  | { kind: 'opened'; fileId: string }
  | { kind: 'error'; translationKey: string; message?: string };

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'unknown error';
}

function normalizeFileMetadataList(value: unknown): FilePanelFileItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is FilePanelFileItem => {
    return Boolean(item)
      && typeof item === 'object'
      && typeof (item as { id?: unknown }).id === 'string'
      && typeof (item as { name?: unknown }).name === 'string'
      && typeof (item as { updatedAt?: unknown }).updatedAt === 'number';
  });
}

function isEditableHotkeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  return target.closest('[contenteditable="true"]') !== null;
}

export function useFileWorkspace(options: UseFileWorkspaceOptions): UseFileWorkspaceResult {
  const { mode, snapshot, commands, onError, promptFileName, documentState, documentActions } = options;
  const [storedFiles, setStoredFiles] = useState<FilePanelFileItem[]>([]);
  const [statusState, setStatusState] = useState<FileStatusState>({ kind: 'idle' });
  const { t } = useTranslation('pluginFiles');
  const currentLocale = useCurrentLocale();

  const activeFileId = mode === 'shell' ? snapshot.currentFileId : undefined;
  const activeFileType = mode === 'shell' ? snapshot.activeFileType : undefined;
  const isDirty = mode === 'shell' ? (documentState?.isDirty ?? snapshot.isDirty) : false;
  const canUndo = mode === 'shell' ? (documentState?.canUndo ?? snapshot.canUndo) : false;
  const canRedo = mode === 'shell' ? (documentState?.canRedo ?? snapshot.canRedo) : false;

  const commandsRef = useRef(commands);
  commandsRef.current = commands;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const promptFileNameRef = useRef(promptFileName);
  promptFileNameRef.current = promptFileName;
  const documentActionsRef = useRef(documentActions);
  documentActionsRef.current = documentActions;
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const activeFileIdRef = useRef(activeFileId);
  activeFileIdRef.current = activeFileId;
  const canUndoRef = useRef(canUndo);
  canUndoRef.current = canUndo;
  const canRedoRef = useRef(canRedo);
  canRedoRef.current = canRedo;

  const fileStatus = useMemo(() => {
    if (statusState.kind === 'idle') {
      return t('status.noBoundFile');
    }
    if (statusState.kind === 'saved') {
      return t('status.saved', { fileId: statusState.fileId });
    }
    if (statusState.kind === 'opened') {
      return t('status.opened', { fileId: statusState.fileId });
    }
    return t(statusState.translationKey, { message: statusState.message ?? '' });
  }, [currentLocale, statusState, t]);

  const reportError = useCallback((translationKey: string, error: unknown) => {
    const nextStatus: FileStatusState = {
      kind: 'error',
      translationKey,
      message: getErrorMessage(error),
    };
    setStatusState(nextStatus);
    onErrorRef.current?.(t(nextStatus.translationKey, { message: nextStatus.message }));
  }, [t]);

  const refreshFiles = useCallback(() => {
    void commandsRef.current.execute('file.listSchemas')
      .then((listResult) => {
        const files = normalizeFileMetadataList(listResult);
        const sorted = [...files].sort((left, right) => right.updatedAt - left.updatedAt);
        setStoredFiles(sorted);
      })
      .catch((error) => {
        reportError('status.listLoadFailed', error);
      });
  }, [reportError]);

  const requestSaveAs = useCallback(async () => {
    const defaultName = snapshotRef.current.schemaName?.trim() || 'new-page';
    const nextName = await promptFileNameRef.current?.(defaultName) ?? null;
    if (!nextName || !nextName.trim()) {
      return;
    }

    void commandsRef.current.execute('file.saveAs', { name: nextName.trim() })
      .then((saveAsResult) => {
        const nextFileId = typeof saveAsResult === 'string' ? saveAsResult : nextName.trim();
        setStatusState({ kind: 'saved', fileId: nextFileId });
        refreshFiles();
      })
      .catch((error) => {
        reportError('status.saveAsFailed', error);
      });
  }, [refreshFiles, reportError]);

  const handleOpenFile = useCallback((fileId: string) => {
    void commandsRef.current.execute('file.openSchema', { fileId })
      .then(() => {
        setStatusState({ kind: 'opened', fileId });
        refreshFiles();
      })
      .catch((error) => {
        reportError('status.openFailed', error);
      });
  }, [refreshFiles, reportError]);

  const handleSave = useCallback(() => {
    if (mode === 'shell') {
      if (documentActionsRef.current) {
        void Promise.resolve(documentActionsRef.current.save())
          .then(() => {
            if (activeFileIdRef.current) {
              setStatusState({ kind: 'saved', fileId: activeFileIdRef.current });
            }
            refreshFiles();
          })
          .catch((error) => {
            reportError('status.saveFailed', error);
          });
        return;
      }
      if (!activeFileIdRef.current) {
        const translationKey = 'status.createOrOpenFirst';
        setStatusState({ kind: 'error', translationKey });
        onErrorRef.current?.(t(translationKey));
        return;
      }
      void commandsRef.current.execute('tab.save')
        .then(() => {
          setStatusState({ kind: 'saved', fileId: activeFileIdRef.current! });
          refreshFiles();
        })
        .catch((error) => {
          reportError('status.saveFailed', error);
        });
      return;
    }

    if (!activeFileIdRef.current) {
      requestSaveAs();
      return;
    }
    void commandsRef.current.execute('file.saveSchema')
      .then(() => {
        setStatusState({ kind: 'saved', fileId: activeFileIdRef.current! });
        refreshFiles();
      })
      .catch((error) => {
        reportError('status.saveFailed', error);
      });
  }, [mode, refreshFiles, reportError, requestSaveAs, t]);

  const handleSaveAs = useCallback(() => {
    requestSaveAs();
  }, [requestSaveAs]);

  const handleUndo = useCallback(() => {
    if (!canUndoRef.current) {
      return;
    }
    if (documentActionsRef.current) {
      void Promise.resolve(documentActionsRef.current.undo()).catch((error) => {
        reportError('status.undoFailed', error);
      });
      return;
    }
    void commandsRef.current.execute('editor.undo').catch((error) => {
      reportError('status.undoFailed', error);
    });
  }, [reportError]);

  const handleRedo = useCallback(() => {
    if (!canRedoRef.current) {
      return;
    }
    if (documentActionsRef.current) {
      void Promise.resolve(documentActionsRef.current.redo()).catch((error) => {
        reportError('status.redoFailed', error);
      });
      return;
    }
    void commandsRef.current.execute('editor.redo').catch((error) => {
      reportError('status.redoFailed', error);
    });
  }, [reportError]);

  useEffect(() => {
    if (mode !== 'shell') {
      return;
    }
    refreshFiles();
  }, [mode, refreshFiles]);

  useEffect(() => {
    if (mode !== 'shell') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const withPrimaryModifier = event.ctrlKey || event.metaKey;
      if (!withPrimaryModifier || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        handleSave();
        return;
      }

      if (isEditableHotkeyTarget(event.target)) {
        return;
      }

      if (key === 'z' && !event.shiftKey) {
        if (!canUndoRef.current) {
          return;
        }
        event.preventDefault();
        handleUndo();
        return;
      }

      if ((key === 'z' && event.shiftKey) || key === 'y') {
        if (!canRedoRef.current) {
          return;
        }
        event.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleRedo, handleSave, handleUndo, mode]);

  useEffect(() => {
    if (mode !== 'shell' || !isDirty) {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, mode]);

  const activeFileName = useMemo(() => {
    if (!activeFileId) {
      return undefined;
    }
    return storedFiles.find((file) => file.id === activeFileId)?.name;
  }, [activeFileId, storedFiles]);

  const filesSidebarTab = useMemo<SidebarTabContribution | undefined>(() => {
    if (mode !== 'shell') {
      return undefined;
    }
    return createFilesSidebarTab({
      label: t('title'),
      files: storedFiles,
      activeFileId,
      status: fileStatus,
      onOpenFile: handleOpenFile,
      onSaveFile: handleSave,
      onSaveAsFile: handleSaveAs,
      onRefresh: refreshFiles,
    });
  }, [
    activeFileId,
    currentLocale,
    fileStatus,
    handleOpenFile,
    handleSave,
    handleSaveAs,
    mode,
    refreshFiles,
    storedFiles,
    t,
  ]);
  const filesSidebarTabOptions = useMemo<CreateFilesSidebarTabOptions | undefined>(() => {
    if (mode !== 'shell') {
      return undefined;
    }
    return {
      label: t('title'),
      files: storedFiles,
      activeFileId,
      status: fileStatus,
      onOpenFile: handleOpenFile,
      onSaveFile: handleSave,
      onSaveAsFile: handleSaveAs,
      onRefresh: refreshFiles,
    };
  }, [
    activeFileId,
    currentLocale,
    fileStatus,
    handleOpenFile,
    handleSave,
    handleSaveAs,
    mode,
    refreshFiles,
    storedFiles,
    t,
  ]);
  const filesPrimaryPanel = useMemo<PrimaryPanelContribution | undefined>(() => {
    if (mode !== 'shell' || !filesSidebarTabOptions) {
      return undefined;
    }
    return {
      id: 'files',
      label: t('title'),
      order: 35,
      render: () => createElement(FilePanel, {
        files: filesSidebarTabOptions.files,
        activeFileId: filesSidebarTabOptions.activeFileId,
        status: filesSidebarTabOptions.status,
        onOpenFile: filesSidebarTabOptions.onOpenFile,
        onSaveFile: filesSidebarTabOptions.onSaveFile,
        onSaveAsFile: filesSidebarTabOptions.onSaveAsFile,
        onRefresh: filesSidebarTabOptions.onRefresh,
      }),
    };
  }, [filesSidebarTabOptions, mode, t]);

  return {
    activeFileId,
    activeFileName,
    activeFileType,
    isDirty,
    canUndo,
    canRedo,
    fileStatus,
    showPageContextPanel: activeFileType === 'page',
    filesPrimaryPanel,
    filesPrimaryPanelOptions: filesSidebarTabOptions,
    filesSidebarTab,
    filesSidebarTabOptions,
    handleSave,
    handleUndo,
    handleRedo,
    refreshFiles,
  };
}
