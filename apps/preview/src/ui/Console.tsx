import React from 'react';

export function Console() {
  return (
    <div className="h-48 bg-zinc-950 border-t border-zinc-800 flex flex-col shrink-0">
      <div className="h-9 px-4 border-b border-zinc-800 flex items-center shrink-0">
        <div className="flex gap-4 h-full">
          <ConsoleTab label="Problems" count={0} active />
          <ConsoleTab label="Output" />
          <ConsoleTab label="Debug Console" />
          <ConsoleTab label="Terminal" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 font-mono text-[12px] text-zinc-400">
        <div className="flex gap-2">
          <span className="text-zinc-500">[21:05:22]</span>
          <span className="text-blue-400">INFO</span>
          <span>Shenbi Preview Engine started successfully.</span>
        </div>
        <div className="flex gap-2">
          <span className="text-zinc-500">[21:05:23]</span>
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
      ${active ? 'border-zinc-300 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'}
    `}>
      {label}
      {count !== undefined && (
        <span className="ml-1 bg-zinc-800 px-1 rounded-full text-[10px] min-w-[14px] text-center">
          {count}
        </span>
      )}
    </div>
  );
}
