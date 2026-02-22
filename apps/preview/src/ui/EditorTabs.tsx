import React from 'react';
import { X, FileCode, FileJson } from 'lucide-react';

export function EditorTabs() {
  return (
    <div className="h-9 bg-zinc-950 border-b border-zinc-800 flex items-center shrink-0 overflow-x-auto scrollbar-hide">
      <TabItem label="App.tsx" icon={FileCode} active />
      <TabItem label="demo-schema.ts" icon={FileJson} />
      <TabItem label="AppShell.tsx" icon={FileCode} />
      <TabItem label="preview-ide.css" icon={FileCode} />
    </div>
  );
}

function TabItem({ label, icon: Icon, active = false }: { label: string, icon: any, active?: boolean }) {
  return (
    <div className={`
      h-full px-3 flex items-center gap-2 border-r border-zinc-800 cursor-pointer min-w-[120px] transition-colors
      ${active ? 'bg-zinc-900 text-zinc-100' : 'bg-zinc-950 text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'}
    `}>
      <Icon size={14} className={active ? 'text-blue-400' : 'text-zinc-500'} />
      <span className="text-[13px] truncate flex-1">{label}</span>
      <div className={`p-0.5 rounded-sm hover:bg-zinc-800 ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <X size={12} />
      </div>
      {active && <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500" />}
    </div>
  );
}
