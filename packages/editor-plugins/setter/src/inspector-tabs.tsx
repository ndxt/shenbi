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

function getPatchHandlers(context: InspectorTabRenderContext) {
  return {
    onPatchProps: context.pluginContext?.document?.patchSelectedNode?.props ?? context.onPatchProps,
    onPatchColumns: context.pluginContext?.document?.patchSelectedNode?.columns ?? context.onPatchColumns,
    onPatchStyle: context.pluginContext?.document?.patchSelectedNode?.style ?? context.onPatchStyle,
    onPatchEvents: context.pluginContext?.document?.patchSelectedNode?.events ?? context.onPatchEvents,
    onPatchLogic: context.pluginContext?.document?.patchSelectedNode?.logic ?? context.onPatchLogic,
  };
}

export function createBuiltinInspectorTabs(): InspectorTabContribution[] {
  return [
    {
      id: 'props',
      label: 'Props',
      order: 10,
      render: (context) => {
        const handlers = getPatchHandlers(context);
        return (
          <SetterPanel
            activeTab="props"
            {...(context.selectedNode ? { selectedNode: context.selectedNode } : {})}
            {...(context.contract ? { contract: context.contract } : {})}
            {...(handlers.onPatchProps ? { onPatchProps: handlers.onPatchProps } : {})}
            {...(handlers.onPatchColumns ? { onPatchColumns: handlers.onPatchColumns } : {})}
          />
        );
      },
    },
    {
      id: 'style',
      label: 'Style',
      order: 20,
      render: (context) => {
        const handlers = getPatchHandlers(context);
        return (
          <SetterPanel
            activeTab="style"
            {...(context.selectedNode ? { selectedNode: context.selectedNode } : {})}
            {...(handlers.onPatchStyle ? { onPatchStyle: handlers.onPatchStyle } : {})}
          />
        );
      },
    },
    {
      id: 'events',
      label: 'Events',
      order: 30,
      render: (context) => {
        const handlers = getPatchHandlers(context);
        return (
          <SetterPanel
            activeTab="events"
            {...(context.selectedNode ? { selectedNode: context.selectedNode } : {})}
            {...(handlers.onPatchEvents ? { onPatchEvents: handlers.onPatchEvents } : {})}
          />
        );
      },
    },
    {
      id: 'logic',
      label: 'Logic',
      order: 40,
      render: (context) => {
        const handlers = getPatchHandlers(context);
        return (
          <SetterPanel
            activeTab="logic"
            {...(context.selectedNode ? { selectedNode: context.selectedNode } : {})}
            {...(handlers.onPatchLogic ? { onPatchLogic: handlers.onPatchLogic } : {})}
          />
        );
      },
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
