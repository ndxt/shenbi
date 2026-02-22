import React from 'react';

export function Inspector() {
  return (
    <div className="w-64 h-full bg-zinc-900 border-l border-zinc-800 flex flex-col shrink-0 overflow-hidden">
      <div className="h-9 px-4 border-b border-zinc-800 flex items-center shrink-0">
        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Inspector</span>
      </div>
      
      <div className="h-8 border-b border-zinc-800 flex shrink-0">
        <TabItem label="Properties" active />
        <TabItem label="Style" />
        <TabItem label="Events" />
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
        <div>
          <h3 className="text-[11px] font-bold text-zinc-500 uppercase mb-2">Selected Component</h3>
          <div className="bg-zinc-950/50 rounded border border-zinc-800 p-2 text-[13px] text-zinc-300">
            Card <span className="text-zinc-500 ml-1">#main_card</span>
          </div>
        </div>

        <div>
          <PropertyField label="Width" value="100%" />
          <PropertyField label="Padding" value="24px" />
          <PropertyField label="Background" value="#18181b" isColor />
        </div>
      </div>
    </div>
  );
}

function TabItem({ label, active = false }: { label: string, active?: boolean }) {
  return (
    <div className={`
      flex-1 flex items-center justify-center text-[11px] font-medium cursor-pointer border-b-2 transition-colors
      ${active ? 'border-blue-500 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'}
    `}>
      {label}
    </div>
  );
}

function PropertyField({ label, value, isColor = false }: { label: string, value: string, isColor?: boolean }) {
  return (
    <div className="mb-3">
      <label className="text-[10px] text-zinc-500 uppercase block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        {isColor && <div className="w-4 h-4 rounded-sm border border-zinc-700" style={{ backgroundColor: value }} />}
        <input 
          readOnly 
          value={value} 
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[12px] text-zinc-300 focus:outline-none focus:border-blue-500" 
        />
      </div>
    </div>
  );
}
