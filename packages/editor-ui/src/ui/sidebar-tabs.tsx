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
      render: (context) => (
        <ComponentPanel
          {...(context.contracts ? { contracts: context.contracts } : {})}
          {...(context.onInsertComponent ? { onInsert: context.onInsertComponent } : {})}
        />
      ),
    },
    {
      id: 'outline',
      label: i18n.t('workbench.outline', { ns: 'editorUi' }),
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
