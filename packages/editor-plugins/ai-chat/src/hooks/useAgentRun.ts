import { useState, useCallback, useRef, useEffect } from 'react';
import type { EditorAIBridge } from '../ai/editor-ai-bridge';
import type { ComponentContract, PageSchema, SchemaNode } from '@shenbi/schema';
import { aiClient } from '../ai/sse-client';
import type { PagePlan, RunMetadata, RunRequest } from '../ai/api-types';

export type PlanConfig = PagePlan;
export type BlockRunStatus = 'waiting' | 'generating' | 'done';

function isSchemaNode(value: unknown): value is SchemaNode {
    return Boolean(value) && typeof value === 'object' && 'component' in (value as Record<string, unknown>);
}

function collectSchemaComponents(node: unknown, components: Set<string>): number {
    if (!node) {
        return 0;
    }
    if (Array.isArray(node)) {
        return node.reduce((count, child) => count + collectSchemaComponents(child, components), 0);
    }
    if (!isSchemaNode(node)) {
        return 0;
    }

    let count = 1;
    components.add(node.component);
    if (Array.isArray(node.children)) {
        count += collectSchemaComponents(node.children, components);
    }
    return count;
}

function summarizeSchema(schema: PageSchema): string {
    const components = new Set<string>();
    const bodyCount = collectSchemaComponents(schema.body, components);
    const dialogCount = collectSchemaComponents(schema.dialogs, components);
    const summaryParts = [
        `pageId=${schema.id}`,
        `pageName=${schema.name ?? schema.id}`,
        `nodeCount=${bodyCount + dialogCount}`,
        `dialogs=${Array.isArray(schema.dialogs) ? schema.dialogs.length : schema.dialogs ? 1 : 0}`,
    ];
    if (components.size > 0) {
        summaryParts.push(`components=${Array.from(components).slice(0, 20).join(', ')}`);
    }
    return summaryParts.join('; ');
}

function summarizeComponents(contracts: ComponentContract[]): string {
    return contracts
        .slice(0, 50)
        .map((contract) => {
            const propsCount = Array.isArray(contract.props) ? contract.props.length : 0;
            const slotsCount = Array.isArray(contract.slots) ? contract.slots.length : 0;
            return `${contract.componentType}(props:${propsCount},slots:${slotsCount})`;
        })
        .join('; ');
}

function replaceNodeInTree(value: unknown, targetId: string, replacement: SchemaNode): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => replaceNodeInTree(item, targetId, replacement));
    }
    if (!isSchemaNode(value)) {
        return value;
    }

    if (value.id === targetId) {
        return replacement;
    }

    if (Array.isArray(value.children)) {
        return {
            ...value,
            children: value.children.map((child) => replaceNodeInTree(child, targetId, replacement)),
        };
    }

    return value;
}

function replaceSkeletonNode(schema: PageSchema, blockId: string, node: SchemaNode): PageSchema {
    const skeletonId = `${blockId}-skeleton`;
    const nextSchema: PageSchema = {
        ...schema,
        body: replaceNodeInTree(schema.body, skeletonId, node) as PageSchema['body'],
    };
    if (Array.isArray(schema.dialogs)) {
        nextSchema.dialogs = replaceNodeInTree(schema.dialogs, skeletonId, node) as SchemaNode[];
    }
    return nextSchema;
}

