import React from 'react';

export function Inspector() {
  return (
    <div className="w-full h-full bg-bg-panel border-l border-border-ide flex flex-col shrink-0 overflow-hidden">
      <div className="h-9 px-4 border-b border-border-ide flex items-center shrink-0">
        <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Inspector</span>
      </div>
      
      <div className="h-8 border-b border-border-ide flex shrink-0">
        <TabItem label="Properties" active />
        <TabItem label="Style" />
        <TabItem label="Events" />
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4 text-text-primary">
        <div>
          <h3 className="text-[11px] font-bold text-text-secondary uppercase mb-2">Selected Component</h3>
          <div className="bg-bg-canvas rounded border border-border-ide p-2 text-[13px]">
            Card <span className="text-text-secondary ml-1">#main_card</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
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
      ${active ? 'border-blue-500 text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}
    `}>
      {label}
    </div>
  );
}

function PropertyField({ label, value, isColor = false }: { label: string, value: string, isColor?: boolean }) {
  return (
    <div className="mb-0">
      <label className="text-[10px] text-text-secondary uppercase block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        {isColor && <div className="w-4 h-4 rounded-sm border border-border-ide" style={{ backgroundColor: value }} />}
        <input 
          readOnly 
          value={value} 
          className="flex-1 bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[12px] text-text-primary focus:outline-none focus:border-blue-500" 
        />
      </div>
    </div>
  );
}
