import React from 'react';
import type { ModelGroup } from '../hooks/useModels';

interface ModelSelectorProps {
    label: string;
    models: ModelGroup[];
    value: string;
    onChange: (val: string) => void;
    disabled?: boolean;
}

export function ModelSelector({ label, models, value, onChange, disabled }: ModelSelectorProps) {
    return (
        <div className="flex flex-col gap-1 w-full flex-1">
            <label className="text-text-secondary tracking-wide uppercase opacity-80" style={{ fontSize: '10px' }}>{label}</label>
            <div className="relative">
                <select
                    aria-label={label}
                    className="w-full h-[26px] bg-bg-canvas border border-border-ide text-text-primary rounded px-2 outline-none transition-colors hover:bg-bg-panel focus:border-primary/50 focus:ring-1 focus:ring-primary/20 disabled:opacity-50 appearance-none pr-5 cursor-pointer"
                    style={{ fontSize: '12px' }}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                >
                    {models.map((group) => (
                        <optgroup key={group.provider} label={group.label}>
                            {group.options.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-text-secondary">
                    <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                </div>
            </div>
        </div>
    );
}
