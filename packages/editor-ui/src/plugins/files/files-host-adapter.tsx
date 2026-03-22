import React from 'react';
import {
  createFilesPlugin,
  FileExplorer,
  type CreateFilesPluginOptions,
  type FileExplorerProps,
} from '@shenbi/editor-plugin-files';
import {
  defineEditorPlugin,
  type EditorPluginManifest,
} from '@shenbi/editor-plugin-api';
import type { WorkspaceHostState } from '../../hooks/useWorkspaceHost';

type WorkspaceFilesHostSource = Pick<
  WorkspaceHostState,
  | 'fsTree'
  | 'tabSnapshot'
  | 'dirtyFileIds'
  | 'fileExplorerStatusText'
  | 'fileExplorerExpandedIds'
  | 'fileExplorerFocusedId'
  | 'handleExpandedIdsChange'
  | 'handleFocusedIdChange'
  | 'handleSaveGuarded'
  | 'handleCloseTab'
  | 'handleOpenFileFromTree'
  | 'handleCreateFile'
  | 'handleCreateDirectory'
  | 'handleDeleteNode'
  | 'handleRenameNode'
  | 'refreshFsTree'
  | 'handleMoveNode'
>;

export interface FilesHostAdapter {
  explorerProps: FileExplorerProps;
  activeFileId?: string | undefined;
  closeActiveFile: () => void;
}

export interface CreateFilesHostPluginOptions extends Omit<
  CreateFilesPluginOptions,
  'renderPrimaryPanel'
> {
  hostAdapter: FilesHostAdapter;
  /** When provided, render reads the latest adapter from this ref instead of the static hostAdapter. */
  hostAdapterRef?: { current: FilesHostAdapter } | undefined;
}

export interface CreateFilesHostCommandsPluginOptions {
  hostAdapter: FilesHostAdapter;
  /** When provided, execute reads the latest adapter from this ref. */
  hostAdapterRef?: { current: FilesHostAdapter } | undefined;
  title: string;
  category: string;
  commandId?: string | undefined;
  shortcutId?: string | undefined;
  keybinding?: string | undefined;
  when?: string | undefined;
  pluginId?: string | undefined;
  pluginName?: string | undefined;
}

export function createWorkspaceFilesHostAdapter(
  workspace: WorkspaceFilesHostSource,
): FilesHostAdapter {
  const activeFileId = workspace.tabSnapshot.activeTabId;
  return {
    explorerProps: {
      tree: workspace.fsTree,
      activeFileId,
      dirtyFileIds: workspace.dirtyFileIds,
      statusText: workspace.fileExplorerStatusText,
      canSaveActiveFile: Boolean(
        activeFileId && workspace.dirtyFileIds.has(activeFileId),
      ),
      onSaveActiveFile: workspace.handleSaveGuarded,
      initialExpandedIds: workspace.fileExplorerExpandedIds,
      initialFocusedId: workspace.fileExplorerFocusedId,
      onExpandedIdsChange: workspace.handleExpandedIdsChange,
      onFocusedIdChange: workspace.handleFocusedIdChange,
      onOpenFile: workspace.handleOpenFileFromTree,
      onCreateFile: workspace.handleCreateFile,
      onCreateDirectory: workspace.handleCreateDirectory,
      onDeleteNode: workspace.handleDeleteNode,
      onRenameNode: workspace.handleRenameNode,
      onRefresh: workspace.refreshFsTree,
      onMoveNode: workspace.handleMoveNode,
    },
    activeFileId,
    closeActiveFile: () => {
      if (activeFileId) {
        workspace.handleCloseTab(activeFileId);
      }
    },
  };
}

export function createFilesHostPlugin({
  hostAdapter,
  hostAdapterRef,
  ...options
}: CreateFilesHostPluginOptions): EditorPluginManifest {
  return createFilesPlugin({
    ...options,
    renderPrimaryPanel: () => {
      const adapter = hostAdapterRef ? hostAdapterRef.current : hostAdapter;
      return <FileExplorer {...adapter.explorerProps} />;
    },
  });
}

export function createFilesHostCommandsPlugin({
  hostAdapter,
  hostAdapterRef,
  title,
  category,
  commandId = 'files.closeActiveTab',
  shortcutId = 'files.closeActiveTab.shortcut',
  keybinding = 'Ctrl+W',
  when = 'editorFocused && !inputFocused',
  pluginId = 'shenbi.plugin.files.commands',
  pluginName = 'Files Commands',
}: CreateFilesHostCommandsPluginOptions): EditorPluginManifest {
  return defineEditorPlugin({
    id: pluginId,
    name: pluginName,
    contributes: {
      commands: [
        {
          id: commandId,
          title,
          category,
          execute: () => {
            const adapter = hostAdapterRef ? hostAdapterRef.current : hostAdapter;
            adapter.closeActiveFile();
          },
        },
      ],
      shortcuts: [
        {
          id: shortcutId,
          commandId,
          keybinding,
          when,
        },
      ],
    },
  });
}
