import React from 'react';
import { Send, Square } from 'lucide-react';

export interface PromptOption {
    label: string;
    value: string;
}

interface ChatInputProps {
    onSend: (text: string) => void;
    onCancel: () => void;
    isRunning: boolean;
    disabled?: boolean;
    text: string;
    onTextChange: (text: string) => void;
    promptPresets?: PromptOption[];
    promptHistory?: string[];
    onSelectPreset?: (text: string) => void;
    onSelectHistory?: (text: string) => void;
}

export function ChatInput({
    onSend,
    onCancel,
    isRunning,
    disabled,
    text,
    onTextChange,
    promptPresets = [],
    promptHistory = [],
    onSelectPreset,
    onSelectHistory,
}: ChatInputProps) {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSend = () => {
        if (text.trim() && !isRunning) {
            onSend(text.trim());
        }
    };

    return (
        <div className="flex w-full flex-col gap-2">
            {(promptPresets.length > 0 || promptHistory.length > 0) && (
                <div className="grid grid-cols-2 gap-2">
                    <select
                        aria-label="常用覆盖场景"
                        className="h-8 rounded border border-border-ide bg-bg-panel px-2 text-[11px] text-text-primary outline-none transition-colors focus:border-blue-500 disabled:opacity-50"
                        defaultValue=""
                        disabled={disabled || isRunning || promptPresets.length === 0}
                        onChange={(event) => {
                            const nextValue = event.target.value;
                            if (nextValue) {
                                onSelectPreset?.(nextValue);
                                event.target.value = '';
                            }
                        }}
                    >
                        <option value="">常用覆盖场景</option>
                        {promptPresets.map((option) => (
                            <option key={option.label} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <select
                        aria-label="历史输入"
                        className="h-8 rounded border border-border-ide bg-bg-panel px-2 text-[11px] text-text-primary outline-none transition-colors focus:border-blue-500 disabled:opacity-50"
                        defaultValue=""
                        disabled={disabled || isRunning || promptHistory.length === 0}
                        onChange={(event) => {
                            const nextValue = event.target.value;
                            if (nextValue) {
                                onSelectHistory?.(nextValue);
                                event.target.value = '';
                            }
                        }}
                    >
                        <option value="">历史输入</option>
                        {promptHistory.map((historyItem) => (
                            <option key={historyItem} value={historyItem}>
                                {historyItem}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            <div className="relative flex items-center w-full">
                <textarea
                    className="w-full bg-bg-canvas border border-border-ide text-text-primary text-[12px] rounded-md pl-3 pr-9 py-2 min-h-[40px] max-h-[120px] focus:outline-none focus:border-blue-500 transition-colors shadow-inner resize-none overflow-hidden break-words"
                    placeholder="输入调试提示词，Enter 发送，Shift+Enter 换行"
                    value={text}
                    onChange={(e) => onTextChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled || isRunning}
                    style={{ scrollbarWidth: 'none' }}
                />
                {isRunning ? (
                    <button
                        onClick={onCancel}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-red-500 hover:text-red-400 transition-colors"
                        title="Cancel"
                    >
                        <Square size={14} fill="currentColor" />
                    </button>
                ) : (
                    <button
                        onClick={handleSend}
                        disabled={!text.trim() || disabled}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-blue-500 disabled:opacity-50 disabled:hover:text-text-secondary transition-colors"
                        title="Send"
                    >
                        <Send size={14} />
                    </button>
                )}
            </div>
            {promptHistory.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {promptHistory.slice(0, 5).map((historyItem) => (
                        <button
                            key={historyItem}
                            type="button"
                            className="max-w-full truncate rounded border border-border-ide bg-bg-panel px-2 py-1 text-[10px] text-text-secondary transition-colors hover:border-blue-500 hover:text-text-primary"
                            onClick={() => onSelectHistory?.(historyItem)}
                            disabled={disabled || isRunning}
                            title={historyItem}
                        >
                            {historyItem}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
