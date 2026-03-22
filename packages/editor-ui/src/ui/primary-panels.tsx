import React from 'react';
import {
  mergeContributions,
  type PrimaryPanelContribution,
  type SidebarTabRenderContext,
} from '@shenbi/editor-plugin-api';
import { i18n } from '@shenbi/i18n';
import { PagePanel } from '../panels/PagePanel';
import { SchemaTree } from '../panels/SchemaTree';

export type { PrimaryPanelContribution } from '@shenbi/editor-plugin-api';

function createBuiltinPrimaryPanels(): PrimaryPanelContribution[] {
  return [
    {
      id: 'search',
      label: i18n.t('workbench.outline', { ns: 'editorUi' }),
      order: 20,
      render: ({ selection, environment }: SidebarTabRenderContext) => (
        <SchemaTree
          {...(selection.treeNodes ? { nodes: selection.treeNodes } : {})}
          {...(selection.selectedNodeId ? { selectedNodeId: selection.selectedNodeId } : {})}
          {...(selection.onSelectNode ? { onSelect: selection.onSelectNode } : {})}
          {...(environment.contracts ? { contracts: environment.contracts } : {})}
        />
      ),
    },
    {
      id: 'data',
      label: i18n.t('workbench.data', { ns: 'editorUi' }),
      order: 30,
      render: () => <PagePanel />,
    },
  ];
}

export function resolvePrimaryPanels(
  extensions?: PrimaryPanelContribution[],
): PrimaryPanelContribution[] {
  return mergeContributions(createBuiltinPrimaryPanels(), extensions);
}
