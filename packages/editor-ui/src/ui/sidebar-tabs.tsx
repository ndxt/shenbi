import React from 'react';
import type { ComponentContract } from '@shenbi/schema';
import { ComponentPanel } from '../panels/ComponentPanel';
import { FilePanel, type FilePanelFileItem } from '../panels/FilePanel';
import { PagePanel } from '../panels/PagePanel';
import { type SchemaNode as TreeSchemaNode, SchemaTree } from '../panels/SchemaTree';

export interface SidebarTabRenderContext {
  contracts?: ComponentContract[];
  treeNodes?: TreeSchemaNode[];
  selectedNodeId?: string;
  onSelectNode?: (nodeId: string) => void;
  onInsertComponent?: (componentType: string) => void;
}

export interface SidebarTabContribution {
  id: string;
  label: string;
  order?: number;
  render: (context: SidebarTabRenderContext) => React.ReactNode;
}

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

function createBuiltinSidebarTabs(): SidebarTabContribution[] {
  return [
    {
      id: 'components',
      label: 'Components',
      order: 10,
      render: (context) => (
        <ComponentPanel
          {...(context.contracts ? { contracts: context.contracts } : {})}
          {...(context.onInsertComponent ? { onInsert: context.onInsertComponent } : {})}
        />
      ),
    },
    {
      id: 'outline',
      label: 'Outline',
      order: 20,
      render: (context) => (
        <SchemaTree
          {...(context.treeNodes ? { nodes: context.treeNodes } : {})}
          {...(context.selectedNodeId ? { selectedNodeId: context.selectedNodeId } : {})}
          {...(context.onSelectNode ? { onSelect: context.onSelectNode } : {})}
          {...(context.contracts ? { contracts: context.contracts } : {})}
        />
      ),
    },
    {
      id: 'data',
      label: 'Data',
      order: 30,
      render: () => <PagePanel />,
    },
  ];
}

export function resolveSidebarTabs(
  extensions?: SidebarTabContribution[],
): SidebarTabContribution[] {
  const merged = new Map<string, SidebarTabContribution>();
  for (const tab of createBuiltinSidebarTabs()) {
    merged.set(tab.id, tab);
  }
  for (const tab of extensions ?? []) {
    merged.set(tab.id, tab);
  }
  return [...merged.values()].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
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
