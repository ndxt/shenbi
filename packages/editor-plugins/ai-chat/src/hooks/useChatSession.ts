import { useCallback, useEffect, useState } from 'react';
import type { PluginPersistenceService } from '@shenbi/editor-plugin-api';
import type { RunMetadata } from '../ai/api-types';
import type { LastRunResult } from './useAgentRun';

const PERSISTENCE_NAMESPACE = 'ai-chat';
const PERSISTENCE_KEY = 'session';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    /** When present, this message represents a completed run result card. */
    runResult?: LastRunResult | undefined;
}

export function useChatSession(persistence?: PluginPersistenceService) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [conversationId, setConversationId] = useState<string | undefined>();
    const [activeRunId, setActiveRunId] = useState<string | undefined>();
    const [lastMetadata, setLastMetadata] = useState<RunMetadata | undefined>();
    const [lastDebugFile, setLastDebugFile] = useState<string | undefined>();
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
                lastDebugFile?: string;
            }>(PERSISTENCE_NAMESPACE, PERSISTENCE_KEY)
            .then((storedState) => {
                if (cancelled || !storedState) {
                    return;
                }
                setMessages(storedState.messages ?? []);
                setConversationId(storedState.conversationId);
                setLastMetadata(storedState.lastMetadata);
                setLastDebugFile(storedState.lastDebugFile);
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
                lastDebugFile,
            })
            .catch(() => undefined);
    }, [conversationId, lastDebugFile, lastMetadata, messages, persistence, sessionHydrated]);

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

    /** Remove the runResult data from a specific message (dismiss the card). */
    const dismissRunResult = useCallback((messageId: string) => {
        setMessages((prev) =>
            prev.map((m) => {
                if (m.id !== messageId) return m;
                const { runResult: _, ...rest } = m;
                return rest;
            })
        );
    }, []);

    const resetSession = useCallback(() => {
        setMessages([]);
        setConversationId(undefined);
        setActiveRunId(undefined);
        setLastMetadata(undefined);
        setLastDebugFile(undefined);
    }, []);

    return {
        messages,
        addMessage,
        updateMessage,
        dismissRunResult,
        conversationId,
        setConversationId,
        activeRunId,
        setActiveRunId,
        lastMetadata,
        setLastMetadata,
        lastDebugFile,
        setLastDebugFile,
        resetSession,
    };
}
