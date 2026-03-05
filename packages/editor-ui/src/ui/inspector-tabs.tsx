import React from 'react';
import type { ComponentContract, SchemaNode } from '@shenbi/schema';
import { ActionPanel } from '../panels/ActionPanel';
import { SetterPanel } from '../panels/SetterPanel';

export type BuiltinInspectorTabId = 'props' | 'style' | 'events' | 'logic' | 'actions';

export interface InspectorTabRenderContext {
  selectedNode?: SchemaNode;
  contract?: ComponentContract;
  onPatchProps?: (patch: Record<string, unknown>) => void;
  onPatchColumns?: (columns: unknown[]) => void;
  onPatchStyle?: (patch: Record<string, unknown>) => void;
  onPatchEvents?: (patch: Record<string, unknown>) => void;
  onPatchLogic?: (patch: Record<string, unknown>) => void;
}

export interface InspectorTabContribution {
  id: string;
  label: string;
  order?: number;
  render: (context: InspectorTabRenderContext) => React.ReactNode;
}

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
  const merged = new Map<string, InspectorTabContribution>();
  for (const tab of createBuiltinInspectorTabs()) {
    merged.set(tab.id, tab);
  }
  for (const tab of extensions ?? []) {
    merged.set(tab.id, tab);
  }
  return [...merged.values()].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
}
