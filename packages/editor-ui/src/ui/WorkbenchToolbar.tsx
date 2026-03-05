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

interface WorkbenchToolbarProps {
  extra?: React.ReactNode;
}

export function WorkbenchToolbar({ extra }: WorkbenchToolbarProps) {
  return (
    <div className="h-9 bg-bg-sidebar border-b border-border-ide flex items-center justify-between px-2 shrink-0">
      <div className="flex items-center gap-2">
        <ToolbarButton icon={MousePointer2} active />
        <ToolbarButton icon={Hand} />
        <div className="w-[1px] h-4 bg-border-ide mx-1" />
        <ToolbarButton icon={Monitor} />
        <ToolbarButton icon={Tablet} />
        <ToolbarButton icon={Smartphone} />
      </div>

      <div className="flex items-center text-[11px] text-text-secondary gap-1 overflow-hidden max-w-[40%]">
        <span>Page</span>
        <ChevronRight size={12} />
        <span>Container</span>
        <ChevronRight size={12} />
        <span className="text-text-primary">Card</span>
      </div>

      <div className="flex items-center gap-2">
        {extra ? <div>{extra}</div> : null}
        <button className="flex items-center gap-1.5 px-2 py-1 hover:bg-bg-activity-bar rounded text-emerald-500 transition-colors">
          <Play size={14} fill="currentColor" />
          <span className="text-[12px] font-medium text-text-primary">Run</span>
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
      ${active ? 'bg-bg-activity-bar text-blue-500' : 'text-text-secondary hover:bg-bg-activity-bar hover:text-text-primary'}
    `}>
      <Icon size={16} />
    </div>
  );
}
