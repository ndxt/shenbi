import React from 'react';
import {
  mergeContributions,
  type PrimaryPanelContribution,
  type SidebarTabRenderContext,
} from '@shenbi/editor-plugin-api';
import { ComponentPanel } from '../panels/ComponentPanel';
import { PagePanel } from '../panels/PagePanel';
import { SchemaTree } from '../panels/SchemaTree';

export type { PrimaryPanelContribution } from '@shenbi/editor-plugin-api';

function createBuiltinPrimaryPanels(): PrimaryPanelContribution[] {
  return [
    {
      id: 'explorer',
      label: 'Components',
      order: 10,
      render: (context: SidebarTabRenderContext) => (
        <ComponentPanel
          {...(context.contracts ? { contracts: context.contracts } : {})}
          {...(context.onInsertComponent ? { onInsert: context.onInsertComponent } : {})}
        />
      ),
    },
    {
      id: 'search',
      label: 'Outline',
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
      label: 'Data',
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
