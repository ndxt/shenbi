import React, { useState } from 'react';
import { Database, Plus, ChevronDown, ChevronRight, Activity, Terminal, Code } from 'lucide-react';

export function PagePanel() {
  return (
    <div className="flex flex-col h-full bg-bg-sidebar text-text-primary overflow-y-auto">
      <div className="p-2 border-b border-border-ide flex items-center justify-between sticky top-0 bg-bg-panel z-10 shrink-0">
        <span className="text-[11px] font-bold text-text-secondary uppercase">页面状态 (Page Data)</span>
      </div>
      
      <div className="p-2 flex flex-col gap-3">
        <DataGroup title="页面参数 (Params)" icon={<Database size={14} className="text-blue-500" />}>
          <DataItem name="id" type="string" value="123" />
          <DataItem name="mode" type="string" value="edit" />
        </DataGroup>
        
        <DataGroup title="状态数据 (State / Computed)" icon={<Activity size={14} className="text-green-500" />}>
          <DataItem name="userList" type="array" value="[...]" />
          <DataItem name="isLoading" type="boolean" value="false" />
          <DataItem name="searchQuery" type="string" value="''" />
          <div className="mt-1 flex items-center gap-1 text-[11px] text-text-secondary border border-dashed border-border-ide p-1.5 rounded cursor-pointer hover:bg-bg-activity-bar transition-colors">
            <Plus size={12} />
            <span>新增 State 参数</span>
          </div>
        </DataGroup>

        <DataGroup title="方法 (Methods)" icon={<Terminal size={14} className="text-yellow-500" />}>
          <DataItem name="fetchUsers" type="async function" value="(params) => Promise" isFunction />
          <DataItem name="formatDate" type="function" value="(date) => string" isFunction />
        </DataGroup>

        <DataGroup title="上下文数据 (Context)" icon={<Code size={14} className="text-purple-500" />}>
          <DataItem name="theme" type="object" value="{ color: 'dark' }" />
          <DataItem name="currentUser" type="object" value="{ name: 'admin' }" />
        </DataGroup>
      </div>
    </div>
  );
}

function DataGroup({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  
  return (
    <div className="border border-border-ide rounded bg-bg-canvas overflow-hidden">
      <div 
        className="flex items-center justify-between px-2 py-1.5 bg-bg-activity-bar border-b border-border-ide cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown size={14} className="text-text-secondary" /> : <ChevronRight size={14} className="text-text-secondary" />}
          {icon}
          <span className="text-[11px] font-bold text-text-primary">{title}</span>
        </div>
        <Plus size={14} className="text-text-secondary hover:text-text-primary transition-colors" onClick={(e) => { e.stopPropagation(); /* Add action */ }} />
      </div>
      
      {isOpen && (
        <div className="p-2 flex flex-col gap-1.5">
          {children}
        </div>
      )}
    </div>
  );
}

function DataItem({ name, type, value, isFunction = false }: { name: string, type: string, value: string, isFunction?: boolean }) {
  return (
    <div className="flex flex-col group p-1.5 rounded hover:bg-bg-activity-bar cursor-pointer transition-colors border border-transparent hover:border-border-ide">
      <div className="flex justify-between items-center mb-1">
        <span className={`text-[12px] font-mono ${isFunction ? 'text-yellow-400' : 'text-blue-400'}`}>{name}</span>
        <span className="text-[10px] text-text-secondary">{type}</span>
      </div>
      <div className="text-[11px] font-mono text-text-secondary bg-bg-panel px-1.5 py-0.5 rounded border border-border-ide truncate">
        {value}
      </div>
    </div>
  );
}
