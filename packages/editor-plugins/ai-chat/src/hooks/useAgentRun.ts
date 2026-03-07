import { useState, useCallback, useRef, useEffect } from 'react';
import type { EditorAIBridge } from '../ai/editor-ai-bridge';
import type { PageSchema, SchemaNode } from '@shenbi/schema';
import { aiClient } from '../ai/sse-client';
import type { RunRequest, AgentEvent } from '../ai/api-types';

export interface PlanConfig {
    title?: string;
    blocks: Array<{ type: string; description: string }>;
}

export function useAgentRun(bridge: EditorAIBridge | undefined) {
    const [isRunning, setIsRunning] = useState(false);
    const [progressText, setProgressText] = useState('');
    const [currentPlan, setCurrentPlan] = useState<PlanConfig | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // store preGenerationSchema for rollback
    const preGenerationSchemaRef = useRef<PageSchema | null>(null);

    // Block undo/redo globally during generation
    useEffect(() => {
        if (!isRunning) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const isZ = e.key.toLowerCase() === 'z';
            const isY = e.key.toLowerCase() === 'y';
            const isMacCmd = e.metaKey;
            const isWinCtrl = e.ctrlKey;

            if ((isMacCmd || isWinCtrl) && (isZ || isY)) {
                e.stopPropagation();
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isRunning]);

    const lockHistory = async () => {
        if (bridge) {
            await bridge.execute('history.lock'); // optional execution
        }
    };

    const unlockHistory = async () => {
        if (bridge) {
            await bridge.execute('history.unlock'); // optional execution
        }
    };

    const cancelRun = useCallback(async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsRunning(false);
        setProgressText('已取消');
        setCurrentPlan(null);
        await unlockHistory();
        if (preGenerationSchemaRef.current && bridge) {
            await bridge.execute('schema.restore', { schema: preGenerationSchemaRef.current });
        }
    }, [bridge]);

    const runAgent = useCallback(
        async (
            prompt: string,
            plannerModel: string,
            blockModel: string,
            conversationId: string | undefined,
            onMessageStart: () => string,
            onMessageDelta: (id: string, chunk: string) => void,
            onDone: (metadata: any) => void,
            onError: (err: string) => void
        ) => {
            if (!bridge) return;
            if (isRunning) return;

            setIsRunning(true);
            setProgressText('初始化...');
            setCurrentPlan(null);

            const ac = new AbortController();
            abortControllerRef.current = ac;

            // Pre-run setup
            preGenerationSchemaRef.current = bridge.getSchema();
            await lockHistory();

            const schemaSummary = JSON.stringify(bridge.getSchema());
            const componentSummary = JSON.stringify(bridge.getAvailableComponents());

            const request: RunRequest = {
                prompt,
                conversationId,
                selectedNodeId: bridge.getSelectedNodeId(),
                plannerModel,
                blockModel,
                context: {
                    schemaSummary,
                    componentSummary,
                },
            };

            let activeMessageId: string | null = null;

            try {
                const stream = aiClient.runStream(request);
                for await (const event of stream) {
                    if (ac.signal.aborted) {
                        break;
                    }

                    switch (event.type) {
                        case 'run:start':
                            setProgressText('运行开始');
                            break;
                        case 'message:start':
                            activeMessageId = onMessageStart();
                            break;
                        case 'message:delta':
                            if (activeMessageId) {
                                onMessageDelta(activeMessageId, event.data);
                            }
                            break;
                        case 'tool:start':
                            setProgressText(`正在使用工具: ${event.data.name}...`);
                            break;
                        case 'tool:result':
                            setProgressText(`工具: ${event.data.name} 完成. ${event.data.summary}`);
                            break;
                        case 'plan':
                            setCurrentPlan(event.data);
                            setProgressText('获取到架构计划');
                            break;
                        case 'schema:block':
                            setProgressText(`正在插入节点: ${event.data.node.component}`);
                            await bridge.appendBlock(event.data.node, event.data.parentTreeId);
                            break;
                        case 'schema:done':
                            setProgressText('更新页面 Schema');
                            bridge.replaceSchema(event.data);
                            break;
                        case 'done':
                            onDone(event.data.metadata);
                            break;
                        case 'error':
                            throw new Error(event.data.message);
                    }
                }
            } catch (err: any) {
                if (!ac.signal.aborted) {
                    onError(err.message || '未知错误');
                    await cancelRun();
                }
            } finally {
                if (!ac.signal.aborted) {
                    setIsRunning(false);
                    setProgressText('');
                    await unlockHistory();
                }
            }
        },
        [bridge, isRunning, cancelRun]
    );

    return {
        isRunning,
        progressText,
        currentPlan,
        runAgent,
        cancelRun,
    };
}
