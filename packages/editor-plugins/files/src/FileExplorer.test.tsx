import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileExplorer } from './FileExplorer';
import type { FSTreeNode } from '@shenbi/editor-core';

const tree: FSTreeNode[] = [
  {
    id: 'dir-1',
    name: 'pages',
    type: 'directory',
    path: '/pages',
    children: [
      {
        id: 'file-1',
        name: 'home',
        type: 'file',
        fileType: 'page',
        path: '/pages/home.page.json',
      },
    ],
  },
];

describe('FileExplorer', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('auto-expands ancestors for the active file', async () => {
    render(
      <FileExplorer
        tree={tree}
        activeFileId="file-1"
        dirtyFileIds={new Set(['file-1'])}
        onOpenFile={vi.fn()}
        onCreateFile={vi.fn()}
        onCreateDirectory={vi.fn()}
        onDeleteNode={vi.fn()}
        onRenameNode={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('home')).toBeInTheDocument();
    });
  });

  it('exposes save action and focused node changes', async () => {
    const onSaveActiveFile = vi.fn();
    const onFocusedIdChange = vi.fn();

    render(
      <FileExplorer
        tree={tree}
        activeFileId="file-1"
        dirtyFileIds={new Set(['file-1'])}
        statusText="未保存"
        canSaveActiveFile
        onSaveActiveFile={onSaveActiveFile}
        onFocusedIdChange={onFocusedIdChange}
        onOpenFile={vi.fn()}
        onCreateFile={vi.fn()}
        onCreateDirectory={vi.fn()}
        onDeleteNode={vi.fn()}
        onRenameNode={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle('保存当前文件'));
    expect(onSaveActiveFile).toHaveBeenCalled();

    fireEvent.click(await screen.findByText('home'));
    await waitFor(() => {
      expect(onFocusedIdChange).toHaveBeenLastCalledWith('file-1');
    });
  });
});
