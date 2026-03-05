import React, { useEffect, useMemo, useState } from 'react';
import { type SchemaNode as TreeSchemaNode } from '../panels/SchemaTree';
import type { ComponentContract } from '@shenbi/schema';
import {
  resolveSidebarTabs,
  type SidebarTabContribution,
  type SidebarTabRenderContext,
} from './sidebar-tabs';
export type { SidebarTabContribution, SidebarTabRenderContext } from './sidebar-tabs';

export interface SidebarProps {
  contracts?: ComponentContract[];
  treeNodes?: TreeSchemaNode[];
  selectedNodeId?: string;
  onSelectNode?: (nodeId: string) => void;
  onInsertComponent?: (componentType: string) => void;
  tabs?: SidebarTabContribution[];
}

export function Sidebar({
  contracts,
  treeNodes,
  selectedNodeId,
  onSelectNode,
  onInsertComponent,
  tabs,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<string>('components');
  const renderContext = useMemo<SidebarTabRenderContext>(() => ({
    ...(contracts ? { contracts } : {}),
    ...(treeNodes ? { treeNodes } : {}),
    ...(selectedNodeId ? { selectedNodeId } : {}),
    ...(onSelectNode ? { onSelectNode } : {}),
    ...(onInsertComponent ? { onInsertComponent } : {}),
  }), [contracts, onInsertComponent, onSelectNode, selectedNodeId, treeNodes]);
  const resolvedTabs = useMemo(() => resolveSidebarTabs(tabs), [tabs]);

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
    <div className="w-full h-full bg-bg-sidebar border-r border-border-ide flex flex-col shrink-0 overflow-hidden">
      <div className="h-9 flex items-center border-b border-border-ide shrink-0 bg-bg-panel px-1">
        {resolvedTabs.map((tab) => (
          <TabItem
            key={tab.id}
            label={tab.label}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </div>
      
      <div className="flex-1 overflow-hidden">
        {activeTabDefinition ? (
          <div style={{ height: '100%' }}>
            {activeTabDefinition.render(renderContext)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TabItem({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`
        flex-1 h-full flex items-center justify-center text-[10px] font-bold uppercase tracking-wider cursor-pointer border-b-2 transition-colors mx-0.5
        ${active ? 'border-blue-500 text-text-primary bg-bg-sidebar' : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-activity-bar'}
      `}
    >
      {label}
    </div>
  );
}
