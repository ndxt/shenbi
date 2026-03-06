import React from 'react';
import type { SidebarTabContribution } from '@shenbi/editor-plugin-api';
import { FilePanel, type FilePanelFileItem } from './FilePanel';

export interface CreateFilesSidebarTabOptions {
  id?: string;
  label?: string;
  order?: number;
  files: FilePanelFileItem[];
  activeFileId: string | undefined;
  status: string;
  onOpenFile: (fileId: string) => void;
  onSaveFile: () => void;
  onSaveAsFile: () => void;
  onRefresh: () => void;
}

export function createFilesSidebarTab(
  options: CreateFilesSidebarTabOptions,
): SidebarTabContribution {
  return {
    id: options.id ?? 'files',
    label: options.label ?? 'Files',
    order: options.order ?? 35,
    render: () => (
      <FilePanel
        files={options.files}
        activeFileId={options.activeFileId}
        status={options.status}
        onOpenFile={options.onOpenFile}
        onSaveFile={options.onSaveFile}
        onSaveAsFile={options.onSaveAsFile}
        onRefresh={options.onRefresh}
      />
    ),
  };
}
