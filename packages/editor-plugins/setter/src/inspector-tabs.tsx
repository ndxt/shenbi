import React from 'react';
import {
  mergeContributions,
  type InspectorTabContribution,
  type InspectorTabRenderContext,
} from '@shenbi/editor-plugin-api';
import { ActionPanel } from './ActionPanel';
import { SetterPanel } from './SetterPanel';

export type BuiltinInspectorTabId = 'props' | 'style' | 'events' | 'logic' | 'actions';
export type { InspectorTabContribution, InspectorTabRenderContext } from '@shenbi/editor-plugin-api';

function createBuiltinInspectorTabs(): InspectorTabContribution[] {
  return [
    {
      id: 'props',
      label: 'Props',
      order: 10,
      render: (context) => (
        <SetterPanel
          activeTab="props"
          {...(context.selectedNode ? { selectedNode: context.selectedNode } : {})}
          {...(context.contract ? { contract: context.contract } : {})}
          {...(context.onPatchProps ? { onPatchProps: context.onPatchProps } : {})}
          {...(context.onPatchColumns ? { onPatchColumns: context.onPatchColumns } : {})}
        />
      ),
    },
    {
      id: 'style',
      label: 'Style',
      order: 20,
      render: (context) => (
        <SetterPanel
          activeTab="style"
          {...(context.selectedNode ? { selectedNode: context.selectedNode } : {})}
          {...(context.onPatchStyle ? { onPatchStyle: context.onPatchStyle } : {})}
        />
      ),
    },
    {
      id: 'events',
      label: 'Events',
      order: 30,
      render: (context) => (
        <SetterPanel
          activeTab="events"
          {...(context.selectedNode ? { selectedNode: context.selectedNode } : {})}
          {...(context.onPatchEvents ? { onPatchEvents: context.onPatchEvents } : {})}
        />
      ),
    },
    {
      id: 'logic',
      label: 'Logic',
      order: 40,
      render: (context) => (
        <SetterPanel
          activeTab="logic"
          {...(context.selectedNode ? { selectedNode: context.selectedNode } : {})}
          {...(context.onPatchLogic ? { onPatchLogic: context.onPatchLogic } : {})}
        />
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      order: 50,
      render: () => <ActionPanel />,
    },
  ];
}

export function resolveInspectorTabs(
  extensions?: InspectorTabContribution[],
): InspectorTabContribution[] {
  return mergeContributions(createBuiltinInspectorTabs(), extensions);
}
