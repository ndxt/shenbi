import React, { useState } from 'react';
import { Send, Square } from 'lucide-react';

interface ChatInputProps {
    onSend: (text: string) => void;
    onCancel: () => void;
    isRunning: boolean;
    disabled?: boolean;
}

export function ChatInput({ onSend, onCancel, isRunning, disabled }: ChatInputProps) {
    const [text, setText] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSend = () => {
        if (text.trim() && !isRunning) {
            onSend(text.trim());
            setText('');
        }
    };

    return (
        <div className="relative flex items-center w-full">
            <textarea
                className="w-full bg-bg-canvas border border-border-ide text-text-primary text-[12px] rounded-md pl-3 pr-9 py-2 min-h-[40px] max-h-[120px] focus:outline-none focus:border-blue-500 transition-colors shadow-inner resize-none overflow-hidden break-words"
                placeholder="Ask AI anything... (Enter to send)"
                value={text}
                onChange={(e) => setText(e.target.value)}
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
    );
}
