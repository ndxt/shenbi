import React from 'react';
import { X, FileCode } from 'lucide-react';

export function EditorTabs({ label }: { label?: string | undefined }) {
  const displayLabel = label || 'Untitled';
  return (
    <div className="h-9 bg-bg-editor border-b border-border-ide flex items-center shrink-0 overflow-x-auto scrollbar-hide">
      <TabItem label={displayLabel} icon={FileCode} active />
    </div>
  );
}

function TabItem({ label, icon: Icon, active = false }: { label: string, icon: any, active?: boolean }) {
  return (
    <div className={`
      h-full px-3 flex items-center gap-2 border-r border-border-ide cursor-pointer min-w-[120px] transition-colors
      ${active ? 'bg-bg-sidebar text-text-primary' : 'bg-bg-editor text-text-secondary hover:bg-bg-sidebar/50 hover:text-text-primary'}
    `}>
      <Icon size={14} className={active ? 'text-blue-400' : 'text-text-secondary'} />
      <span className="text-[13px] truncate flex-1">{label}</span>
      <div className={`p-0.5 rounded-sm hover:bg-bg-activity-bar ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <X size={12} />
      </div>
      {active && <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500" />}
    </div>
  );
}
