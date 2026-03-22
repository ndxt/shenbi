import React, { useEffect, useMemo, useState } from 'react';
import type { ComponentContract, SchemaNode } from '@shenbi/schema';
import type { PluginContext } from '@shenbi/editor-plugin-api';
import {
  resolveInspectorTabs,
  type InspectorTabContribution,
  type InspectorTabRenderContext,
} from './inspector-tabs';
export type { InspectorTabContribution, InspectorTabRenderContext } from './inspector-tabs';

type InspectorTab = string;

export interface InspectorProps {
  selectedNode?: SchemaNode;
  contract?: ComponentContract;
  onPatchProps?: (patch: Record<string, unknown>) => void;
  onPatchColumns?: (columns: unknown[]) => void;
  onPatchStyle?: (patch: Record<string, unknown>) => void;
  onPatchEvents?: (patch: Record<string, unknown>) => void;
  onPatchLogic?: (patch: Record<string, unknown>) => void;
  tabs?: InspectorTabContribution[];
  pluginContext?: PluginContext;
}

export function Inspector({
  selectedNode,
  contract,
  onPatchProps,
  onPatchColumns,
  onPatchStyle,
  onPatchEvents,
  onPatchLogic,
  tabs,
  pluginContext,
}: InspectorProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('props');
  const renderContext = useMemo<InspectorTabRenderContext>(() => ({
    selection: {
      ...(selectedNode ? { selectedNode } : {}),
      ...(contract ? { contract } : {}),
    },
    editing: {
      ...(onPatchProps ? { onPatchProps } : {}),
      ...(onPatchColumns ? { onPatchColumns } : {}),
      ...(onPatchStyle ? { onPatchStyle } : {}),
      ...(onPatchEvents ? { onPatchEvents } : {}),
      ...(onPatchLogic ? { onPatchLogic } : {}),
    },
    environment: {
      ...(pluginContext ? { pluginContext } : {}),
    },
  }), [
    contract,
    onPatchColumns,
    onPatchEvents,
    onPatchLogic,
    onPatchProps,
    onPatchStyle,
    pluginContext,
    selectedNode,
  ]);
  const resolvedTabs = useMemo(() => resolveInspectorTabs(tabs), [tabs]);

  useEffect(() => {
    if (resolvedTabs.length === 0) {
      return;
    }
    const hasActiveTab = resolvedTabs.some((tab) => tab.id === activeTab);
    const fallbackTabId = resolvedTabs[0]?.id;
    if (!hasActiveTab && fallbackTabId) {
      setActiveTab(fallbackTabId);
    }
  }, [activeTab, resolvedTabs]);

  const activeTabDefinition = resolvedTabs.find((tab) => tab.id === activeTab) ?? resolvedTabs[0] ?? undefined;

  return (
    <div className="w-full h-full bg-bg-panel border-l border-border-ide flex flex-col shrink-0 overflow-hidden">
      <div className="h-8 border-b border-border-ide flex shrink-0 bg-bg-activity-bar px-1">
        {resolvedTabs.map((tab) => (
          <TabItem
            key={tab.id}
            label={tab.label}
            isActive={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </div>

      <div className="flex-1 w-full flex flex-col min-h-0 overflow-hidden">
        {activeTabDefinition ? (
          <div className="flex-1 overflow-y-auto w-full">
            {activeTabDefinition.render(renderContext)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TabItem({ label, isActive, onClick }: { label: string, isActive: boolean, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`
      flex-1 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider cursor-pointer border-b-2 transition-colors mx-0.5
      ${isActive ? 'border-blue-500 text-text-primary bg-bg-panel' : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-panel/50'}
    `}>
      {label}
    </div>
  );
}
