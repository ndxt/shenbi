import { useState, useCallback } from 'react';
import type { RunMetadata } from '../ai/api-types';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

export function useChatSession() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [conversationId, setConversationId] = useState<string | undefined>();
    const [activeRunId, setActiveRunId] = useState<string | undefined>();
    const [lastMetadata, setLastMetadata] = useState<RunMetadata | undefined>();

    const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
        const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
        setMessages((prev) => [...prev, { ...msg, id, timestamp: Date.now() }]);
        return id;
    }, []);

    const updateMessage = useCallback((id: string, updater: (prevContent: string) => string) => {
        setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, content: updater(m.content) } : m))
        );
    }, []);

    const resetSession = useCallback(() => {
        setMessages([]);
        setConversationId(undefined);
        setActiveRunId(undefined);
        setLastMetadata(undefined);
    }, []);

    return {
        messages,
        addMessage,
        updateMessage,
        conversationId,
        setConversationId,
        activeRunId,
        setActiveRunId,
        lastMetadata,
        setLastMetadata,
        resetSession,
    };
}