export function useAgentRun(bridge: EditorAIBridge | undefined) {
    const [isRunning, setIsRunning] = useState(false);
    const [progressText, setProgressText] = useState('');
    const [currentPlan, setCurrentPlan] = useState<PlanConfig | null>(null);
    const [blockStatuses, setBlockStatuses] = useState<Record<string, BlockRunStatus>>({});
    const abortControllerRef = useRef<AbortController | null>(null);

    // Stable refs to avoid unstable callback deps
    const bridgeRef = useRef(bridge);
    bridgeRef.current = bridge;
    const isRunningRef = useRef(isRunning);
    isRunningRef.current = isRunning;

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

    const lockHistory = useCallback(async () => {
        if (bridgeRef.current) {
            await bridgeRef.current.execute('history.lock');
        }
    }, []);

    const unlockHistory = useCallback(async () => {
        if (bridgeRef.current) {
            await bridgeRef.current.execute('history.unlock');
        }
    }, []);

    const cancelRun = useCallback(async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsRunning(false);
        setProgressText('已取消');
        setCurrentPlan(null);
        setBlockStatuses({});
        await unlockHistory();
        if (preGenerationSchemaRef.current && bridgeRef.current) {
            await bridgeRef.current.execute('schema.restore', { schema: preGenerationSchemaRef.current });
        }
    }, [unlockHistory]);

    const runAgent = useCallback(
        async (
            prompt: string,
            plannerModel: string,
            blockModel: string,
            thinkingEnabled: boolean,
            conversationId: string | undefined,
            onMessageStart: () => string,
            onMessageDelta: (id: string, chunk: string) => void,
            onDone: (metadata: RunMetadata) => void,
            onError: (err: string) => void
        ) => {
            if (!bridgeRef.current) return;
            if (isRunningRef.current) return;

            setIsRunning(true);
            setProgressText('初始化...');
            setCurrentPlan(null);
            setBlockStatuses({});

            const ac = new AbortController();
            abortControllerRef.current = ac;

            // Pre-run setup
            preGenerationSchemaRef.current = bridgeRef.current.getSchema();
            await lockHistory();

            const schemaSummary = summarizeSchema(bridgeRef.current.getSchema());
            const componentSummary = summarizeComponents(bridgeRef.current.getAvailableComponents());
            const selectedNodeId = bridgeRef.current.getSelectedNodeId();

            const request: RunRequest = {
                prompt,
                ...(conversationId ? { conversationId } : {}),
                ...(selectedNodeId ? { selectedNodeId } : {}),
                ...(plannerModel ? { plannerModel } : {}),
                ...(blockModel ? { blockModel } : {}),
                thinking: { type: thinkingEnabled ? 'enabled' : 'disabled' },
                context: {
                    schemaSummary,
                    componentSummary,
                },
            };

            let activeMessageId: string | null = null;

            try {
                const stream = aiClient.runStream(request, { signal: ac.signal });
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
                                onMessageDelta(activeMessageId, event.data.text);
                            }
                            break;
                        case 'tool:start':
                            setProgressText(`正在使用工具: ${event.data.label ?? event.data.tool}...`);
                            break;
                        case 'tool:result':
                            setProgressText(`工具: ${event.data.tool} ${event.data.ok ? '完成' : '失败'}${event.data.summary ? `. ${event.data.summary}` : ''}`);
                            break;
                        case 'plan':
                            setCurrentPlan(event.data);
                            setBlockStatuses(
                                Object.fromEntries(event.data.blocks.map((block) => [block.id, 'waiting' as const]))
                            );
                            setProgressText('获取到架构计划');
                            break;
                        case 'schema:skeleton':
                            setProgressText('渲染页面骨架');
                            bridgeRef.current?.replaceSchema(event.data.schema);
                            break;
                        case 'schema:block:start':
                            setBlockStatuses((prev) => ({
                                ...prev,
                                [event.data.blockId]: 'generating',
                            }));
                            setProgressText(`正在生成区块: ${event.data.description}`);
                            break;
                        case 'schema:block':
                            setProgressText(`正在替换区块: ${event.data.node.component}`);
                            if (bridgeRef.current) {
                                const nextSchema = replaceSkeletonNode(
                                    bridgeRef.current.getSchema(),
                                    event.data.blockId,
                                    event.data.node,
                                );
                                bridgeRef.current.replaceSchema(nextSchema);
                            }
                            setBlockStatuses((prev) => ({
                                ...prev,
                                [event.data.blockId]: 'done',
                            }));
                            break;
                        case 'schema:done':
                            setProgressText('更新页面 Schema');
                            bridgeRef.current?.replaceSchema(event.data.schema);
                            setBlockStatuses((prev) => Object.fromEntries(
                                Object.keys(prev).map((blockId) => [blockId, 'done' as const])
                            ));
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
        [cancelRun, lockHistory, unlockHistory]
    );

    return {
        isRunning,
        progressText,
        currentPlan,
        blockStatuses,
        runAgent,
        cancelRun,
    };
}
