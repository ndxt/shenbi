import React from 'react';
import { ChevronRight, ChevronDown, MoreHorizontal } from 'lucide-react';

export function Sidebar() {
  return (
    <div className="w-64 h-full bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0 overflow-hidden">
      <div className="h-9 px-4 flex items-center justify-between">
        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Explorer</span>
        <MoreHorizontal size={16} className="text-zinc-500 cursor-pointer" />
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="px-2 py-1">
          <div className="flex items-center h-6 hover:bg-zinc-800 cursor-pointer text-zinc-300 text-[13px] px-1 group">
            <ChevronDown size={14} className="mr-1 text-zinc-500" />
            <span className="font-semibold uppercase text-[11px] text-zinc-400">Shenbi Project</span>
          </div>
          
          {/* Mock Tree Items */}
          <div className="ml-2">
            <TreeItem label="src" isFolder isOpen />
            <div className="ml-4">
              <TreeItem label="App.tsx" />
              <TreeItem label="main.tsx" />
              <TreeItem label="styles" isFolder />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TreeItem({ label, isFolder = false, isOpen = false }: { label: string, isFolder?: boolean, isOpen?: boolean }) {
  return (
    <div className="flex items-center h-[22px] px-2 hover:bg-zinc-800/50 cursor-pointer text-zinc-300 text-[13px] group whitespace-nowrap overflow-hidden">
      {isFolder ? (
        isOpen ? <ChevronDown size={14} className="mr-1 text-zinc-500" /> : <ChevronRight size={14} className="mr-1 text-zinc-500" />
      ) : (
        <div className="w-[18px]" />
      )}
      <span className="truncate">{label}</span>
    </div>
  );
}
