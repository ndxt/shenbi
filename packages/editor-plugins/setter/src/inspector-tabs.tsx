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
  const patchService = context.environment.pluginContext
    ? getPluginDocumentPatchService(context.environment.pluginContext)
    : undefined;
  return {
    onPatchProps: patchService?.props ?? context.editing.onPatchProps,
    onPatchColumns: patchService?.columns ?? context.editing.onPatchColumns,
    onPatchStyle: patchService?.style ?? context.editing.onPatchStyle,
    onPatchEvents: patchService?.events ?? context.editing.onPatchEvents,
    onPatchLogic: patchService?.logic ?? context.editing.onPatchLogic,
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
            {...(context.selection.selectedNode ? { selectedNode: context.selection.selectedNode } : {})}
            {...(context.selection.contract ? { contract: context.selection.contract } : {})}
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
            {...(context.selection.selectedNode ? { selectedNode: context.selection.selectedNode } : {})}
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
            {...(context.selection.selectedNode ? { selectedNode: context.selection.selectedNode } : {})}
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
            {...(context.selection.selectedNode ? { selectedNode: context.selection.selectedNode } : {})}
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
