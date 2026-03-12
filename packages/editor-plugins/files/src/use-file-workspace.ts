import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SidebarTabContribution } from '@shenbi/editor-plugin-api';
import type { FilePanelFileItem } from './FilePanel';
import {
  createFilesSidebarTab,
  type CreateFilesSidebarTabOptions,
} from './sidebar-tab';

export type EditorMode = 'shell' | 'scenarios';

export interface FileWorkspaceSnapshot {
  currentFileId: string | undefined;
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
  promptFileName?: (defaultName: string) => string | null;
}

export interface UseFileWorkspaceResult {
  activeFileId: string | undefined;
  activeFileName: string | undefined;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  fileStatus: string;
  filesSidebarTab: SidebarTabContribution | undefined;
  filesSidebarTabOptions: CreateFilesSidebarTabOptions | undefined;
  handleSave: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  refreshFiles: () => void;
}

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
  const { mode, snapshot, commands, onError, promptFileName } = options;
  const [storedFiles, setStoredFiles] = useState<FilePanelFileItem[]>([]);
  const [fileStatus, setFileStatus] = useState<string>('当前未绑定文件');

  const activeFileId = mode === 'shell' ? snapshot.currentFileId : undefined;
  const isDirty = mode === 'shell' ? snapshot.isDirty : false;
  const canUndo = mode === 'shell' ? snapshot.canUndo : false;
  const canRedo = mode === 'shell' ? snapshot.canRedo : false;

  // Stable refs for frequently-changing callbacks/values to break dependency cascades
  const commandsRef = useRef(commands);
  commandsRef.current = commands;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const promptFileNameRef = useRef(promptFileName);
  promptFileNameRef.current = promptFileName;
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const activeFileIdRef = useRef(activeFileId);
  activeFileIdRef.current = activeFileId;
  const canUndoRef = useRef(canUndo);
  canUndoRef.current = canUndo;
  const canRedoRef = useRef(canRedo);
  canRedoRef.current = canRedo;

  const reportError = useCallback((prefix: string, error: unknown) => {
    const message = `${prefix}: ${getErrorMessage(error)}`;
    setFileStatus(message);
    onErrorRef.current?.(message);
  }, []);

  const refreshFiles = useCallback(() => {
    void commandsRef.current.execute('file.listSchemas')
      .then((listResult) => {
        const files = normalizeFileMetadataList(listResult);
        const sorted = [...files].sort((left, right) => right.updatedAt - left.updatedAt);
        setStoredFiles(sorted);
      })
      .catch((error) => {
        reportError('文件列表加载失败', error);
      });
  }, [reportError]);

  const requestSaveAs = useCallback(() => {
    const defaultName = snapshotRef.current.schemaName?.trim() || 'new-page';
    const nextName = promptFileNameRef.current?.(defaultName) ?? null;
    if (!nextName || !nextName.trim()) {
      return;
    }

    void commandsRef.current.execute('file.saveAs', { name: nextName.trim() })
      .then((saveAsResult) => {
        const nextFileId = typeof saveAsResult === 'string' ? saveAsResult : nextName.trim();
        setFileStatus(`已保存: ${nextFileId}`);
        refreshFiles();
      })
      .catch((error) => {
        reportError('另存失败', error);
      });
  }, [refreshFiles, reportError]);

  const handleOpenFile = useCallback((fileId: string) => {
    void commandsRef.current.execute('file.openSchema', { fileId })
      .then(() => {
        setFileStatus(`已打开: ${fileId}`);
        refreshFiles();
      })
      .catch((error) => {
        reportError('打开失败', error);
      });
  }, [refreshFiles, reportError]);

  const handleSave = useCallback(() => {
    if (mode === 'shell') {
      if (!activeFileIdRef.current) {
        const message = '请先从文件树创建或打开文件';
        setFileStatus(message);
        onErrorRef.current?.(message);
        return;
      }
      void commandsRef.current.execute('tab.save')
        .then(() => {
          setFileStatus(`已保存: ${activeFileIdRef.current}`);
          refreshFiles();
        })
        .catch((error) => {
          reportError('保存失败', error);
        });
      return;
    }

    if (!activeFileIdRef.current) {
      requestSaveAs();
      return;
    }
    void commandsRef.current.execute('file.saveSchema')
      .then(() => {
        setFileStatus(`已保存: ${activeFileIdRef.current}`);
        refreshFiles();
      })
      .catch((error) => {
        reportError('保存失败', error);
      });
  }, [mode, refreshFiles, reportError, requestSaveAs]);

  const handleSaveAs = useCallback(() => {
    requestSaveAs();
  }, [requestSaveAs]);

  const handleUndo = useCallback(() => {
    if (!canUndoRef.current) {
      return;
    }
    void commandsRef.current.execute('editor.undo').catch((error) => {
      reportError('撤销失败', error);
    });
  }, [reportError]);

  const handleRedo = useCallback(() => {
    if (!canRedoRef.current) {
      return;
    }
    void commandsRef.current.execute('editor.redo').catch((error) => {
      reportError('重做失败', error);
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
      files: storedFiles,
      activeFileId,
      status: fileStatus,
      onOpenFile: handleOpenFile,
      onSaveFile: handleSave,
      onSaveAsFile: handleSaveAs,
      onRefresh: refreshFiles,
    });
  }, [activeFileId, fileStatus, handleOpenFile, handleSave, handleSaveAs, mode, refreshFiles, storedFiles]);
  const filesSidebarTabOptions = useMemo<CreateFilesSidebarTabOptions | undefined>(() => {
    if (mode !== 'shell') {
      return undefined;
    }
    return {
      files: storedFiles,
      activeFileId,
      status: fileStatus,
      onOpenFile: handleOpenFile,
      onSaveFile: handleSave,
      onSaveAsFile: handleSaveAs,
      onRefresh: refreshFiles,
    };
  }, [activeFileId, fileStatus, handleOpenFile, handleSave, handleSaveAs, mode, refreshFiles, storedFiles]);

  return {
    activeFileId,
    activeFileName,
    isDirty,
    canUndo,
    canRedo,
    fileStatus,
    filesSidebarTab,
    filesSidebarTabOptions,
    handleSave,
    handleUndo,
    handleRedo,
    refreshFiles,
  };
}

