import React from 'react';
import { 
  MousePointer2, 
  Hand, 
  Monitor, 
  Tablet, 
  Smartphone, 
  Play, 
  Code2, 
  ChevronRight,
  Share2
} from 'lucide-react';

export function WorkbenchToolbar() {
  return (
    <div className="h-9 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-2 shrink-0">
      <div className="flex items-center gap-2">
        <ToolbarButton icon={MousePointer2} active />
        <ToolbarButton icon={Hand} />
        <div className="w-[1px] h-4 bg-zinc-800 mx-1" />
        <ToolbarButton icon={Monitor} />
        <ToolbarButton icon={Tablet} />
        <ToolbarButton icon={Smartphone} />
      </div>

      <div className="flex items-center text-[11px] text-zinc-500 gap-1 overflow-hidden max-w-[40%]">
        <span>Page</span>
        <ChevronRight size={12} />
        <span>Container</span>
        <ChevronRight size={12} />
        <span className="text-zinc-300">Card</span>
      </div>

      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 px-2 py-1 hover:bg-zinc-800 rounded text-emerald-500 transition-colors">
          <Play size={14} fill="currentColor" />
          <span className="text-[12px] font-medium">Run</span>
        </button>
        <ToolbarButton icon={Code2} />
        <ToolbarButton icon={Share2} />
      </div>
    </div>
  );
}

function ToolbarButton({ icon: Icon, active = false }: { icon: any, active?: boolean }) {
  return (
    <div className={`
      p-1.5 rounded cursor-pointer transition-colors
      ${active ? 'bg-zinc-800 text-blue-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}
    `}>
      <Icon size={16} />
    </div>
  );
}
