import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFilesHostCommandsPlugin,
  createFilesHostPlugin,
  createWorkspaceFilesHostAdapter,
} from './files-host-adapter';

function createWorkspace() {
  return {
    fsTree: [],
    tabSnapshot: {
      tabs: [
        { fileId: 'page-1', title: 'Page 1', isDirty: true },
      ],
      activeTabId: 'page-1',
    },
    dirtyFileIds: new Set(['page-1']),
    fileExplorerStatusText: 'Unsaved',
    fileExplorerExpandedIds: ['root'],
    fileExplorerFocusedId: 'page-1',
    handleExpandedIdsChange: vi.fn(),
    handleFocusedIdChange: vi.fn(),
    handleSaveGuarded: vi.fn(),
    handleCloseTab: vi.fn(),
    handleOpenFileFromTree: vi.fn(),
    handleCreateFile: vi.fn(),
    handleCreateDirectory: vi.fn(),
    handleDeleteNode: vi.fn(),
    handleRenameNode: vi.fn(),
    refreshFsTree: vi.fn(),
    handleMoveNode: vi.fn(),
  };
}

describe('files-host-adapter', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('creates host adapter explorer props from workspace state', () => {
    const workspace = createWorkspace();
    const adapter = createWorkspaceFilesHostAdapter(workspace as never);

    expect(adapter.activeFileId).toBe('page-1');
    expect(adapter.explorerProps.activeFileId).toBe('page-1');
    expect(adapter.explorerProps.statusText).toBe('Unsaved');
    expect(adapter.explorerProps.canSaveActiveFile).toBe(true);
    adapter.closeActiveFile();
    expect(workspace.handleCloseTab).toHaveBeenCalledWith('page-1');
  });

  it('renders a files primary panel from the host adapter', () => {
    const workspace = createWorkspace();
    const adapter = createWorkspaceFilesHostAdapter(workspace as never);
    const plugin = createFilesHostPlugin({
      hostAdapter: adapter,
      files: [],
      activeFileId: undefined,
      status: 'idle',
      onOpenFile: vi.fn(),
      onSaveFile: vi.fn(),
      onSaveAsFile: vi.fn(),
      onRefresh: vi.fn(),
    });

    const panel = plugin.contributes?.primaryPanels?.[0];
    expect(panel).toBeDefined();
    render(<>{panel?.render()}</>);
    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(
      screen.getByText('No files. Click the button above to create one.'),
    ).toBeInTheDocument();
  });

  it('reads the latest explorer props from hostAdapterRef without recreating the plugin', () => {
    const firstAdapter = {
      explorerProps: {
        tree: [
          {
            id: 'dir-1',
            name: 'pages',
            type: 'directory' as const,
            path: '/pages',
            children: [
              {
                id: 'page-1',
                name: 'First File',
                type: 'file' as const,
                fileType: 'page' as const,
                path: '/pages/first.page.json',
              },
            ],
          },
        ],
        activeFileId: 'page-1',
        dirtyFileIds: new Set(['page-1']),
        statusText: 'First status',
        canSaveActiveFile: true,
        onSaveActiveFile: vi.fn(),
        initialExpandedIds: [],
        initialFocusedId: 'page-1',
        onExpandedIdsChange: vi.fn(),
        onFocusedIdChange: vi.fn(),
        onOpenFile: vi.fn(),
        onCreateFile: vi.fn(),
        onCreateDirectory: vi.fn(),
        onDeleteNode: vi.fn(),
        onRenameNode: vi.fn(),
        onRefresh: vi.fn(),
        onMoveNode: vi.fn(),
      },
      activeFileId: 'page-1',
      closeActiveFile: vi.fn(),
    };
    const hostAdapterRef = { current: firstAdapter };
    const plugin = createFilesHostPlugin({
      hostAdapter: firstAdapter,
      hostAdapterRef,
      files: [],
      activeFileId: undefined,
      status: 'idle',
      onOpenFile: vi.fn(),
      onSaveFile: vi.fn(),
      onSaveAsFile: vi.fn(),
      onRefresh: vi.fn(),
    });

    hostAdapterRef.current = {
      ...firstAdapter,
      explorerProps: {
        ...firstAdapter.explorerProps,
        tree: [
          {
            id: 'dir-1',
            name: 'pages',
            type: 'directory' as const,
            path: '/pages',
            children: [
              {
                id: 'page-2',
                name: 'Second File',
                type: 'file' as const,
                fileType: 'page' as const,
                path: '/pages/second.page.json',
              },
            ],
          },
        ],
        activeFileId: 'page-2',
        initialFocusedId: 'page-2',
      },
    };

    const panel = plugin.contributes?.primaryPanels?.[0];
    render(<>{panel?.render()}</>);

    expect(screen.getByText('Second File')).toBeInTheDocument();
  });

  it('creates close-tab commands from the host adapter', async () => {
    const workspace = createWorkspace();
    const adapter = createWorkspaceFilesHostAdapter(workspace as never);
    const plugin = createFilesHostCommandsPlugin({
      hostAdapter: adapter,
      title: 'Close Active Tab',
      category: 'Files',
    });

    const command = plugin.contributes?.commands?.[0];
    expect(command?.id).toBe('files.closeActiveTab');
    await command?.execute();
    expect(workspace.handleCloseTab).toHaveBeenCalledWith('page-1');
  });

  it('reads the latest close-tab action from hostAdapterRef', async () => {
    const firstCloseActiveFile = vi.fn();
    const secondCloseActiveFile = vi.fn();
    const hostAdapterRef = {
      current: {
        explorerProps: {
          tree: [],
          activeFileId: 'page-1',
          dirtyFileIds: new Set<string>(),
          statusText: 'idle',
          canSaveActiveFile: false,
          onSaveActiveFile: vi.fn(),
          initialExpandedIds: [],
          initialFocusedId: undefined,
          onExpandedIdsChange: vi.fn(),
          onFocusedIdChange: vi.fn(),
          onOpenFile: vi.fn(),
          onCreateFile: vi.fn(),
          onCreateDirectory: vi.fn(),
          onDeleteNode: vi.fn(),
          onRenameNode: vi.fn(),
          onRefresh: vi.fn(),
          onMoveNode: vi.fn(),
        },
        activeFileId: 'page-1',
        closeActiveFile: firstCloseActiveFile,
      },
    };
    const plugin = createFilesHostCommandsPlugin({
      hostAdapter: hostAdapterRef.current,
      hostAdapterRef,
      title: 'Close Active Tab',
      category: 'Files',
    });
    const command = plugin.contributes?.commands?.[0];

    hostAdapterRef.current = {
      ...hostAdapterRef.current,
      activeFileId: 'page-2',
      closeActiveFile: secondCloseActiveFile,
    };

    await command?.execute();

    expect(firstCloseActiveFile).not.toHaveBeenCalled();
    expect(secondCloseActiveFile).toHaveBeenCalledTimes(1);
  });
});
