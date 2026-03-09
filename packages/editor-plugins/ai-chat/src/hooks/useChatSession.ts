import { useCallback, useEffect, useState } from 'react';
import type { PluginPersistenceService } from '@shenbi/editor-plugin-api';
import type { RunMetadata } from '../ai/api-types';

const PERSISTENCE_NAMESPACE = 'ai-chat';
const PERSISTENCE_KEY = 'session';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

export function useChatSession(persistence?: PluginPersistenceService) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [conversationId, setConversationId] = useState<string | undefined>();
    const [activeRunId, setActiveRunId] = useState<string | undefined>();
    const [lastMetadata, setLastMetadata] = useState<RunMetadata | undefined>();
    const [sessionHydrated, setSessionHydrated] = useState(!persistence);

    useEffect(() => {
        let cancelled = false;
        if (!persistence) {
            setSessionHydrated(true);
            return () => {
                cancelled = true;
            };
        }

        void persistence
            .getJSON<{
                messages?: ChatMessage[];
                conversationId?: string;
                lastMetadata?: RunMetadata;
            }>(PERSISTENCE_NAMESPACE, PERSISTENCE_KEY)
            .then((storedState) => {
                if (cancelled || !storedState) {
                    return;
                }
                setMessages(storedState.messages ?? []);
                setConversationId(storedState.conversationId);
                setLastMetadata(storedState.lastMetadata);
            })
            .catch(() => undefined)
            .finally(() => {
                if (!cancelled) {
                    setSessionHydrated(true);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [persistence]);

    useEffect(() => {
        if (!persistence || !sessionHydrated) {
            return;
        }

        void persistence
            .setJSON(PERSISTENCE_NAMESPACE, PERSISTENCE_KEY, {
                messages,
                conversationId,
                lastMetadata,
            })
            .catch(() => undefined);
    }, [conversationId, lastMetadata, messages, persistence, sessionHydrated]);

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
