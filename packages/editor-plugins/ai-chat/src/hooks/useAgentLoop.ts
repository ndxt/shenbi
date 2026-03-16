import { useCallback, useEffect, useRef, useState } from 'react';
import type { PluginPersistenceService } from '@shenbi/editor-plugin-api';
import type { PageSchema } from '@shenbi/schema';
import type { AgentEvent, LoopSessionState, ProjectPlan, ReActStep, RunAttachmentInput, RunMetadata, RunRequest } from '../ai/api-types';
import { aiClient } from '../ai/sse-client';
import type { EditorAIBridge } from '../ai/editor-ai-bridge';
import { AgentLoopTracer } from '../ai/agent-loop-tracer';
import { buildAgentLoopSystemPrompt, executeAgentTool } from '../ai/agent-tools';
import type {
  AgentLoopPageProgress,
  AgentLoopResultSummary,
  PersistedAgentLoopState,
  UIPhase,
} from '../ai/agent-loop-types';
import { parseReActResponse, type ParsedReActResponse } from '../ai/react-parser';
import { applyModifyOperationsToSchema } from '../ai/agent-tools';
import { useAgentRun, type LastRunResult } from './useAgentRun';

const PERSISTENCE_NAMESPACE = 'ai-chat';
const AGENT_LOOP_PERSISTENCE_KEY = 'agent-loop-state';
const MAX_LOOP_ITERATIONS = 30;
const TOOL_IDLE_TIMEOUT_MS = 90_000;

function summarizeSchema(schema: PageSchema): string {
  const bodyCount = Array.isArray(schema.body) ? schema.body.length : schema.body ? 1 : 0;
  const dialogCount = Array.isArray(schema.dialogs) ? schema.dialogs.length : schema.dialogs ? 1 : 0;
  return `pageId=${schema.id}; pageName=${schema.name ?? schema.id}; nodeCount=${bodyCount + dialogCount}`;
}

function summarizeComponents(bridge: EditorAIBridge | undefined): string {
  if (!bridge) {
    return '';
  }
  return bridge.getAvailableComponents()
    .slice(0, 50)
    .map((contract) => contract.componentType)
    .join(', ');
}

function compactMessages(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>) {
  if (messages.length <= 11) {
    return messages;
  }
  const [first] = messages;
  return first ? [first, ...messages.slice(-10)] : messages.slice(-10);
}

function isResumePrompt(prompt: string): boolean {
  return /^(继续|continue)$/i.test(prompt.trim());
}

function isProjectPrompt(prompt: string, attachments: RunAttachmentInput[]): boolean {
  if (isResumePrompt(prompt)) {
    return true;
  }
  if (attachments.length > 0 && /(系统|项目|工程|平台|workspace|project)/i.test(prompt)) {
    return true;
  }
  return /(系统|项目|工程|平台|多页面|多个页面|workspace|project)/i.test(prompt);
}

function createLoopState(conversationId: string): LoopSessionState {
  return {
    conversationId,
    status: 'planning',
    createdFileIds: [],
    completedPageIds: [],
    failedPageIds: [],
    updatedAt: new Date().toISOString(),
  };
}

function createIdleTimeoutSignal(parentSignal?: AbortSignal, timeoutMs = TOOL_IDLE_TIMEOUT_MS) {
  const controller = new AbortController();
  let timedOut = false;
  let timeoutId: number | undefined;

  const clearTimer = () => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };

  const armTimer = () => {
    clearTimer();
    timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  };

  const handleParentAbort = () => {
    controller.abort();
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener('abort', handleParentAbort);
    }
  }

  armTimer();

  return {
    signal: controller.signal,
    refresh: armTimer,
    didTimeout: () => timedOut,
    dispose: () => {
      clearTimer();
      if (parentSignal) {
        parentSignal.removeEventListener('abort', handleParentAbort);
      }
    },
  };
}

async function writeAgentLoopDebugDump(payload: Record<string, unknown>): Promise<string | undefined> {
  try {
    const response = await fetch('/api/ai/debug/client-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      return undefined;
    }
    const json = await response.json() as { data?: { debugFile?: string } };
    return json.data?.debugFile;
  } catch {
    return undefined;
  }
}

async function writeAgentLoopTraceDump(
  status: 'success' | 'error',
  trace: Record<string, unknown>,
): Promise<string | undefined> {
  try {
    const response = await fetch('/api/ai/debug/trace', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status,
        trace,
      }),
    });
    if (!response.ok) {
      return undefined;
    }
    const json = await response.json() as { data?: { traceFile?: string } };
    return json.data?.traceFile;
  } catch {
    return undefined;
  }
}

