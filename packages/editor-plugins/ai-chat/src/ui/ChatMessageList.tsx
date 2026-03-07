import React from 'react';
import type { ChatMessage } from '../hooks/useChatSession';

interface ChatMessageListProps {
    messages: ChatMessage[];
}

export function ChatMessageList({ messages }: ChatMessageListProps) {
    return (
        <div className="flex flex-col gap-4">
            {messages.map((msg) => (
                <div
                    key={msg.id}
                    className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : ''}`}
                >
                    <span className="text-[10px] text-text-secondary font-semibold">
                        {msg.role === 'user' ? 'You' : 'Shenbi AI'}
                    </span>
                    <div
                        className={`text-[12px] p-2 rounded-md leading-relaxed ${msg.role === 'user'
                                ? 'bg-blue-600 text-white rounded-tr-none shadow-sm'
                                : 'bg-bg-canvas border border-border-ide text-text-primary rounded-tl-none whitespace-pre-wrap'
                            }`}
                    >
                        {msg.content}
                    </div>
                </div>
            ))}
        </div>
    );
}
