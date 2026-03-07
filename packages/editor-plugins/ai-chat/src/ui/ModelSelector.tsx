import React from 'react';

interface ModelSelectorProps {
    label: string;
    models: string[];
    value: string;
    onChange: (val: string) => void;
    disabled?: boolean;
}

export function ModelSelector({ label, models, value, onChange, disabled }: ModelSelectorProps) {
    return (
        <div className="flex flex-col gap-1 w-full flex-1">
            <label className="text-[10px] text-text-secondary uppercase tracking-wider">{label}</label>
            <select
                className="w-full h-7 bg-bg-canvas border border-border-ide text-[11px] text-text-primary rounded px-2 outline-none focus:border-blue-500 disabled:opacity-50"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
            >
                {models.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
        </div>
    );
}