function buildReActRepairPrompt(errorMessage: string, invalidResponse: string): string {
  return [
    `格式错误：上一条回复无法被程序解析，错误是：${errorMessage}`,
    '请基于同一上下文，立刻重新输出唯一合法的下一步。',
    '不要解释，不要重复 reasoning，不要返回包装 JSON。',
    '你的回复必须只包含以下字段：',
    'Action: [工具名称]',
    'Action Input: [JSON 对象]',
    '如果需要说明，只能额外加一行 Status 或 Reasoning Summary。',
    '',
    '这是你刚才的错误回复：',
    invalidResponse,
  ].join('\n');
}

function formatParsedReActMessage(parsed: ParsedReActResponse): string {
  return [
    ...(parsed.status ? [`Status: ${parsed.status}`] : []),
    ...(parsed.reasoningSummary ? [`Reasoning Summary: ${parsed.reasoningSummary}`] : []),
    `Action: ${parsed.action}`,
    `Action Input: ${parsed.rawActionInput}`,
  ].join('\n');
}

function createLoopRunResult(summary: AgentLoopResultSummary, elapsedMs: number): LastRunResult {
  const completed = summary.pages.filter((page) => page.status === 'done').length;
  return {
    plan: null,
    plannerMetrics: null,
    blockStatuses: {},
    blockTokens: {},
    blockInputTokens: {},
    blockOutputTokens: {},
    blockDurationMs: {},
    modifyPlan: null,
    modifyStatuses: {},
    modifyOpMetrics: {},
    elapsedMs,
    statusLabel: summary.projectPlan
      ? `${summary.projectPlan.projectName}: ${completed}/${summary.pages.length} pages completed`
      : `Agent Loop completed: ${completed}/${summary.pages.length}`,
    didApplySchema: summary.createdFileIds.length > 0 || summary.pages.some((page) => page.action === 'modify' && page.status === 'done'),
    ...(summary.traceFile ? { debugFile: summary.traceFile } : {}),
    agentLoop: summary,
  };
}

interface UseAgentLoopResult {
  mode: 'legacy' | 'loop' | null;
  phase: UIPhase;
  isRunning: boolean;
  progressText: string;
  elapsedMs: number;
  steps: ReActStep[];
  projectPlan: ProjectPlan | null;
  pages: AgentLoopPageProgress[];
  errorMessage: string | undefined;
  lastRunResult: LastRunResult | null;
  legacy: ReturnType<typeof useAgentRun>;
  planRevisionRequested: boolean;
  runAgent: ReturnType<typeof useAgentRun>['runAgent'];
  cancelRun: () => Promise<void>;
  resetLoopState: () => Promise<void>;
  confirmProjectPlan: () => void;
  requestProjectPlanRevision: () => void;
  cancelProjectPlanRevision: () => void;
  submitProjectPlanRevision: (text: string) => void;
}

