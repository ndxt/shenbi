import { useState, useCallback, useRef, useEffect } from 'react';
import type { EditorAIBridge } from '../ai/editor-ai-bridge';
import type { ComponentContract, PageSchema, SchemaNode } from '@shenbi/schema';
import { aiClient } from '../ai/sse-client';
import { executeAgentOperation } from '../ai/operation-executor';
import { createSchemaDigest, type AgentIntent, type PagePlan, type RunAttachmentInput, type RunMetadata, type RunRequest } from '../ai/api-types';
import type { AgentOperationMetrics } from '@shenbi/ai-contracts';
import type { AgentLoopResultSummary } from '../ai/agent-loop-types';
import {
    createPageExecutionSnapshot,
    replaceSkeletonNode,
    runPageExecution,
    type BlockRunStatus,
    type ModifyPlan,
    type PageExecutionSnapshot,
} from '../ai/page-execution';

export type PlanConfig = PagePlan;
export type { BlockRunStatus, ModifyPlan, PageExecutionSnapshot };

export interface LastRunResult {
  plan: PlanConfig | null;
  plannerMetrics: AgentOperationMetrics | null;
  blockStatuses: Record<string, BlockRunStatus>;
  blockTokens: Record<string, number>;
  blockInputTokens: Record<string, number>;
  blockOutputTokens: Record<string, number>;
  blockDurationMs: Record<string, number>;
  modifyPlan: ModifyPlan | null;
  modifyStatuses: Record<number, BlockRunStatus>;
  modifyOpMetrics: Record<number, AgentOperationMetrics>;
  elapsedMs: number;
  statusLabel: string;
  didApplySchema: boolean;
  autoSaved?: boolean;
  autoSaveError?: string;
  tokensUsed?: number;
  durationMs?: number;
  debugFile?: string;
  memoryDebugFile?: string;
  agentLoop?: AgentLoopResultSummary;
  pageExecution?: PageExecutionSnapshot;
}




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

function hasSchemaContent(schema: PageSchema): boolean {
    const bodyCount = Array.isArray(schema.body) ? schema.body.length : (schema.body ? 1 : 0);
    const dialogCount = Array.isArray(schema.dialogs) ? schema.dialogs.length : (schema.dialogs ? 1 : 0);
    return bodyCount + dialogCount > 0;
}

/**
 * Resolve a selectedNodeId that may be a path expression (e.g. "body.0.children.1.children.0")
 * into the actual schema node id (e.g. "block-1-kpi-overview").
 * If the value is already a plain id (no dots / not a path), it is returned as-is.
 * Returns undefined when the path cannot be resolved or the resolved node has no id.
 */
function resolveSelectedNodeId(schema: PageSchema, rawId: string | undefined): string | undefined {
    if (!rawId) return undefined;
    // Heuristic: path expressions start with "body" or "dialogs" and use dot notation
    if (!/^(body|dialogs)(\.|$)/.test(rawId)) {
        // Already looks like a plain node id
        return rawId;
    }
    const parts = rawId.split('.');
    // Walk the schema using the path segments
    let current: unknown = schema;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        if (Array.isArray(current)) {
            const index = Number(part);
            if (Number.isNaN(index)) return undefined;
            current = current[index];
        } else if (typeof current === 'object') {
            current = (current as Record<string, unknown>)[part];
        } else {
            return undefined;
        }
    }
    if (typeof current === 'object' && current !== null && 'id' in current) {
        const id = (current as { id?: unknown }).id;
        return typeof id === 'string' && id.length > 0 ? id : undefined;
    }
    return undefined;
}




