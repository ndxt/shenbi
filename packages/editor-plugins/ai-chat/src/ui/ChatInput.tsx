import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, Lightbulb, History, X } from 'lucide-react';

export interface PromptOption {
    label: string;
    value: string;
}

interface DropdownItem {
    label: string;
    value: string;
    title?: string | undefined;
    onRemove?: ((value: string) => void) | undefined;
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
    onRemoveHistory?: (text: string) => void;
}

// 简单的自定义 Popover/Menu 组件 — 使用 fixed 定位逃逸 overflow-hidden 祖先
function DropdownMenu({
    icon: Icon,
    label,
    items,
    onSelect,
    disabled
}: {
    icon: React.ElementType;
    label: string;
    items: DropdownItem[];
    onSelect: (val: string) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

    // 点击外部关闭
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
            setOpen(false);
        };
        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    // 计算 fixed 定位 - 在点击时同步计算，避免首帧位置错误
    const calcAndToggle = () => {
        if (disabled) return;
        if (open) {
            setOpen(false);
            return;
        }
        if (btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setMenuStyle({
                position: 'fixed',
                left: rect.left,
                bottom: window.innerHeight - rect.top + 4,
                zIndex: 9999,
            });
        }
        setOpen(true);
    };

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${open ? 'bg-bg-activity-bar text-text-primary' : 'text-text-secondary hover:bg-bg-activity-bar hover:text-text-primary'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{ fontSize: '11px' }}
                onClick={calcAndToggle}
                title={label}
                disabled={disabled}
            >
                <Icon size={12} />
                <span>{label}</span>
            </button>
            {open && (
                <div
                    ref={menuRef}
                    className="w-[420px] max-w-[calc(100vw-32px)] max-h-[400px] overflow-y-auto bg-bg-panel border border-border-ide rounded-md shadow-[0_4px_16px_rgba(0,0,0,0.5)] py-1"
                    style={menuStyle}
                >
                    {items.length === 0 ? (
                        <div className="px-3 py-2 text-text-secondary text-center" style={{ fontSize: '12px' }}>空</div>
                    ) : (
                        items.map((item, idx) => (
                            <div
                                key={idx}
                                className="flex items-center justify-between border-b border-border-ide last:border-b-0 px-3 py-2"
                                style={{ fontSize: '12px' }}
                            >
                                <button
                                    type="button"
                                    className="text-left text-text-primary whitespace-normal break-words leading-relaxed flex-1 pr-2"
                                    style={{ transition: 'background-color 0.15s ease' }}
                                    title={item.title || item.value}
                                    onClick={() => {
                                        onSelect(item.value);
                                        setOpen(false);
                                    }}
                                >
                                    {item.label}
                                </button>
                                {item.onRemove && (
                                    <button
                                        type="button"
                                        className="ml-2 text-text-secondary hover:text-text-primary"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            item.onRemove?.(item.value);
                                        }}
                                        title="删除"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </>
    );
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
    onRemoveHistory,
}: ChatInputProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize logic
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        // Reset height to recalculate
        textarea.style.height = 'auto';
        
        // Calculate new height, bounded by CSS min/max-height, using scrollHeight
        const paddingOffset = 10; // extra padding allowance for pb-8 vs py-2
        textarea.style.height = `${Math.min(textarea.scrollHeight + paddingOffset, 250)}px`;
    }, [text]);

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
        // focus input after typing/sending finishes ideally handled by the wrapper
    };

    const handleSelectPreset = (val: string) => {
        onSelectPreset?.(val);
        setTimeout(() => textareaRef.current?.focus(), 0);
    };

    const handleSelectHistory = (val: string) => {
        onSelectHistory?.(val);
        setTimeout(() => textareaRef.current?.focus(), 0);
    };

    return (
        <div className="flex w-full flex-col gap-1.5">
            <div className="flex items-center gap-2 mb-0.5">
                {(promptPresets.length > 0) && (
                    <DropdownMenu
                        icon={Lightbulb}
                        label="常用覆盖场景"
                        items={promptPresets}
                        onSelect={handleSelectPreset}
                        disabled={disabled || isRunning}
                    />
                )}
                {(promptHistory.length > 0) && (
                    <DropdownMenu
                        icon={History}
                        label="历史输入"
                        items={promptHistory.map((h) => ({
                            label: h,
                            value: h,
                            onRemove: onRemoveHistory,
                        }))}
                        onSelect={handleSelectHistory}
                        disabled={disabled || isRunning}
                    />
                )}
            </div>

            <div className="relative flex items-stretch w-full">
                <textarea
                    ref={textareaRef}
                    className="shenbi-custom-scrollbar w-full bg-bg-activity-bar border border-border-ide text-text-primary rounded pl-3 pr-3 pt-2 pb-8 min-h-[60px] max-h-[250px] focus:outline-none focus:border-blue-500 transition-colors shadow-sm resize-none leading-relaxed"
                    style={{ fontSize: '12px' }}
                    placeholder="输入调试提示词，Enter 发送，Shift+Enter 换行"
                    value={text}
                    onChange={(e) => onTextChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled || isRunning}
                />
                <div className="absolute right-1.5 bottom-1.5 flex items-center justify-center bg-bg-activity-bar rounded">
                    {isRunning ? (
                        <button
                            onClick={onCancel}
                            className="p-1 text-text-primary hover:bg-bg-panel rounded transition-colors border border-border-ide bg-bg-canvas"
                            title="Cancel"
                        >
                            <Square size={13} fill="currentColor" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSend}
                            disabled={!text.trim() || disabled}
                            className="p-1 text-white bg-blue-600 hover:bg-blue-500 disabled:bg-bg-canvas disabled:text-text-secondary disabled:border disabled:border-border-ide rounded transition-colors shadow-sm flex items-center justify-center h-[26px] w-[26px]"
                            title="Send"
                        >
                            <Send size={13} className="-ml-0.5 mt-0.5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
