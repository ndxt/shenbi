import React from 'react';
import {
  getPluginDocumentPatchService,
  mergeContributions,
  type InspectorTabContribution,
  type InspectorTabRenderContext,
} from '@shenbi/editor-plugin-api';
import { ActionPanel } from './ActionPanel';
import { SetterPanel } from './SetterPanel';

export type BuiltinInspectorTabId = 'props' | 'style' | 'events' | 'logic' | 'actions';
export type { InspectorTabContribution, InspectorTabRenderContext } from '@shenbi/editor-plugin-api';

function getPatchHandlers(context: InspectorTabRenderContext) {
  const patchService = context.pluginContext
    ? getPluginDocumentPatchService(context.pluginContext)
    : undefined;
  return {
    onPatchProps: patchService?.props ?? context.onPatchProps,
    onPatchColumns: patchService?.columns ?? context.onPatchColumns,
    onPatchStyle: patchService?.style ?? context.onPatchStyle,
    onPatchEvents: patchService?.events ?? context.onPatchEvents,
    onPatchLogic: patchService?.logic ?? context.onPatchLogic,
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
