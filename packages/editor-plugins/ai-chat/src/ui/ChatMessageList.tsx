import React from 'react';
import type { ChatMessage } from '../hooks/useChatSession';
import { User, Sparkles } from 'lucide-react';
import { useTranslation } from '@shenbi/i18n';
import { RunResultCard } from './RunResultCard';

interface ChatMessageListProps {
    messages: ChatMessage[];
    onDismissRunResult?: ((messageId: string) => void) | undefined;
}

export function ChatMessageList({ messages, onDismissRunResult }: ChatMessageListProps) {
    const { t } = useTranslation('pluginAiChat');

    return (
        <div className="flex flex-col gap-6">
            {messages.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-2">
                    {/* Run result card (special message type) */}
                    {msg.runResult ? (
                        <RunResultCard
                            result={msg.runResult}
                            onDismiss={onDismissRunResult ? () => onDismissRunResult(msg.id) : undefined}
                        />
                    ) : (
                        <>
                            <div className="flex items-center gap-2">
                                {msg.role === 'user' ? (
                                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 text-text-primary border border-border-ide">
                                        <User size={12} />
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center w-5 h-5 text-blue-500">
                                        <Sparkles size={14} />
                                    </div>
                                )}
                                <span className="font-semibold text-text-primary" style={{ fontSize: '12px' }}>
                                    {msg.role === 'user' ? t('message.you') : t('message.assistant')}
                                </span>
                            </div>
                            <div className={`leading-relaxed text-text-primary whitespace-pre-wrap pl-7 ${msg.role === 'user' ? 'opacity-90' : ''}`} style={{ fontSize: '12px' }}>
                                {msg.content}
                            </div>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}
