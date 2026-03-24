import React from 'react';

export function Console() {
  return (
    <div className="w-full h-full bg-bg-panel border-t border-border-ide flex flex-col shrink-0">
      <div className="h-9 px-4 border-b border-border-ide flex items-center shrink-0">
        <div className="flex gap-4 h-full">
          <ConsoleTab label="Problems" count={0} active />
          <ConsoleTab label="Output" />
          <ConsoleTab label="Debug Console" />
          <ConsoleTab label="Terminal" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 font-mono text-[12px] text-text-secondary">
        <div className="flex gap-2">
          <span className="text-text-secondary">[21:05:22]</span>
          <span className="text-primary">INFO</span>
          <span>Shenbi Preview Engine started successfully.</span>
        </div>
        <div className="flex gap-2">
          <span className="text-text-secondary">[21:05:23]</span>
          <span className="text-emerald-400">SUCCESS</span>
          <span>Page 'demo_page' loaded.</span>
        </div>
      </div>
    </div>
  );
}

function ConsoleTab({ label, count, active = false }: { label: string, count?: number, active?: boolean }) {
  return (
    <div className={`
      h-full flex items-center px-1 text-[11px] font-medium cursor-pointer border-b-2 transition-colors
      ${active ? 'border-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}
    `}>
      {label}
      {count !== undefined && (
        <span className="ml-1 bg-bg-activity-bar px-1 rounded-full text-[10px] min-w-[14px] text-center border border-border-ide">
          {count}
        </span>
      )}
    </div>
  );
}
