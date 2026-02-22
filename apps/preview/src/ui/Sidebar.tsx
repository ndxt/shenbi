import React from 'react';
import { ChevronRight, ChevronDown, MoreHorizontal } from 'lucide-react';

export function Sidebar() {
  return (
    <div className="w-full h-full bg-bg-sidebar border-r border-border-ide flex flex-col shrink-0 overflow-hidden">
      <div className="h-9 px-4 flex items-center justify-between border-b border-border-ide">
        <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Explorer</span>
        <MoreHorizontal size={16} className="text-text-secondary cursor-pointer" />
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="px-2 py-1">
          <div className="flex items-center h-6 hover:bg-bg-activity-bar cursor-pointer text-text-primary text-[13px] px-1 group">
            <ChevronDown size={14} className="mr-1 text-text-secondary" />
            <span className="font-semibold uppercase text-[11px] text-text-secondary">Shenbi Project</span>
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
    <div className="flex items-center h-[22px] px-2 hover:bg-bg-activity-bar/50 cursor-pointer text-text-primary text-[13px] group whitespace-nowrap overflow-hidden">
      {isFolder ? (
        isOpen ? <ChevronDown size={14} className="mr-1 text-text-secondary" /> : <ChevronRight size={14} className="mr-1 text-text-secondary" />
      ) : (
        <div className="w-[18px]" />
      )}
      <span className="truncate">{label}</span>
    </div>
  );
}
