import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
});
