import React, { useState } from 'react';
import { Database, Plus, ChevronDown, ChevronRight, Activity, Terminal, Code } from 'lucide-react';
import { useTranslation } from '@shenbi/i18n';

export function PagePanel() {
  const { t } = useTranslation('editorUi');
  return (
    <div className="flex flex-col h-full bg-bg-sidebar text-text-primary overflow-y-auto">
      <div className="p-2 border-b border-border-ide/50 flex items-center justify-between sticky top-0 bg-bg-panel z-10 shrink-0">
        <span className="text-[11px] font-semibold text-text-secondary uppercase opacity-80 pl-1">{t('pagePanel.title')}</span>
      </div>

      <div className="p-2 flex flex-col gap-3">
        <DataGroup title={t('pagePanel.params')} icon={<Database size={14} strokeWidth={1.5} className="text-primary" />}>
          <DataItem name="id" type="string" value="123" />
          <DataItem name="mode" type="string" value="edit" />
        </DataGroup>

        <DataGroup title={t('pagePanel.stateData')} icon={<Activity size={14} strokeWidth={1.5} className="text-green-500" />}>
          <DataItem name="userList" type="array" value="[...]" />
          <DataItem name="isLoading" type="boolean" value="false" />
          <DataItem name="searchQuery" type="string" value="''" />
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-text-secondary/80 border border-dashed border-border-ide/50 p-1.5 rounded-md cursor-pointer hover:bg-text-primary/5 transition-colors">
            <Plus size={13} strokeWidth={1.5} />
            <span>{t('pagePanel.addState')}</span>
          </div>
        </DataGroup>

        <DataGroup title={t('pagePanel.methods')} icon={<Terminal size={14} strokeWidth={1.5} className="text-yellow-500" />}>
          <DataItem name="fetchUsers" type="async function" value="(params) => Promise" isFunction />
          <DataItem name="formatDate" type="function" value="(date) => string" isFunction />
        </DataGroup>

        <DataGroup title={t('pagePanel.contextData')} icon={<Code size={14} strokeWidth={1.5} className="text-purple-500" />}>
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
    <div className="border border-border-ide/40 rounded-md bg-text-primary/[0.01] overflow-hidden">
      <div 
        className="flex items-center justify-between px-2.5 py-2 bg-text-primary/[0.03] border-b border-border-ide/40 cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown size={14} strokeWidth={1.5} className="text-text-secondary" /> : <ChevronRight size={14} strokeWidth={1.5} className="text-text-secondary" />}
          {icon}
          <span className="text-[11px] font-semibold text-text-primary/90">{title}</span>
        </div>
        <Plus size={14} strokeWidth={1.5} className="text-text-secondary/70 hover:text-text-primary transition-colors" onClick={(e) => { e.stopPropagation(); /* Add action */ }} />
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
    <div className="flex flex-col group py-1.5 px-2 rounded-md hover:bg-text-primary/5 cursor-pointer transition-colors border border-transparent hover:border-border-ide/30">
      <div className="flex justify-between items-center mb-1.5">
        <span className={`text-[12px] font-mono font-medium ${isFunction ? 'text-yellow-600 dark:text-yellow-400' : 'text-primary'}`}>{name}</span>
        <span className="text-[10px] text-text-secondary/80">{type}</span>
      </div>
      <div className="text-[11px] font-mono text-text-secondary/90 bg-text-primary/[0.02] px-2 py-1 rounded-sm border border-border-ide/30 truncate">
        {value}
      </div>
    </div>
  );
}