export function useAgentRun(bridge: EditorAIBridge | undefined) {
    const [isRunning, setIsRunning] = useState(false);
    const [progressText, setProgressText] = useState('');
    const [elapsedMs, setElapsedMs] = useState(0);
    const [executionSnapshot, setExecutionSnapshot] = useState<PageExecutionSnapshot>(() => createPageExecutionSnapshot());
    const [lastRunResult, setLastRunResult] = useState<LastRunResult | null>(null);
    const startTimeRef = useRef<number>(0);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Stable refs to avoid unstable callback deps
    const bridgeRef = useRef(bridge);
    bridgeRef.current = bridge;
    const isRunningRef = useRef(isRunning);
    isRunningRef.current = isRunning;

    // store preGenerationSchema for rollback
    const preGenerationSchemaRef = useRef<PageSchema | null>(null);
    const historyBatchActiveRef = useRef(false);
    const currentIntentRef = useRef<AgentIntent | null>(null);
    const executionSnapshotRef = useRef<PageExecutionSnapshot>(createPageExecutionSnapshot());

    const updateExecutionSnapshot = useCallback((snapshot: PageExecutionSnapshot) => {
        executionSnapshotRef.current = snapshot;
        setExecutionSnapshot(snapshot);
        setProgressText(snapshot.progressText);
    }, []);

    const currentPlan = executionSnapshot.plan;
    const blockStatuses = executionSnapshot.blockStatuses;
    const modifyPlan = executionSnapshot.modifyPlan;
    const modifyStatuses = executionSnapshot.modifyStatuses;
    const modifyOpMetrics = executionSnapshot.modifyOpMetrics;
    const blockTokens = executionSnapshot.blockTokens;
    const blockInputTokens = executionSnapshot.blockInputTokens;
    const blockOutputTokens = executionSnapshot.blockOutputTokens;
    const blockDurationMs = executionSnapshot.blockDurationMs;
    const plannerMetrics = executionSnapshot.plannerMetrics;

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

    // Elapsed timer — ticks every second while running
    useEffect(() => {
        if (!isRunning) {
            setElapsedMs(0);
            return;
        }
        startTimeRef.current = Date.now();
        const timer = setInterval(() => {
            setElapsedMs(Date.now() - startTimeRef.current);
        }, 500);
        return () => clearInterval(timer);
    }, [isRunning]);

    const beginHistoryBatch = useCallback(async () => {
        if (bridgeRef.current) {
            const result = await bridgeRef.current.execute('history.beginBatch');
            historyBatchActiveRef.current = result.success;
            return result;
        }
        return { success: false, error: 'editor bridge unavailable' };
    }, []);

    const commitHistoryBatch = useCallback(async () => {
        if (bridgeRef.current) {
            const result = await bridgeRef.current.execute('history.commitBatch');
            if (result.success) {
                historyBatchActiveRef.current = false;
            }
            return result;
        }
        return { success: false, error: 'editor bridge unavailable' };
    }, []);

    const ensureHistoryBatch = useCallback(async () => {
        if (historyBatchActiveRef.current) {
            return { success: true };
        }
        return beginHistoryBatch();
    }, [beginHistoryBatch]);

    const discardHistoryBatch = useCallback(async () => {
        if (bridgeRef.current) {
            const result = await bridgeRef.current.execute('history.discardBatch');
            if (result.success) {
                historyBatchActiveRef.current = false;
            }
            return result;
        }
        return { success: false, error: 'editor bridge unavailable' };
    }, []);

    const cancelRun = useCallback(async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsRunning(false);
        setProgressText('已取消');
        updateExecutionSnapshot({
            ...createPageExecutionSnapshot(currentIntentRef.current === 'schema.modify' ? 'modify' : 'create'),
            progressText: '已取消',
        });
        const discardResult = historyBatchActiveRef.current
            ? await discardHistoryBatch()
            : { success: true };
        if (!discardResult.success && preGenerationSchemaRef.current && bridgeRef.current) {
            await bridgeRef.current.execute('schema.restore', { schema: preGenerationSchemaRef.current });
        }
    }, [discardHistoryBatch, updateExecutionSnapshot]);

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
            onError: (err: string) => void,
            blockConcurrency?: number,
            onRunComplete?: (result: LastRunResult) => void,
            attachments: RunAttachmentInput[] = [],
        ) => {
            if (!bridgeRef.current) return;
            if (isRunningRef.current) return;

            setIsRunning(true);
            setProgressText('初始化...');
            setElapsedMs(0);
            updateExecutionSnapshot({
                ...createPageExecutionSnapshot(),
                progressText: '初始化...',
            });
            startTimeRef.current = Date.now();
            currentIntentRef.current = null;

            const ac = new AbortController();
            abortControllerRef.current = ac;

            // Pre-run setup
            preGenerationSchemaRef.current = bridgeRef.current.getSchema();
            const currentSchema = bridgeRef.current.getSchema();

            const schemaSummary = summarizeSchema(currentSchema);
            const componentSummary = summarizeComponents(bridgeRef.current.getAvailableComponents());
            const rawSelectedNodeId = bridgeRef.current.getSelectedNodeId();
            const selectedNodeId = resolveSelectedNodeId(currentSchema, rawSelectedNodeId);

            const request: RunRequest = {
                prompt,
                ...(attachments.length > 0 ? { attachments } : {}),
                ...(conversationId ? { conversationId } : {}),
                ...(selectedNodeId ? { selectedNodeId } : {}),
                ...(plannerModel ? { plannerModel } : {}),
                ...(blockModel ? { blockModel } : {}),
                thinking: { type: thinkingEnabled ? 'enabled' : 'disabled' },
                ...(blockConcurrency !== undefined ? { blockConcurrency } : {}),
                context: {
                    schemaSummary,
                    componentSummary,
                    schemaJson: currentSchema,
                },
            };

            let activeMessageId: string | null = null;
            let modifyFailed = false;
            let failedOpIndex: number | undefined;
            let failedError: string | undefined;
            let didApplySchemaChange = false;
            let autoSaved = false;
            let autoSaveError: string | undefined;

            const finalizeModifyRun = async (metadata: RunMetadata): Promise<RunMetadata> => {
                const finalizeConversationId = metadata.conversationId ?? conversationId ?? metadata.sessionId;
                if (currentIntentRef.current !== 'schema.modify') {
                    return metadata;
                }
                try {
                    const schemaDigest = bridgeRef.current
                        ? createSchemaDigest(bridgeRef.current.getSchema())
                        : undefined;
                    const finalizeRequest = modifyFailed
                        ? {
                            conversationId: finalizeConversationId,
                            sessionId: metadata.sessionId,
                            success: false as const,
                            failedOpIndex: failedOpIndex ?? 0,
                            error: failedError ?? `modify operation ${typeof failedOpIndex === 'number' ? failedOpIndex + 1 : '?'} failed`,
                            ...(schemaDigest ? { schemaDigest } : {}),
                        }
                        : {
                            conversationId: finalizeConversationId,
                            sessionId: metadata.sessionId,
                            success: true as const,
                            ...(schemaDigest ? { schemaDigest } : {}),
                        };
                    const finalizeResult = await aiClient.finalize({
                        ...finalizeRequest,
                    });
                    return finalizeResult.memoryDebugFile
                        ? {
                            ...metadata,
                            memoryDebugFile: finalizeResult.memoryDebugFile,
                        }
                        : metadata;
                } catch (finalizeError: any) {
                    onError(finalizeError?.message || '修改结果回写失败');
                    return metadata;
                }
            };

            const discardHistoryBatchOnFailure = async () => {
                if (!historyBatchActiveRef.current) {
                    return { success: true };
                }
                const discardResult = await discardHistoryBatch();
                if (!discardResult.success) {
                    failedError = `${failedError ?? 'modify failed'}; rollback failed: ${discardResult.error || 'history.discardBatch failed'}`;
                }
                return discardResult;
            };

            try {
                const executionResult = await runPageExecution({
                    aiClient,
                    request,
                    signal: ac.signal,
                    callbacks: {
                        onIntent: async (intent) => {
                            currentIntentRef.current = intent;
                        },
                        onMessageStart: async () => {
                            activeMessageId = onMessageStart();
                        },
                        onMessageDelta: async (text) => {
                            if (activeMessageId) {
                                onMessageDelta(activeMessageId, text);
                            }
                        },
                        onSnapshot: async (snapshot) => {
                            updateExecutionSnapshot(snapshot);
                        },
                        onSchemaSkeleton: async (schema) => {
                            const batchResult = await ensureHistoryBatch();
                            if (!batchResult.success) {
                                throw new Error(batchResult.error || 'history.beginBatch failed');
                            }
                            bridgeRef.current?.replaceSchema(schema);
                            didApplySchemaChange = true;
                        },
                        onSchemaBlock: async (data) => {
                            const batchResult = await ensureHistoryBatch();
                            if (!batchResult.success) {
                                throw new Error(batchResult.error || 'history.beginBatch failed');
                            }
                            if (bridgeRef.current) {
                                const nextSchema = replaceSkeletonNode(
                                    bridgeRef.current.getSchema(),
                                    data.blockId,
                                    data.node,
                                );
                                bridgeRef.current.replaceSchema(nextSchema);
                            }
                            didApplySchemaChange = true;
                        },
                        onSchemaDone: async (schema) => {
                            const batchResult = await ensureHistoryBatch();
                            if (!batchResult.success) {
                                throw new Error(batchResult.error || 'history.beginBatch failed');
                            }
                            bridgeRef.current?.replaceSchema(schema);
                            didApplySchemaChange = true;
                        },
                        onModifyOperation: async (data) => {
                            if (modifyFailed) {
                                return;
                            }
                            const batchResult = await ensureHistoryBatch();
                            if (!batchResult.success) {
                                throw new Error(batchResult.error || 'history.beginBatch failed');
                            }
                            if (!bridgeRef.current) {
                                throw new Error('editor bridge unavailable');
                            }
                            const result = await executeAgentOperation(bridgeRef.current, data.operation);
                            if (!result.success) {
                                modifyFailed = true;
                                failedOpIndex = data.index;
                                failedError = result.error || `modify operation ${data.index + 1} failed`;
                                const discardResult = await discardHistoryBatchOnFailure();
                                if (!discardResult.success) {
                                    onError(`修改失败且回滚失败：第 ${data.index + 1} 条 ${data.operation.op} 执行出错 - ${discardResult.error || 'history.discardBatch failed'}`);
                                } else {
                                    setProgressText(`修改已回滚：第 ${data.index + 1} 条失败`);
                                }
                                onError(`修改失败：第 ${data.index + 1} 条 ${data.operation.op} 执行出错${failedError ? ` - ${failedError}` : ''}`);
                            } else {
                                didApplySchemaChange = true;
                            }
                        },
                        onDone: async () => {
                            if (currentIntentRef.current === 'schema.modify' && historyBatchActiveRef.current) {
                                if (modifyFailed) {
                                    const discardResult = await discardHistoryBatchOnFailure();
                                    if (!discardResult.success) {
                                        throw new Error(discardResult.error || 'history.discardBatch failed');
                                    }
                                } else {
                                    const commitResult = await commitHistoryBatch();
                                    if (!commitResult.success) {
                                        throw new Error(commitResult.error || 'history.commitBatch failed');
                                    }
                                }
                            }
                        },
                    },
                });

                const finalizedMetadata = await finalizeModifyRun(
                    executionResult.metadata ?? { sessionId: conversationId ?? 'unknown', ...(conversationId ? { conversationId } : {}) },
                );
                const finalizedSnapshot: PageExecutionSnapshot = {
                    ...executionResult.snapshot,
                    ...(finalizedMetadata ? { metadata: finalizedMetadata } : {}),
                    progressText: currentIntentRef.current === 'schema.modify'
                        ? (modifyFailed ? '页面修改失败，已回滚' : '页面修改已应用')
                        : executionResult.snapshot.progressText,
                };
                updateExecutionSnapshot(finalizedSnapshot);

                const shouldAutoSave = didApplySchemaChange && !modifyFailed;
                if (shouldAutoSave && bridgeRef.current) {
                    const saveResult = await bridgeRef.current.execute('tab.save', { source: 'auto' });
                    if (saveResult.success) {
                        autoSaved = true;
                    } else {
                        autoSaveError = saveResult.error || '自动保存失败';
                    }
                }
                const runResult: LastRunResult = {
                    plan: finalizedSnapshot.plan,
                    plannerMetrics: finalizedSnapshot.plannerMetrics,
                    blockStatuses: { ...finalizedSnapshot.blockStatuses },
                    blockTokens: { ...finalizedSnapshot.blockTokens },
                    blockInputTokens: { ...finalizedSnapshot.blockInputTokens },
                    blockOutputTokens: { ...finalizedSnapshot.blockOutputTokens },
                    blockDurationMs: { ...finalizedSnapshot.blockDurationMs },
                    modifyPlan: finalizedSnapshot.modifyPlan,
                    modifyStatuses: { ...finalizedSnapshot.modifyStatuses },
                    modifyOpMetrics: { ...finalizedSnapshot.modifyOpMetrics },
                    elapsedMs: Date.now() - startTimeRef.current,
                    statusLabel: finalizedSnapshot.modifyPlan ? '页面修改已应用' : '页面生成完成',
                    didApplySchema: didApplySchemaChange && !modifyFailed,
                    ...(autoSaved ? { autoSaved: true } : {}),
                    ...(autoSaveError ? { autoSaveError } : {}),
                    ...(typeof finalizedMetadata.tokensUsed === 'number' ? { tokensUsed: finalizedMetadata.tokensUsed } : {}),
                    ...(typeof finalizedMetadata.durationMs === 'number' ? { durationMs: finalizedMetadata.durationMs } : {}),
                    ...(finalizedMetadata.debugFile ? { debugFile: finalizedMetadata.debugFile } : {}),
                    ...(finalizedMetadata.memoryDebugFile ? { memoryDebugFile: finalizedMetadata.memoryDebugFile } : {}),
                    pageExecution: finalizedSnapshot,
                };
                setLastRunResult(runResult);
                onRunComplete?.(runResult);
                onDone(finalizedMetadata);
            } catch (err: any) {
                if (!ac.signal.aborted) {
                    onError(err.message || '未知错误');
                    await cancelRun();
                }
            } finally {
                if (!ac.signal.aborted) {
                    setIsRunning(false);
                    if (historyBatchActiveRef.current) {
                        const result = modifyFailed
                            ? await discardHistoryBatch()
                            : await commitHistoryBatch();
                        if (!result.success) {
                            onError(result.error || (modifyFailed ? 'history.discardBatch failed' : 'history.commitBatch failed'));
                        }
                    }
                }
            }
        },
        [cancelRun, commitHistoryBatch, ensureHistoryBatch]
    );

    return {
        isRunning,
        progressText,
        currentPlan,
        blockStatuses,
        modifyPlan,
        modifyStatuses,
        modifyOpMetrics,
        elapsedMs,
        blockTokens,
        blockInputTokens,
        blockOutputTokens,
        blockDurationMs,
        plannerMetrics,
        executionSnapshot,
        lastRunResult,
        setLastRunResult,
        runAgent,
        cancelRun,
    };
}