export function useAgentLoop(
  bridge: EditorAIBridge | undefined,
  persistence?: PluginPersistenceService,
): UseAgentLoopResult {
  const legacy = useAgentRun(bridge);
  const [mode, setMode] = useState<'legacy' | 'loop' | null>(null);
  const [phase, setPhase] = useState<UIPhase>('idle');
  const [progressText, setProgressText] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [steps, setSteps] = useState<ReActStep[]>([]);
  const [projectPlan, setProjectPlan] = useState<ProjectPlan | null>(null);
  const [pages, setPages] = useState<AgentLoopPageProgress[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [lastRunResult, setLastRunResult] = useState<LastRunResult | null>(null);
  const [planRevisionRequested, setPlanRevisionRequested] = useState(false);
  const [isLoopRunning, setIsLoopRunning] = useState(false);

  const startTimeRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const tracerRef = useRef<AgentLoopTracer | null>(null);
  const persistedRef = useRef<PersistedAgentLoopState | undefined>(undefined);
  const loopMessagesRef = useRef<Array<{ role: 'system' | 'user' | 'assistant'; content: string }>>([]);
  const loopStateRef = useRef<LoopSessionState | undefined>(undefined);
  const projectPlanRef = useRef<ProjectPlan | null>(null);
  const stepsRef = useRef<ReActStep[]>([]);
  const pagesRef = useRef<AgentLoopPageProgress[]>([]);
  const pageLookupRef = useRef<Map<string, AgentLoopPageProgress>>(new Map());
  const confirmResolverRef = useRef<((observation: string) => void) | null>(null);
  const activePlannerModelRef = useRef<string>('');
  const activeBlockModelRef = useRef<string>('');

  useEffect(() => {
    if (!persistence) {
      return;
    }
    let cancelled = false;
    void persistence.getJSON<PersistedAgentLoopState>(PERSISTENCE_NAMESPACE, AGENT_LOOP_PERSISTENCE_KEY)
      .then((value) => {
        if (cancelled || !value) {
          return;
        }
        persistedRef.current = value;
        loopMessagesRef.current = value.reactMessages;
        loopStateRef.current = value.loopState;
        projectPlanRef.current = value.projectPlan ?? null;
        pagesRef.current = value.pages;
        stepsRef.current = value.trace;
        pageLookupRef.current = new Map(value.pages.map((page) => [page.pageId, page]));
        setSteps(value.trace);
        setProjectPlan(value.projectPlan ?? null);
        setPages(value.pages);
        if (value.loopState.status === 'awaiting_confirmation') {
          setMode('loop');
          setPhase('awaiting_confirmation');
          setProgressText('等待用户确认项目规划');
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [persistence]);

  useEffect(() => {
    if (!isLoopRunning) {
      setElapsedMs(0);
      return;
    }
    startTimeRef.current = Date.now();
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 500);
    return () => window.clearInterval(timer);
  }, [isLoopRunning]);

  const persistLoopState = useCallback(async () => {
    if (!persistence || !loopStateRef.current) {
      return;
    }
    const payload: PersistedAgentLoopState = {
      loopState: {
        ...loopStateRef.current,
        updatedAt: new Date().toISOString(),
      },
      reactMessages: loopMessagesRef.current,
      trace: stepsRef.current,
      pages: pagesRef.current,
      createdFileIds: loopStateRef.current.createdFileIds,
      ...(projectPlanRef.current ? { projectPlan: projectPlanRef.current } : {}),
    };
    persistedRef.current = payload;
    await persistence.setJSON(PERSISTENCE_NAMESPACE, AGENT_LOOP_PERSISTENCE_KEY, payload);
  }, [persistence]);

  const clearPersistedLoopState = useCallback(async () => {
    persistedRef.current = undefined;
    if (persistence) {
      await persistence.remove(PERSISTENCE_NAMESPACE, AGENT_LOOP_PERSISTENCE_KEY).catch(() => undefined);
    }
  }, [persistence]);

  const resetLoopState = useCallback(async () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    tracerRef.current = null;
    loopMessagesRef.current = [];
    loopStateRef.current = undefined;
    pageLookupRef.current = new Map();
    confirmResolverRef.current = null;
    activePlannerModelRef.current = '';
    activeBlockModelRef.current = '';
    setMode(null);
    setPhase('idle');
    setProgressText('');
    setElapsedMs(0);
    setSteps([]);
    stepsRef.current = [];
    projectPlanRef.current = null;
    pagesRef.current = [];
    setProjectPlan(null);
    setPages([]);
    setErrorMessage(undefined);
    setLastRunResult(null);
    setPlanRevisionRequested(false);
    setIsLoopRunning(false);
    await clearPersistedLoopState();
  }, [clearPersistedLoopState]);

  const updatePage = useCallback((pageId: string, updater: (page: AgentLoopPageProgress) => AgentLoopPageProgress) => {
    setPages((previous) => {
      const next = previous.map((page) => {
        if (page.pageId !== pageId) {
          return page;
        }
        const updated = updater(page);
        if (updated.pageId !== pageId) {
          pageLookupRef.current.delete(pageId);
          pageLookupRef.current.set(updated.pageId, updated);
        } else {
          pageLookupRef.current.set(pageId, updated);
        }
        return updated;
      });
      pagesRef.current = next;
      return next;
    });
  }, []);

  const listWorkspaceFiles = useCallback(async () => {
    if (!bridge) {
      return [];
    }
    const result = await bridge.execute('file.listSchemas');
    return Array.isArray(result.data) ? result.data as Array<{ id: string; name: string; updatedAt: number }> : [];
  }, [bridge]);

  const readPageSchema = useCallback(async (fileId: string) => {
    if (!bridge) {
      throw new Error('editor bridge unavailable');
    }
    const result = await bridge.execute('file.readSchema', { fileId });
    if (!result.success || !result.data) {
      throw new Error(result.error ?? `Failed to read page ${fileId}`);
    }
    return result.data as PageSchema;
  }, [bridge]);

  const writePageSchema = useCallback(async (fileId: string, schema: PageSchema) => {
    if (!bridge) {
      throw new Error('editor bridge unavailable');
    }
    const result = await bridge.execute('file.writeSchema', { fileId, schema });
    if (!result.success) {
      throw new Error(result.error ?? `Failed to write page ${fileId}`);
    }
  }, [bridge]);

  const deletePageSchema = useCallback(async (fileId: string) => {
    if (!bridge) {
      throw new Error('editor bridge unavailable');
    }
    const result = await bridge.execute('file.deleteSchema', { fileId });
    if (!result.success) {
      throw new Error(result.error ?? `Failed to delete page ${fileId}`);
    }
  }, [bridge]);

  const ensureUniqueFileId = useCallback(async (desiredId: string) => {
    const files = await listWorkspaceFiles();
    const existing = new Set(files.map((file) => file.id));
    if (!existing.has(desiredId)) {
      return desiredId;
    }
    let index = 2;
    while (existing.has(`${desiredId}-${index}`)) {
      index += 1;
    }
    return `${desiredId}-${index}`;
  }, [listWorkspaceFiles]);

  const executeCreatePage = useCallback(async (
    input: { pageId: string; pageName: string; prompt: string; fileId?: string },
    page: AgentLoopPageProgress,
  ) => {
    if (!bridge) {
      throw new Error('editor bridge unavailable');
    }
    const parentSignal = abortControllerRef.current?.signal;
    const timeoutController = createIdleTimeoutSignal(parentSignal);
    let fileId = await ensureUniqueFileId(input.fileId ?? input.pageId);
    let placeholderCreated = false;
    updatePage(page.pageId, (current) => ({
      ...(() => {
        const { error: _error, ...rest } = current;
        return rest;
      })(),
      pageName: input.pageName,
      status: 'running',
      blocks: [],
    }));
    setProgressText(`正在创建页面 ${input.pageName}`);
    const request: RunRequest = {
      prompt: input.prompt,
      intent: 'schema.create',
      ...(activePlannerModelRef.current ? { plannerModel: activePlannerModelRef.current } : {}),
      ...(activeBlockModelRef.current ? { blockModel: activeBlockModelRef.current } : {}),
      thinking: { type: 'disabled' },
      context: {
        schemaSummary: 'pageId=empty; pageName=empty; nodeCount=0',
        componentSummary: summarizeComponents(bridge),
        schemaJson: {
          id: fileId,
          name: input.pageName,
          body: [],
        },
      },
    };

    let finalSchema: PageSchema | undefined;
    let metadata: RunMetadata | undefined;
    const startedAt = Date.now();
    try {
      const createFileResult = await bridge.execute('fs.createFile', {
        parentId: null,
        name: input.pageName,
        fileType: 'page',
        content: {
          id: fileId,
          name: input.pageName,
          body: [],
        },
      });
      if (createFileResult.success && createFileResult.data && typeof (createFileResult.data as { id?: unknown }).id === 'string') {
        fileId = String((createFileResult.data as { id: unknown }).id);
        placeholderCreated = true;
      }

      for await (const event of aiClient.runStream(request, { signal: timeoutController.signal })) {
        timeoutController.refresh();
        if (event.type === 'plan') {
          setProgressText(`正在规划 ${input.pageName} 的页面区块`);
          updatePage(page.pageId, (current) => ({
            ...current,
            blocks: event.data.blocks.map((block) => ({
              id: block.id,
              label: block.description,
              status: 'waiting',
            })),
          }));
        } else if (event.type === 'schema:block:start') {
          setProgressText(`正在生成 ${input.pageName} · ${event.data.description}`);
          updatePage(page.pageId, (current) => ({
            ...current,
            blocks: current.blocks.map((block) => block.id === event.data.blockId ? { ...block, status: 'generating' } : block),
          }));
        } else if (event.type === 'schema:block') {
          updatePage(page.pageId, (current) => ({
            ...current,
            blocks: current.blocks.map((block) => block.id === event.data.blockId
              ? {
                  ...block,
                  status: 'done',
                  ...(event.data.durationMs !== undefined ? { durationMs: event.data.durationMs } : {}),
                  ...(event.data.inputTokens !== undefined ? { inputTokens: event.data.inputTokens } : {}),
                  ...(event.data.outputTokens !== undefined ? { outputTokens: event.data.outputTokens } : {}),
                }
              : block),
          }));
        } else if (event.type === 'schema:done') {
          setProgressText(`${input.pageName} 已生成，正在写入工作区`);
          finalSchema = {
            ...event.data.schema,
            id: fileId,
            name: input.pageName,
          };
        } else if (event.type === 'done') {
          metadata = event.data.metadata;
        } else if (event.type === 'error') {
          throw new Error(event.data.message);
        }
      }
    } catch (error) {
      const message = timeoutController.didTimeout()
        ? `createPage timed out after ${Math.round(TOOL_IDLE_TIMEOUT_MS / 1000)}s for ${input.pageName}`
        : error instanceof Error
          ? error.message
          : String(error);
      if (placeholderCreated) {
        await deletePageSchema(fileId).catch(() => undefined);
      }
      updatePage(page.pageId, (current) => ({
        ...current,
        status: 'failed',
        error: message,
      }));
      throw new Error(message);
    } finally {
      timeoutController.dispose();
    }

    if (!finalSchema) {
      if (placeholderCreated) {
        await deletePageSchema(fileId).catch(() => undefined);
      }
      throw new Error(`createPage did not produce a final schema for ${input.pageName}`);
    }

    await writePageSchema(fileId, finalSchema);
    setProgressText(`${input.pageName} 已写入工作区`);
    updatePage(page.pageId, (current) => ({
      ...current,
      fileId,
      status: 'done',
      durationMs: metadata?.durationMs ?? (Date.now() - startedAt),
    }));
    return {
      fileId,
      success: true,
      durationMs: metadata?.durationMs ?? (Date.now() - startedAt),
    };
  }, [bridge, ensureUniqueFileId, updatePage, writePageSchema]);

  const executeModifyPage = useCallback(async (
    input: { fileId: string; prompt: string; pageName?: string },
    page: AgentLoopPageProgress,
  ) => {
    if (!bridge) {
      throw new Error('editor bridge unavailable');
    }
    const parentSignal = abortControllerRef.current?.signal;
    const timeoutController = createIdleTimeoutSignal(parentSignal);
    const existingSchema = await readPageSchema(input.fileId);
    updatePage(page.pageId, (current) => ({
      ...(() => {
        const { error: _error, ...rest } = current;
        return rest;
      })(),
      status: 'running',
      blocks: [],
    }));
    setProgressText(`正在修改页面 ${page.pageName}`);

    const request: RunRequest = {
      prompt: input.prompt,
      intent: 'schema.modify',
      ...(activePlannerModelRef.current ? { plannerModel: activePlannerModelRef.current } : {}),
      ...(activeBlockModelRef.current ? { blockModel: activeBlockModelRef.current } : {}),
      thinking: { type: 'disabled' },
      context: {
        schemaSummary: summarizeSchema(existingSchema),
        componentSummary: summarizeComponents(bridge),
        schemaJson: existingSchema,
      },
    };

    const operations: AgentEvent[] = [];
    let metadata: RunMetadata | undefined;
    const startedAt = Date.now();
    try {
      for await (const event of aiClient.runStream(request, { signal: timeoutController.signal })) {
        timeoutController.refresh();
        operations.push(event);
        if (event.type === 'modify:start') {
          setProgressText(`正在规划 ${page.pageName} 的修改操作`);
          updatePage(page.pageId, (current) => ({
            ...current,
            blocks: (event.data.operations ?? []).map((operation, index) => ({
              id: String(index),
              label: operation.label ?? operation.op,
              status: 'waiting',
            })),
          }));
        } else if (event.type === 'modify:op:pending') {
          setProgressText(`正在修改 ${page.pageName} · 步骤 ${event.data.index + 1}`);
          updatePage(page.pageId, (current) => ({
            ...current,
            blocks: current.blocks.map((block, index) => index === event.data.index ? { ...block, status: 'generating' } : block),
          }));
        } else if (event.type === 'modify:op') {
          updatePage(page.pageId, (current) => ({
            ...current,
            blocks: current.blocks.map((block, index) => index === event.data.index ? { ...block, status: 'done' } : block),
          }));
        } else if (event.type === 'done') {
          metadata = event.data.metadata;
        } else if (event.type === 'error') {
          throw new Error(event.data.message);
        }
      }
    } catch (error) {
      const message = timeoutController.didTimeout()
        ? `modifyPage timed out after ${Math.round(TOOL_IDLE_TIMEOUT_MS / 1000)}s for ${page.pageName}`
        : error instanceof Error
          ? error.message
          : String(error);
      updatePage(page.pageId, (current) => ({
        ...current,
        status: 'failed',
        error: message,
      }));
      throw new Error(message);
    } finally {
      timeoutController.dispose();
    }

    const nextSchema = await applyModifyOperationsToSchema(
      existingSchema,
      operations
        .filter((event): event is Extract<AgentEvent, { type: 'modify:op' }> => event.type === 'modify:op')
        .map((event) => event.data.operation),
    );
    await writePageSchema(input.fileId, nextSchema);
    setProgressText(`${page.pageName} 修改完成`);
    updatePage(page.pageId, (current) => ({
      ...current,
      status: 'done',
      durationMs: metadata?.durationMs ?? (Date.now() - startedAt),
      fileId: input.fileId,
    }));
    return {
      fileId: input.fileId,
      success: true,
      durationMs: metadata?.durationMs ?? (Date.now() - startedAt),
    };
  }, [bridge, readPageSchema, updatePage, writePageSchema]);

  const proposeProjectPlan = useCallback(async (plan: ProjectPlan) => {
    projectPlanRef.current = plan;
    setProjectPlan(plan);
    setPlanRevisionRequested(false);
    const nextPages = plan.pages.map((page) => ({
      pageId: page.pageId,
      pageName: page.pageName,
      action: page.action,
      description: page.description,
      status: page.action === 'skip' ? 'skipped' : 'waiting',
      blocks: [],
      ...(page.reason ? { reason: page.reason } : {}),
    } satisfies AgentLoopPageProgress));
    pagesRef.current = nextPages;
    pageLookupRef.current = new Map(nextPages.map((page) => [page.pageId, page]));
    setPages(nextPages);
    setMode('loop');
    setPhase('awaiting_confirmation');
    setProgressText('等待用户确认项目规划');
    if (!loopStateRef.current) {
      throw new Error('loop state is missing');
    }
    loopStateRef.current = {
      ...loopStateRef.current,
      status: 'awaiting_confirmation',
      approvedPlan: plan,
      updatedAt: new Date().toISOString(),
    };
    await persistLoopState();
    return new Promise<string>((resolve) => {
      confirmResolverRef.current = resolve;
    });
  }, [persistLoopState]);

  const finalizeLoop = useCallback(async (summary: AgentLoopResultSummary) => {
    const traceFile = await writeAgentLoopTraceDump('success', {
      ...(summary.projectPlan ? { projectPlan: summary.projectPlan } : {}),
      pages: summary.pages,
      createdFileIds: summary.createdFileIds,
      trace: summary.trace,
      ...(summary.loopState ? { loopState: summary.loopState } : {}),
    });
    const finalizedSummary = traceFile
      ? {
          ...summary,
          traceFile,
        }
      : summary;
    setPhase('done');
    setProgressText('Agent Loop 已完成');
    setIsLoopRunning(false);
    setErrorMessage(undefined);
    setLastRunResult(createLoopRunResult(finalizedSummary, Date.now() - startTimeRef.current));
    if (finalizedSummary.createdFileIds.length > 0 && bridge) {
      await bridge.execute('file.openSchema', { fileId: finalizedSummary.createdFileIds[0] });
    }
    await clearPersistedLoopState();
    return finalizedSummary;
  }, [bridge, clearPersistedLoopState]);

  const cancelRun = useCallback(async () => {
    if (mode === 'legacy') {
      await legacy.cancelRun();
      return;
    }
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoopRunning(false);
    setProgressText('已取消');
    setPhase('idle');
    if (loopStateRef.current) {
      loopStateRef.current = {
        ...loopStateRef.current,
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
      };
      await persistLoopState();
    }
  }, [legacy, mode, persistLoopState]);

  const confirmProjectPlan = useCallback(() => {
    if (!loopStateRef.current?.approvedPlan) {
      return;
    }
    loopStateRef.current = {
      ...loopStateRef.current,
      status: 'executing',
      updatedAt: new Date().toISOString(),
    };
    setPhase('executing');
    setProgressText('正在执行项目规划');
    void persistLoopState();
    confirmResolverRef.current?.('用户已确认项目规划');
    confirmResolverRef.current = null;
  }, [persistLoopState]);

  const requestProjectPlanRevision = useCallback(() => {
    setPlanRevisionRequested(true);
    setProgressText('等待用户输入规划修改意见');
  }, []);

  const cancelProjectPlanRevision = useCallback(() => {
    setPlanRevisionRequested(false);
    setProgressText('等待用户确认项目规划');
  }, []);

  const submitProjectPlanRevision = useCallback((text: string) => {
    if (!confirmResolverRef.current) {
      return;
    }
    setPlanRevisionRequested(false);
    setPhase('thinking');
    setProgressText('根据用户意见重新规划项目');
    confirmResolverRef.current(`用户要求修改规划：${text.trim()}`);
    confirmResolverRef.current = null;
  }, []);

  const runAgent = useCallback<ReturnType<typeof useAgentRun>['runAgent']>(async (
    prompt,
    plannerModel,
    blockModel,
    thinkingEnabled,
    conversationId,
    onMessageStart,
    onMessageDelta,
    onDone,
    onError,
    blockConcurrency,
    onRunComplete,
    attachments = [],
  ) => {
    if (!bridge) {
      return;
    }

    if (!isProjectPrompt(prompt, attachments)) {
      setMode('legacy');
      setPhase('idle');
      await legacy.runAgent(
        prompt,
        plannerModel,
        blockModel,
        thinkingEnabled,
        conversationId,
        onMessageStart,
        onMessageDelta,
        onDone,
        onError,
        blockConcurrency,
        (result) => {
          setLastRunResult(result);
          onRunComplete?.(result);
        },
        attachments,
      );
      return;
    }

    const currentConversationId = conversationId ?? `conv-${Date.now()}`;
    setMode('loop');
    setPhase('thinking');
    setIsLoopRunning(true);
    setProgressText('Agent Loop 初始化中');
    setErrorMessage(undefined);
    setLastRunResult(null);
    setPlanRevisionRequested(false);
    startTimeRef.current = Date.now();
    abortControllerRef.current = new AbortController();
    tracerRef.current = new AgentLoopTracer();
    activePlannerModelRef.current = plannerModel;
    activeBlockModelRef.current = blockModel;

    if (isResumePrompt(prompt) && persistedRef.current) {
      loopMessagesRef.current = persistedRef.current.reactMessages;
      loopStateRef.current = persistedRef.current.loopState;
      setProjectPlan(persistedRef.current.projectPlan ?? null);
      setPages(persistedRef.current.pages);
      setSteps(persistedRef.current.trace);
      projectPlanRef.current = persistedRef.current.projectPlan ?? null;
      pagesRef.current = persistedRef.current.pages;
      stepsRef.current = persistedRef.current.trace;
      pageLookupRef.current = new Map(persistedRef.current.pages.map((page) => [page.pageId, page]));
      setProgressText('从上次中断位置继续执行');
    } else {
      const attachmentHint = attachments.length > 0
        ? `\n\n附件：${attachments.map((attachment) => attachment.name).join(', ')}`
        : '';
      loopMessagesRef.current = [
        { role: 'system', content: buildAgentLoopSystemPrompt() },
        { role: 'user', content: `${prompt}${attachmentHint}` },
      ];
      loopStateRef.current = createLoopState(currentConversationId);
      projectPlanRef.current = null;
      pagesRef.current = [];
      stepsRef.current = [];
      setSteps([]);
      setProjectPlan(null);
      setPages([]);
      pageLookupRef.current = new Map();
      await clearPersistedLoopState();
    }

    try {
      for (let iteration = 0; iteration < MAX_LOOP_ITERATIONS; iteration += 1) {
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Agent Loop aborted');
        }
        setPhase(loopStateRef.current?.status === 'executing' ? 'executing' : 'thinking');

        const response = await aiClient.chat({
          model: plannerModel,
          messages: compactMessages(loopMessagesRef.current),
          thinking: { type: thinkingEnabled ? 'enabled' : 'disabled' },
        });

        let parsed: ParsedReActResponse;
        let parseSource = response.content;
        try {
          parsed = parseReActResponse(parseSource);
        } catch (error) {
          const initialError = error instanceof Error ? error.message : String(error);
          const repairPrompt = buildReActRepairPrompt(initialError, response.content);
          try {
            const repairResponse = await aiClient.chat({
              model: plannerModel,
              messages: compactMessages([
                ...loopMessagesRef.current,
                { role: 'assistant', content: response.content },
                {
                  role: 'user',
                  content: repairPrompt,
                },
              ]),
              thinking: { type: 'disabled' },
            });
            parseSource = repairResponse.content;
            parsed = parseReActResponse(parseSource);
          } catch (repairError) {
            const debugFile = await writeAgentLoopDebugDump({
              source: 'agent-loop-react-parse',
              conversationId: currentConversationId,
              plannerModel,
              blockModel,
              thinkingEnabled,
              error: repairError instanceof Error ? repairError.message : String(repairError),
              rawResponse: response.content,
              repairedResponse: parseSource !== response.content ? parseSource : undefined,
              messages: loopMessagesRef.current,
              loopState: loopStateRef.current,
            });
            if (debugFile) {
              throw new Error(`${repairError instanceof Error ? repairError.message : String(repairError)}. Debug file: ${debugFile}`);
            }
            throw repairError;
          }
        }

        loopMessagesRef.current = [
          ...loopMessagesRef.current,
          { role: 'assistant', content: formatParsedReActMessage(parsed) },
        ];

        const step = tracerRef.current?.addStep({
          ...(parsed.status ? { status: parsed.status } : {}),
          ...(parsed.reasoningSummary ? { reasoningSummary: parsed.reasoningSummary } : {}),
          action: parsed.action,
          actionInput: parsed.actionInput,
          ...(response.durationMs !== undefined ? { llmDurationMs: response.durationMs } : {}),
          ...(response.tokensUsed?.input !== undefined ? { tokensInput: response.tokensUsed.input } : {}),
          ...(response.tokensUsed?.output !== undefined ? { tokensOutput: response.tokensUsed.output } : {}),
        });
        const nextSteps = tracerRef.current?.snapshot() ?? [];
        stepsRef.current = nextSteps;
        setSteps(nextSteps);
        setProgressText(parsed.status ?? parsed.reasoningSummary ?? `正在执行 ${parsed.action}`);

        const toolStartedAt = Date.now();
        const observationValue = await executeAgentTool({
          bridge,
          aiClient,
          plannerModel,
          blockModel,
          thinkingEnabled,
          getCurrentConversationId: () => currentConversationId,
          getAvailableComponentsSummary: () => summarizeComponents(bridge),
          listWorkspaceFiles,
          readPageSchema,
          writePageSchema,
          deletePageSchema,
          proposeProjectPlan,
          executeCreatePage,
          executeModifyPage,
        }, parsed.action, parsed.actionInput, pageLookupRef.current);
        const observation = typeof observationValue === 'string'
          ? observationValue
          : JSON.stringify(observationValue, null, 2);
        tracerRef.current?.updateLastObservation(observation, Date.now() - toolStartedAt);
        const tracedSteps = tracerRef.current?.snapshot() ?? [];
        stepsRef.current = tracedSteps;
        setSteps(tracedSteps);

        if (parsed.action === 'createPage') {
          const fileId = typeof observationValue === 'object' && observationValue && 'fileId' in observationValue
            ? String((observationValue as { fileId: unknown }).fileId)
            : undefined;
          if (fileId && loopStateRef.current) {
            const pageId = typeof parsed.actionInput.pageId === 'string' ? parsed.actionInput.pageId : fileId;
            loopStateRef.current.createdFileIds = [...loopStateRef.current.createdFileIds, fileId];
            loopStateRef.current.completedPageIds = [...loopStateRef.current.completedPageIds, pageId];
            delete loopStateRef.current.currentPageId;
          }
        }

        if (parsed.action === 'modifyPage' && loopStateRef.current) {
          const fileId = typeof parsed.actionInput.fileId === 'string' ? parsed.actionInput.fileId : undefined;
          if (fileId) {
            const pageId = typeof parsed.actionInput.pageId === 'string' ? parsed.actionInput.pageId : fileId;
            loopStateRef.current.completedPageIds = [...loopStateRef.current.completedPageIds, pageId];
            delete loopStateRef.current.currentPageId;
          }
        }

        if (loopStateRef.current) {
          loopStateRef.current.lastCompletedAction = parsed.action;
          loopStateRef.current.updatedAt = new Date().toISOString();
        }

        setPages((currentPages) => {
          const nextPages = currentPages.map((page) => pageLookupRef.current.get(page.pageId) ?? page);
          pagesRef.current = nextPages;
          return nextPages;
        });
        await persistLoopState();

        if (parsed.action === 'finish') {
          const summary: AgentLoopResultSummary = {
            ...(projectPlanRef.current ? { projectPlan: projectPlanRef.current } : {}),
            trace: tracerRef.current?.snapshot() ?? [],
            pages: Array.from(pageLookupRef.current.values()),
            createdFileIds: loopStateRef.current?.createdFileIds ?? [],
            ...(loopStateRef.current ? { loopState: loopStateRef.current } : {}),
          };
          const finalizedSummary = await finalizeLoop(summary);
          onDone({
            sessionId: currentConversationId,
            conversationId: currentConversationId,
          });
          onRunComplete?.(createLoopRunResult(finalizedSummary, Date.now() - startTimeRef.current));
          return;
        }

        loopMessagesRef.current = [
          ...loopMessagesRef.current,
          { role: 'user', content: `Observation: ${observation}` },
        ];
      }

      throw new Error(`Agent Loop exceeded ${MAX_LOOP_ITERATIONS} iterations`);
    } catch (error) {
      let message = error instanceof Error ? error.message : String(error);
      tracerRef.current?.updateLastError(message);
      const failedSteps = tracerRef.current?.snapshot() ?? [];
      const traceFile = await writeAgentLoopTraceDump('error', {
        error: message,
        ...(projectPlanRef.current ? { projectPlan: projectPlanRef.current } : {}),
        pages: Array.from(pageLookupRef.current.values()),
        trace: failedSteps,
        messages: loopMessagesRef.current,
        ...(loopStateRef.current ? { loopState: loopStateRef.current } : {}),
      });
      if (traceFile && !message.includes(traceFile)) {
        message = `${message}. Debug file: ${traceFile}`;
      }
      stepsRef.current = failedSteps;
      setSteps(failedSteps);
      setIsLoopRunning(false);
      setPhase('error');
      setErrorMessage(message);
      setProgressText(message);
      if (loopStateRef.current) {
        loopStateRef.current = {
          ...loopStateRef.current,
          status: 'failed',
          updatedAt: new Date().toISOString(),
        };
        await persistLoopState();
      }
      onError(message);
    }
  }, [
    bridge,
    clearPersistedLoopState,
    deletePageSchema,
    executeCreatePage,
    executeModifyPage,
    finalizeLoop,
    legacy,
    listWorkspaceFiles,
    persistLoopState,
    proposeProjectPlan,
    readPageSchema,
    writePageSchema,
  ]);

  return {
    mode,
    phase,
    isRunning: mode === 'legacy' ? legacy.isRunning : isLoopRunning,
    progressText: mode === 'legacy' ? legacy.progressText : progressText,
    elapsedMs: mode === 'legacy' ? legacy.elapsedMs : elapsedMs,
    steps,
    projectPlan,
    pages,
    errorMessage,
    lastRunResult: mode === 'legacy' ? legacy.lastRunResult : lastRunResult,
    legacy,
    planRevisionRequested,
    runAgent,
    cancelRun,
    resetLoopState,
    confirmProjectPlan,
    requestProjectPlanRevision,
    cancelProjectPlanRevision,
    submitProjectPlanRevision,
  };
}
