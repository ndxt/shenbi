import React from 'react';
import {
  mergeContributions,
  type SidebarTabContribution,
  type SidebarTabRenderContext,
} from '@shenbi/editor-plugin-api';
import { i18n } from '@shenbi/i18n';
import {
  createFilesSidebarTab,
  type CreateFilesSidebarTabOptions,
} from '@shenbi/editor-plugin-files';
import { ComponentPanel } from '../panels/ComponentPanel';
import { PagePanel } from '../panels/PagePanel';
import { SchemaTree } from '../panels/SchemaTree';

export type { SidebarTabContribution, SidebarTabRenderContext } from '@shenbi/editor-plugin-api';
export type { CreateFilesSidebarTabOptions } from '@shenbi/editor-plugin-files';

export function createBuiltinSidebarTabs(): SidebarTabContribution[] {
  return [
    {
      id: 'components',
      label: i18n.t('workbench.components', { ns: 'editorUi' }),
      order: 10,
      render: ({ commands, environment }) => (
        <ComponentPanel
          {...(environment.contracts ? { contracts: environment.contracts } : {})}
          {...(commands.onInsertComponent ? { onInsert: commands.onInsertComponent } : {})}
          {...(commands.onStartDragComponent ? { onStartDrag: commands.onStartDragComponent } : {})}
          {...(commands.onEndDragComponent ? { onEndDrag: commands.onEndDragComponent } : {})}
        />
      ),
    },
    {
      id: 'outline',
      label: i18n.t('workbench.outline', { ns: 'editorUi' }),
      order: 20,
      render: ({ selection, environment }) => (
        <SchemaTree
          {...(selection.treeNodes ? { nodes: selection.treeNodes } : {})}
          {...(selection.selectedNodeId ? { selectedNodeId: selection.selectedNodeId } : {})}
          {...(selection.onSelectNode ? { onSelect: selection.onSelectNode } : {})}
          {...(environment.contracts ? { contracts: environment.contracts } : {})}
        />
      ),
    },
    {
      id: 'sidebar-data',
      label: i18n.t('workbench.data', { ns: 'editorUi' }),
      order: 30,
      render: () => <PagePanel />,
    },
  ];
}

export function resolveSidebarTabs(
  extensions?: SidebarTabContribution[],
): SidebarTabContribution[] {
  return mergeContributions([], extensions);
}
export { createFilesSidebarTab };
