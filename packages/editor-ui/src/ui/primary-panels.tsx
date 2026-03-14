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
      render: (context: SidebarTabRenderContext) => (
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
