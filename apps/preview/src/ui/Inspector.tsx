import React, { useState } from 'react';
import { SetterPanel } from '../panels/SetterPanel';
import { ActionPanel } from '../panels/ActionPanel';
import type { ComponentContract, SchemaNode } from '@shenbi/schema';

type InspectorTab = 'props' | 'style' | 'events' | 'logic' | 'actions';

export interface InspectorProps {
  selectedNode?: SchemaNode;
  contract?: ComponentContract;
  onPatchProps?: (patch: Record<string, unknown>) => void;
  onPatchStyle?: (patch: Record<string, unknown>) => void;
  onPatchEvents?: (patch: Record<string, unknown>) => void;
}

export function Inspector({
  selectedNode,
  contract,
  onPatchProps,
  onPatchStyle,
  onPatchEvents,
}: InspectorProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('props');

  return (
    <div className="w-full h-full bg-bg-panel border-l border-border-ide flex flex-col shrink-0 overflow-hidden">
      <div className="h-8 border-b border-border-ide flex shrink-0 bg-bg-activity-bar px-1">
        <TabItem label="Props" isActive={activeTab === 'props'} onClick={() => setActiveTab('props')} />
        <TabItem label="Style" isActive={activeTab === 'style'} onClick={() => setActiveTab('style')} />
        <TabItem label="Events" isActive={activeTab === 'events'} onClick={() => setActiveTab('events')} />
        <TabItem label="Logic" isActive={activeTab === 'logic'} onClick={() => setActiveTab('logic')} />
        <TabItem label="Actions" isActive={activeTab === 'actions'} onClick={() => setActiveTab('actions')} />
      </div>

      <div className="flex-1 w-full flex flex-col min-h-0 overflow-hidden">
        {activeTab === 'actions' ? (
          <ActionPanel />
        ) : (
          <div className="flex-1 overflow-y-auto w-full">
            <SetterPanel
              activeTab={activeTab}
              {...(selectedNode ? { selectedNode } : {})}
              {...(contract ? { contract } : {})}
              {...(onPatchProps ? { onPatchProps } : {})}
              {...(onPatchStyle ? { onPatchStyle } : {})}
              {...(onPatchEvents ? { onPatchEvents } : {})}
            />
          </div>
        )}
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
