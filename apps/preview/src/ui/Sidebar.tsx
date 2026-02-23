import React, { useState } from 'react';
import { ComponentPanel } from '../panels/ComponentPanel';
import { SchemaTree } from '../panels/SchemaTree';
import { PagePanel } from '../panels/PagePanel';

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<'components' | 'outline' | 'data'>('components');

  return (
    <div className="w-full h-full bg-bg-sidebar border-r border-border-ide flex flex-col shrink-0 overflow-hidden">
      <div className="h-9 flex items-center border-b border-border-ide shrink-0 bg-bg-panel px-1">
        <TabItem 
          label="Components" 
          active={activeTab === 'components'} 
          onClick={() => setActiveTab('components')} 
        />
        <TabItem 
          label="Outline" 
          active={activeTab === 'outline'} 
          onClick={() => setActiveTab('outline')} 
        />
        <TabItem 
          label="Data" 
          active={activeTab === 'data'} 
          onClick={() => setActiveTab('data')} 
        />
      </div>
      
      <div className="flex-1 overflow-hidden">
        <div style={{ display: activeTab === 'components' ? 'block' : 'none', height: '100%' }}>
          <ComponentPanel />
        </div>
        <div style={{ display: activeTab === 'outline' ? 'block' : 'none', height: '100%' }}>
          <SchemaTree />
        </div>
        <div style={{ display: activeTab === 'data' ? 'block' : 'none', height: '100%' }}>
          <PagePanel />
        </div>
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
