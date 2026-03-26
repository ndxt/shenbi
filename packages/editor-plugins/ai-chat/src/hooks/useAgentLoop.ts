import { useCallback, useEffect, useRef, useState } from 'react';
import { createEditor } from '@shenbi/editor-core';
import type { PluginPersistenceService } from '@shenbi/editor-plugin-api';
import type { PageSchema } from '@shenbi/schema';
import type {
  AIClient,
  AgentEvent,
  ChatRequest,
  ChatResponse,
  FinalizeRequest,
  FinalizeResult,
  LoopSessionState,
  ProjectAgentEvent,
  ProjectCancelRequest,
  ProjectConfirmRequest,
  ProjectPlan,
  ProjectReviseRequest,
  ProjectRunRequest,
  ProjectSessionMutationResult,
  ReActStep,
  RunAttachmentInput,
  RunRequest,
} from '../ai/api-types';
import { aiClient } from '../ai/sse-client';
import type { EditorAIBridge } from '../ai/editor-ai-bridge';
import { AgentLoopTracer } from '../ai/agent-loop-tracer';
import { buildAgentLoopSystemPrompt, executeAgentTool } from '../ai/agent-tools';
import { executeAgentOperation } from '../ai/operation-executor';
import type {
  AgentLoopPageProgress,
  AgentLoopResultSummary,
  PersistedAgentLoopState,
  UIPhase,
} from '../ai/agent-loop-types';
import {
  createPageExecutionSnapshot,
  replaceSkeletonNode,
  runPageExecution,
  type PageExecutionSnapshot,
} from '../ai/page-execution';
import { parseReActResponse, type ParsedReActResponse } from '../ai/react-parser';
import { isProductionEnvironment } from '../utils/env';
import { useAgentRun, type LastRunResult } from './useAgentRun';

const PERSISTENCE_NAMESPACE = 'ai-chat';
const AGENT_LOOP_PERSISTENCE_KEY = 'agent-loop-state';
const MAX_LOOP_ITERATIONS = 30;
const TOOL_IDLE_TIMEOUT_MS = 0; // disabled: no timeout for page creation
const AI_DEBUG_API_BASE = isProductionEnvironment() ? '/locode/shenbi/api/ai/debug' : '/api/ai/debug';
const AGENT_LOOP_ABORTED_ERROR = 'Agent Loop aborted';

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

function isResumeWithPersistedState(prompt: string): boolean {
  return isResumePrompt(prompt);
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
    if (timeoutMs <= 0) return; // timeout disabled
    if (timeoutMs <= 0) return; // timeout disabled
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
    const response = await fetch(`${AI_DEBUG_API_BASE}/client-error`, {
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
    const response = await fetch(`${AI_DEBUG_API_BASE}/trace`, {
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
    '请基于同一上下文，立刻重新输出合法的下一步。',
    '你的回复必须是一个 JSON 对象，包含 action 和 actionInput 字段。',
    '示例：{"action":"listWorkspaceFiles","actionInput":{}}',
    '不要解释，不要重复 reasoning，不要返回数组或其他非对象类型。',
    '',
    '这是你刚才的错误回复：',
    invalidResponse,
  ].join('\n');
}

function formatParsedReActMessage(parsed: ParsedReActResponse): string {
  const obj: Record<string, unknown> = {
    action: parsed.action,
    actionInput: parsed.actionInput,
  };
  if (parsed.status) {
    obj.status = parsed.status;
  }
  if (parsed.reasoningSummary) {
    obj.reasoningSummary = parsed.reasoningSummary;
  }
  return JSON.stringify(obj);
}

function isAgentLoopAbortError(error: unknown): boolean {
  return error instanceof Error && error.message === AGENT_LOOP_ABORTED_ERROR;
}

class QueuedPageAIClient implements AIClient {
  private readonly events: AgentEvent[] = [];
  private readonly waiters: Array<(result: IteratorResult<AgentEvent, undefined>) => void> = [];
  private closed = false;
  private error: unknown;

  push(event: AgentEvent): void {
    if (this.closed) {
      return;
    }
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value: event, done: false });
      return;
    }
    this.events.push(event);
    if (event.type === 'done' || event.type === 'error') {
      this.close();
    }
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    while (this.waiters.length > 0) {
      this.waiters.shift()?.({ value: undefined, done: true });
    }
  }

  fail(error: unknown): void {
    this.error = error;
    this.close();
  }

  private async nextEvent(): Promise<IteratorResult<AgentEvent, undefined>> {
    if (this.events.length > 0) {
      return { value: this.events.shift() as AgentEvent, done: false };
    }
    if (this.error) {
      throw this.error;
    }
    if (this.closed) {
      return { value: undefined, done: true };
    }
    return new Promise<IteratorResult<AgentEvent, undefined>>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  async *runStream(_request: RunRequest): AsyncIterable<AgentEvent> {
    while (true) {
      const next = await this.nextEvent();
      if (next.done) {
        return;
      }
      yield next.value;
    }
  }

  async chat(_request: ChatRequest): Promise<ChatResponse> {
    throw new Error('QueuedPageAIClient does not support chat');
  }

  async *chatStream() {
    throw new Error('QueuedPageAIClient does not support chatStream');
  }

  async finalize(_request: FinalizeRequest): Promise<FinalizeResult> {
    return {};
  }

  async classifyRoute() {
    return { scope: 'single-page' as const, intent: 'schema.create' as const, confidence: 1 };
  }

  async *projectStream(_request: ProjectRunRequest): AsyncIterable<ProjectAgentEvent> {
    throw new Error('QueuedPageAIClient does not support projectStream');
  }

  async projectConfirm(_request: ProjectConfirmRequest): Promise<ProjectSessionMutationResult> {
    throw new Error('QueuedPageAIClient does not support projectConfirm');
  }

  async projectRevise(_request: ProjectReviseRequest): Promise<ProjectSessionMutationResult> {
    throw new Error('QueuedPageAIClient does not support projectRevise');
  }

  async projectCancel(_request: ProjectCancelRequest): Promise<ProjectSessionMutationResult> {
    throw new Error('QueuedPageAIClient does not support projectCancel');
  }
}

export function buildExecutionFallbackAction(
  loopState: LoopSessionState | undefined,
  pages: AgentLoopPageProgress[],
): ParsedReActResponse | undefined {
  if (!loopState || loopState.status !== 'executing' || !loopState.approvedPlan) {
    return undefined;
  }

  const nextPage = pages.find((page) => page.status === 'waiting' && (page.action === 'create' || page.action === 'modify'));
  if (nextPage) {
    if (nextPage.action === 'create') {
      const actionInput = {
        pageId: nextPage.pageId,
        pageName: nextPage.pageName,
        ...(nextPage.prompt ? { prompt: nextPage.prompt } : { description: nextPage.description }),
        ...(nextPage.evidence ? { evidence: nextPage.evidence } : {}),
      };
      return {
        reasoningSummary: '按已确认规划继续执行下一页',
        action: 'createPage',
        actionInput,
        rawActionInput: JSON.stringify(actionInput),
      };
    }

    const actionInput = {
      fileId: nextPage.fileId ?? nextPage.pageId,
      pageName: nextPage.pageName,
      ...(nextPage.prompt ? { prompt: nextPage.prompt } : { description: nextPage.description }),
      ...(nextPage.evidence ? { evidence: nextPage.evidence } : {}),
    };
    return {
      reasoningSummary: '按已确认规划继续执行下一页',
      action: 'modifyPage',
      actionInput,
      rawActionInput: JSON.stringify(actionInput),
    };
  }

  const unfinishedPages = pages.filter((page) => ['waiting', 'running'].includes(page.status));
  if (unfinishedPages.length > 0) {
    return undefined;
  }

  const hasFailedPage = pages.some((page) => page.status === 'failed');
  const actionInput = {
    summary: hasFailedPage ? '项目执行结束，部分页面失败' : '项目执行完成',
  };
  return {
    reasoningSummary: hasFailedPage ? '没有可继续执行的页面，结束本轮项目执行' : '所有计划页面已完成，结束本轮项目执行',
    action: 'finish',
    actionInput,
    rawActionInput: JSON.stringify(actionInput),
  };
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

interface ProjectPageExecutionHandle {
  pageId: string;
  queueClient: QueuedPageAIClient;
  promise: Promise<Record<string, unknown>>;
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
  const activeProjectSessionIdRef = useRef<string | null>(null);
  const projectPageHandlesRef = useRef<Map<string, ProjectPageExecutionHandle>>(new Map());
  const confirmResolverRef = useRef<((observation: string) => void) | null>(null);
  const activePlannerModelRef = useRef<string>('');
  const activeBlockModelRef = useRef<string>('');
  const activeThinkingEnabledRef = useRef(false);
  const activeBlockConcurrencyRef = useRef(3);
  const groupFolderMapRef = useRef<Map<string, string>>(new Map());

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
        activeProjectSessionIdRef.current = value.loopState.projectSessionId ?? null;
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
    activeThinkingEnabledRef.current = false;
    activeBlockConcurrencyRef.current = 3;
    groupFolderMapRef.current = new Map();
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
    activeProjectSessionIdRef.current = null;
    projectPageHandlesRef.current = new Map();
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

  const setPageExecutionSnapshot = useCallback((pageId: string, snapshot: PageExecutionSnapshot, expanded = true) => {
    updatePage(pageId, (current) => ({
      ...current,
      execution: snapshot,
      expanded,
    }));
  }, [updatePage]);

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

  const syncPageTabState = useCallback(async (
    fileId: string,
    pageName: string,
    options: {
      schema?: PageSchema;
      isGenerating: boolean;
      readOnlyReason?: string;
    },
  ) => {
    if (!bridge) {
      throw new Error('editor bridge unavailable');
    }
    if (options.schema) {
      await writePageSchema(fileId, options.schema);
    }
    const syncResult = await bridge.execute('tab.syncState', {
      fileId,
      ...(options.schema ? { schema: options.schema } : {}),
      isDirty: false,
      isGenerating: options.isGenerating,
      readOnlyReason: options.readOnlyReason,
      generationUpdatedAt: Date.now(),
    });
    if (!syncResult.success) {
      throw new Error(syncResult.error ?? `Failed to sync tab state for ${pageName}`);
    }
  }, [bridge, writePageSchema]);

  const openGeneratingPageTab = useCallback(async (
    fileId: string,
    pageName: string,
    schema?: PageSchema,
  ) => {
    if (!bridge) {
      throw new Error('editor bridge unavailable');
    }
    const openResult = await bridge.execute('tab.open', { fileId });
    if (!openResult.success) {
      throw new Error(openResult.error ?? `Failed to open tab for ${pageName}`);
    }
    await syncPageTabState(fileId, pageName, {
      ...(schema ? { schema } : {}),
      isGenerating: true,
      readOnlyReason: `AI 正在生成 ${pageName}`,
    });
  }, [bridge, syncPageTabState]);

  const createBackgroundPageSession = useCallback((initialSchema: PageSchema): {
    getSchema: () => PageSchema;
    replaceSchema: (schema: PageSchema) => Promise<void>;
    applyOperation: (operation: Parameters<typeof executeAgentOperation>[1]) => Promise<void>;
    destroy: () => void;
  } => {
    const backgroundEditor = createEditor({
      initialSchema,
    });

    const executeHiddenCommand = async (commandId: string, args?: unknown) => {
      const data = await backgroundEditor.commands.execute(commandId, args);
      return { success: true as const, data };
    };

    const hiddenBridge: EditorAIBridge = {
      getSchema: () => backgroundEditor.state.getSchema(),
      getSelectedNodeId: () => backgroundEditor.state.getSelectedNodeId(),
      getAvailableComponents: () => bridge?.getAvailableComponents() ?? [],
      execute: async (commandId, args) => {
        try {
          return await executeHiddenCommand(commandId, args);
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
      replaceSchema: (schema) => {
        void backgroundEditor.commands.execute('schema.replace', { schema });
      },
      appendBlock: async (node, parentTreeId) => hiddenBridge.execute('node.append', { node, parentTreeId }),
      removeNode: async (treeId) => hiddenBridge.execute('node.remove', { treeId }),
      subscribe: () => () => undefined,
    };

    return {
      getSchema: () => backgroundEditor.state.getSchema(),
      replaceSchema: async (schema) => {
        await backgroundEditor.commands.execute('schema.replace', { schema });
      },
      applyOperation: async (operation) => {
        const result = await executeAgentOperation(hiddenBridge, operation);
        if (!result.success) {
          throw new Error(result.error ?? 'modify operation failed');
        }
      },
      destroy: () => {
        backgroundEditor.destroy();
      },
    };
  }, [bridge]);

  const executeCreatePage = useCallback(async (
    input: { pageId: string; pageName: string; prompt: string; fileId?: string },
    page: AgentLoopPageProgress,
    client: AIClient = aiClient,
  ) => {
    if (!bridge) {
      throw new Error('editor bridge unavailable');
    }
    const parentSignal = abortControllerRef.current?.signal;
    const timeoutController = createIdleTimeoutSignal(parentSignal);
    let fileId = await ensureUniqueFileId(input.fileId ?? input.pageId);
    const initialSchema: PageSchema = {
      id: fileId,
      name: input.pageName,
      body: [],
    };
    updatePage(page.pageId, (current) => ({
      ...(() => {
        const { error: _error, ...rest } = current;
        return rest;
      })(),
      pageName: input.pageName,
      fileId,
      status: 'running',
      expanded: true,
      execution: {
        ...createPageExecutionSnapshot('create'),
        progressText: `正在创建页面 ${input.pageName}`,
      },
    }));
    setProgressText(`正在创建页面 ${input.pageName}`);
    const startedAt = Date.now();
    const session = createBackgroundPageSession(initialSchema);
    let tabReady = false;
    try {
      // Ensure the group folder exists (create on first use)
      let folderParentId: string | undefined;
      if (page.group && page.group.trim()) {
        folderParentId = groupFolderMapRef.current.get(page.group);
        if (!folderParentId) {
          const folderResult = await bridge.execute('fs.createFolder', { name: page.group });
          if (folderResult.success && folderResult.data && typeof (folderResult.data as { id?: unknown }).id === 'string') {
            folderParentId = (folderResult.data as { id: string }).id;
            groupFolderMapRef.current.set(page.group, folderParentId);
            // Ask host to expand the new folder in the file tree
            void bridge.execute('fileTree.expand', { fileId: folderParentId }).catch(() => undefined);
          }
        }
      }
      const createFileResult = await bridge.execute('fs.createFile', {
        parentId: folderParentId ?? null,
        name: input.pageName,
        fileType: 'page',
        content: initialSchema,
      });
      if (!createFileResult.success) {
        throw new Error(createFileResult.error ?? `Failed to create workspace file for ${input.pageName}`);
      }

      if (typeof createFileResult.data === 'string' && createFileResult.data.trim()) {
        fileId = createFileResult.data.trim();
      } else if (
        createFileResult.data
        && typeof createFileResult.data === 'object'
        && 'id' in createFileResult.data
        && typeof (createFileResult.data as { id: unknown }).id === 'string'
      ) {
        fileId = String((createFileResult.data as { id: unknown }).id);
      } else {
        throw new Error(`fs.createFile returned no file id for ${input.pageName}`);
      }

      const openedSchema: PageSchema = {
        ...initialSchema,
        id: fileId,
      };
      await openGeneratingPageTab(fileId, input.pageName, openedSchema);
      tabReady = true;
      updatePage(page.pageId, (current) => ({
        ...current,
        fileId,
      }));

      const workspaceFileIds = (await listWorkspaceFiles()).map((file) => file.id);
      const request: RunRequest = {
        prompt: input.prompt,
        intent: 'schema.create',
        ...(activePlannerModelRef.current ? { plannerModel: activePlannerModelRef.current } : {}),
        ...(activeBlockModelRef.current ? { blockModel: activeBlockModelRef.current } : {}),
        thinking: { type: activeThinkingEnabledRef.current ? 'enabled' : 'disabled' },
        blockConcurrency: activeBlockConcurrencyRef.current,
        context: {
          schemaSummary: 'pageId=empty; pageName=empty; nodeCount=0',
          componentSummary: summarizeComponents(bridge),
          schemaJson: openedSchema,
          workspaceFileIds,
        },
      };

      const executionResult = await runPageExecution({
        aiClient: client,
        request,
        signal: timeoutController.signal,
        initialMode: 'create',
        callbacks: {
          onSnapshot: async (snapshot) => {
            timeoutController.refresh();
            setPageExecutionSnapshot(page.pageId, snapshot, true);
            setProgressText(snapshot.progressText || `正在创建页面 ${input.pageName}`);
          },
          onSchemaSkeleton: async (schema) => {
            timeoutController.refresh();
            await session.replaceSchema(schema);
            await syncPageTabState(fileId, input.pageName, {
              schema,
              isGenerating: true,
              readOnlyReason: `AI 正在生成 ${input.pageName}`,
            });
          },
          onSchemaBlock: async (data) => {
            timeoutController.refresh();
            const nextSchema = replaceSkeletonNode(session.getSchema(), data.blockId, data.node);
            await session.replaceSchema(nextSchema);
            await syncPageTabState(fileId, input.pageName, {
              schema: nextSchema,
              isGenerating: true,
              readOnlyReason: `AI 正在生成 ${input.pageName}`,
            });
          },
          onSchemaDone: async (schema) => {
            timeoutController.refresh();
            await session.replaceSchema(schema);
            await syncPageTabState(fileId, input.pageName, {
              schema,
              isGenerating: true,
              readOnlyReason: `AI 正在生成 ${input.pageName}`,
            });
          },
        },
      });
      const finalSchema = executionResult.finalSchema
        ? {
          ...executionResult.finalSchema,
          id: fileId,
          name: input.pageName,
        }
        : {
          ...session.getSchema(),
          id: fileId,
          name: input.pageName,
        };
      const metadata = executionResult.metadata;

      await syncPageTabState(fileId, input.pageName, {
        schema: finalSchema,
        isGenerating: false,
      });
      const completedSnapshot: PageExecutionSnapshot = {
        ...executionResult.snapshot,
        finalSchema,
        progressText: `${input.pageName} 已写入工作区`,
      };
      setPageExecutionSnapshot(page.pageId, completedSnapshot, true);
      setProgressText(`${input.pageName} 已写入工作区`);
      updatePage(page.pageId, (current) => ({
        ...current,
        fileId,
        status: 'done',
        durationMs: metadata?.durationMs ?? (Date.now() - startedAt),
        execution: completedSnapshot,
        expanded: false,
      }));
      return {
        fileId,
        success: true,
        durationMs: metadata?.durationMs ?? (Date.now() - startedAt),
      };
    } catch (error) {
      const message = timeoutController.didTimeout()
        ? `createPage timed out after ${Math.round(TOOL_IDLE_TIMEOUT_MS / 1000)}s for ${input.pageName}`
        : error instanceof Error
          ? error.message
          : String(error);
      const fallbackSchema = session.getSchema();
      if (tabReady && fallbackSchema) {
        await syncPageTabState(fileId, input.pageName, {
          schema: {
            ...fallbackSchema,
            id: fileId,
            name: input.pageName,
          },
          isGenerating: false,
        }).catch(() => undefined);
      }
      updatePage(page.pageId, (current) => ({
        ...current,
        fileId,
        status: 'failed',
        error: message,
        expanded: true,
      }));
      throw new Error(message);
    } finally {
      session.destroy();
      timeoutController.dispose();
    }
  }, [bridge, createBackgroundPageSession, ensureUniqueFileId, openGeneratingPageTab, setPageExecutionSnapshot, syncPageTabState, updatePage]);

  const executeModifyPage = useCallback(async (
    input: { fileId: string; prompt: string; pageName?: string },
    page: AgentLoopPageProgress,
    client: AIClient = aiClient,
  ) => {
    if (!bridge) {
      throw new Error('editor bridge unavailable');
    }
    const parentSignal = abortControllerRef.current?.signal;
    const timeoutController = createIdleTimeoutSignal(parentSignal);
    const existingSchema = await readPageSchema(input.fileId);
    const session = createBackgroundPageSession(existingSchema);
    updatePage(page.pageId, (current) => ({
      ...(() => {
        const { error: _error, ...rest } = current;
        return rest;
      })(),
      status: 'running',
      expanded: true,
      execution: {
        ...createPageExecutionSnapshot('modify'),
        progressText: `正在修改页面 ${page.pageName}`,
      },
    }));
    setProgressText(`正在修改页面 ${page.pageName}`);

    const workspaceFileIds = (await listWorkspaceFiles()).map((file) => file.id);
    const request: RunRequest = {
      prompt: input.prompt,
      intent: 'schema.modify',
      ...(activePlannerModelRef.current ? { plannerModel: activePlannerModelRef.current } : {}),
      ...(activeBlockModelRef.current ? { blockModel: activeBlockModelRef.current } : {}),
      thinking: { type: activeThinkingEnabledRef.current ? 'enabled' : 'disabled' },
      blockConcurrency: activeBlockConcurrencyRef.current,
      context: {
        schemaSummary: summarizeSchema(existingSchema),
        componentSummary: summarizeComponents(bridge),
        schemaJson: existingSchema,
        workspaceFileIds,
      },
    };

    const startedAt = Date.now();
    try {
      await openGeneratingPageTab(input.fileId, page.pageName, existingSchema);
      const executionResult = await runPageExecution({
        aiClient: client,
        request,
        signal: timeoutController.signal,
        initialMode: 'modify',
        callbacks: {
          onSnapshot: async (snapshot) => {
            timeoutController.refresh();
            setPageExecutionSnapshot(page.pageId, snapshot, true);
            setProgressText(snapshot.progressText || `正在修改页面 ${page.pageName}`);
          },
          onModifyOperation: async (data) => {
            timeoutController.refresh();
            await session.applyOperation(data.operation);
            await syncPageTabState(input.fileId, page.pageName, {
              schema: session.getSchema(),
              isGenerating: true,
              readOnlyReason: `AI 正在生成 ${page.pageName}`,
            });
          },
        },
      });

      const nextSchema = session.getSchema();
      await syncPageTabState(input.fileId, page.pageName, {
        schema: nextSchema,
        isGenerating: false,
      });
      const completedSnapshot: PageExecutionSnapshot = {
        ...executionResult.snapshot,
        finalSchema: nextSchema,
        progressText: `${page.pageName} 修改完成`,
      };
      setPageExecutionSnapshot(page.pageId, completedSnapshot, true);
      setProgressText(`${page.pageName} 修改完成`);
      updatePage(page.pageId, (current) => ({
        ...current,
        status: 'done',
        durationMs: executionResult.metadata?.durationMs ?? (Date.now() - startedAt),
        fileId: input.fileId,
        execution: completedSnapshot,
        expanded: false,
      }));
      return {
        fileId: input.fileId,
        success: true,
        durationMs: executionResult.metadata?.durationMs ?? (Date.now() - startedAt),
      };
    } catch (error) {
      const message = timeoutController.didTimeout()
        ? `modifyPage timed out after ${Math.round(TOOL_IDLE_TIMEOUT_MS / 1000)}s for ${page.pageName}`
        : error instanceof Error
          ? error.message
          : String(error);
      await syncPageTabState(input.fileId, page.pageName, {
        schema: session.getSchema(),
        isGenerating: false,
      }).catch(() => undefined);
      updatePage(page.pageId, (current) => ({
        ...current,
        status: 'failed',
        error: message,
        expanded: true,
      }));
      throw new Error(message);
    } finally {
      session.destroy();
      timeoutController.dispose();
    }
  }, [bridge, createBackgroundPageSession, openGeneratingPageTab, readPageSchema, setPageExecutionSnapshot, syncPageTabState, updatePage]);

  const proposeProjectPlan = useCallback(async (plan: ProjectPlan) => {
    projectPlanRef.current = plan;
    setProjectPlan(plan);
    setPlanRevisionRequested(false);
    const nextPages = plan.pages.map((page) => ({
      pageId: page.pageId,
      pageName: page.pageName,
      action: page.action,
      description: page.description,
      ...(page.group ? { group: page.group } : {}),
      ...(page.prompt ? { prompt: page.prompt } : {}),
      ...(page.evidence ? { evidence: page.evidence } : {}),
      status: page.action === 'skip' ? 'skipped' : 'waiting',
      expanded: false,
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
    await clearPersistedLoopState();
    return finalizedSummary;
  }, [clearPersistedLoopState]);

  const cancelRun = useCallback(async () => {
    if (mode === 'legacy') {
      await legacy.cancelRun();
      return;
    }
    const activeProjectSessionId = activeProjectSessionIdRef.current;
    if (activeProjectSessionId) {
      await aiClient.projectCancel({ sessionId: activeProjectSessionId }).catch(() => undefined);
    }
    abortControllerRef.current?.abort();
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
    const activeProjectSessionId = activeProjectSessionIdRef.current;
    if (!loopStateRef.current?.approvedPlan || !activeProjectSessionId) {
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
    void aiClient.projectConfirm({ sessionId: activeProjectSessionId }).catch((error) => {
      setPhase('error');
      setErrorMessage(error instanceof Error ? error.message : String(error));
    });
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
    const activeProjectSessionId = activeProjectSessionIdRef.current;
    if (!activeProjectSessionId || !text.trim()) {
      return;
    }
    setPlanRevisionRequested(false);
    setPhase('thinking');
    setProgressText('根据用户意见重新规划项目');
    void aiClient.projectRevise({
      sessionId: activeProjectSessionId,
      revisionPrompt: text.trim(),
    }).catch((error) => {
      setPhase('error');
      setErrorMessage(error instanceof Error ? error.message : String(error));
    });
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

    // Store the prepared prompt (with doc text) for use in the loop user message
    let loopUserPrompt = prompt;

    if (isResumeWithPersistedState(prompt) && persistedRef.current) {
      // fall through to loop mode below — use persisted messages
    } else {
      // Let the LLM decide: single-page or multi-page?
      setProgressText('正在分析请求类型...');
      try {
        const currentSchema = bridge.getSchema();
        const classification = await aiClient.classifyRoute({
          prompt,
          ...(attachments.length > 0 ? { attachments } : {}),
          ...(plannerModel ? { plannerModel } : {}),
          thinking: { type: thinkingEnabled ? 'enabled' : 'disabled' },
          context: {
            schemaSummary: summarizeSchema(currentSchema),
          },
        });
        // Use the server-prepared prompt (with embedded document text) if available
        if (classification.preparedPrompt) {
          loopUserPrompt = classification.preparedPrompt;
        }
        if (classification.scope !== 'multi-page') {
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
      } catch (classifyError) {
        // Classification failed — fallback to legacy single-page path
        console.warn('[agent-loop] classifyRoute failed, falling back to legacy:', classifyError);
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
    }

    const ensureTabResult = await bridge.execute('shell.ensureCurrentTab');
    if (!ensureTabResult.success && ensureTabResult.error !== 'Command not found: shell.ensureCurrentTab') {
      console.warn('[agent-loop] failed to materialize current shell tab before project generation:', ensureTabResult.error);
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
    activeThinkingEnabledRef.current = thinkingEnabled;
    activeBlockConcurrencyRef.current = typeof blockConcurrency === 'number' ? blockConcurrency : 3;

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
      // loopUserPrompt already contains embedded document text if docs were attached.
      // Only append the attachment hint (file names) when doc text was NOT embedded.
      const hasEmbeddedDocText = loopUserPrompt !== prompt;
      const attachmentHint = !hasEmbeddedDocText && attachments.length > 0
        ? `\n\n附件：${attachments.map((attachment) => attachment.name).join(', ')}`
        : '';
      loopMessagesRef.current = [
        { role: 'system', content: buildAgentLoopSystemPrompt() },
        { role: 'user', content: `${loopUserPrompt}${attachmentHint}` },
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
      const currentSchema = bridge.getSchema();
      const workspaceFiles = await listWorkspaceFiles();
      const workspace = {
        componentSummary: summarizeComponents(bridge),
        ...(currentSchema.id ? { currentFileId: currentSchema.id } : {}),
        currentSchemaSummary: summarizeSchema(currentSchema),
        currentSchemaJson: currentSchema,
        files: await Promise.all(workspaceFiles.map(async (file) => {
          const schema = await readPageSchema(file.id);
          return {
            fileId: file.id,
            pageName: schema.name ?? file.name,
            schemaSummary: summarizeSchema(schema),
            schemaJson: schema,
          };
        })),
      };

      const projectRequest: ProjectRunRequest = {
        prompt: loopUserPrompt,
        ...(attachments.length > 0 ? { attachments } : {}),
        ...(plannerModel ? { plannerModel } : {}),
        ...(blockModel ? { blockModel } : {}),
        ...(currentConversationId ? { conversationId: currentConversationId } : {}),
        thinking: { type: thinkingEnabled ? 'enabled' : 'disabled' },
        workspace,
      };

      for await (const event of aiClient.projectStream(projectRequest, {
        signal: abortControllerRef.current?.signal,
      })) {
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error(AGENT_LOOP_ABORTED_ERROR);
        }

        switch (event.type) {
          case 'project:start':
            activeProjectSessionIdRef.current = event.data.sessionId;
            if (loopStateRef.current) {
              loopStateRef.current = {
                ...loopStateRef.current,
                projectSessionId: event.data.sessionId,
                updatedAt: new Date().toISOString(),
              };
              await persistLoopState();
            }
            setProgressText('正在规划项目');
            break;

          case 'project:plan':
            await proposeProjectPlan(event.data.plan);
            break;

          case 'project:awaiting_confirmation':
            setPhase('awaiting_confirmation');
            setProgressText('等待用户确认项目规划');
            break;

          case 'project:page:start': {
            const page = pageLookupRef.current.get(event.data.page.pageId)
              ?? {
                pageId: event.data.page.pageId,
                pageName: event.data.page.pageName,
                action: event.data.page.action,
                description: event.data.page.description,
                ...(event.data.page.group ? { group: event.data.page.group } : {}),
                ...(event.data.page.prompt ? { prompt: event.data.page.prompt } : {}),
                ...(event.data.page.evidence ? { evidence: event.data.page.evidence } : {}),
                status: 'waiting' as const,
              };
            const queueClient = new QueuedPageAIClient();
            const executionPromise = event.data.page.action === 'modify'
              ? executeModifyPage({
                fileId: event.data.page.fileId ?? event.data.page.pageId,
                prompt: event.data.page.prompt ?? event.data.page.description,
                ...(event.data.page.pageName ? { pageName: event.data.page.pageName } : {}),
              }, page, queueClient)
              : executeCreatePage({
                pageId: event.data.page.pageId,
                pageName: event.data.page.pageName,
                prompt: event.data.page.prompt ?? event.data.page.description,
                ...(event.data.page.fileId ? { fileId: event.data.page.fileId } : {}),
              }, page, queueClient);

            projectPageHandlesRef.current.set(event.data.page.pageId, {
              pageId: event.data.page.pageId,
              queueClient,
              promise: executionPromise,
            });
            setPhase('executing');
            setProgressText(`正在执行 ${event.data.page.pageName}`);
            break;
          }

          case 'project:page:event': {
            const handle = projectPageHandlesRef.current.get(event.data.pageId);
            handle?.queueClient.push(event.data.event);
            break;
          }

          case 'project:page:done': {
            const handle = projectPageHandlesRef.current.get(event.data.pageId);
            if (handle) {
              await handle.promise;
              projectPageHandlesRef.current.delete(event.data.pageId);
            }
            if (loopStateRef.current) {
              loopStateRef.current = {
                ...loopStateRef.current,
                completedPageIds: Array.from(new Set([
                  ...loopStateRef.current.completedPageIds,
                  event.data.pageId,
                ])),
                ...(event.data.fileId
                  ? {
                      createdFileIds: Array.from(new Set([
                        ...loopStateRef.current.createdFileIds,
                        event.data.fileId,
                      ])),
                    }
                  : {}),
                updatedAt: new Date().toISOString(),
              };
              await persistLoopState();
            }
            break;
          }

          case 'project:done': {
            await Promise.all(Array.from(projectPageHandlesRef.current.values()).map((handle) => handle.promise));
            projectPageHandlesRef.current.clear();
            if (loopStateRef.current) {
              loopStateRef.current = {
                ...loopStateRef.current,
                status: 'done',
                createdFileIds: event.data.createdFileIds,
                completedPageIds: event.data.completedPageIds,
                updatedAt: new Date().toISOString(),
              };
            }
            const summary: AgentLoopResultSummary = {
              ...(projectPlanRef.current ? { projectPlan: projectPlanRef.current } : {}),
              trace: [],
              pages: Array.from(pageLookupRef.current.values()),
              createdFileIds: event.data.createdFileIds,
              ...(loopStateRef.current ? { loopState: loopStateRef.current } : {}),
            };
            const finalizedSummary = await finalizeLoop(summary);
            onDone({
              sessionId: activeProjectSessionIdRef.current ?? currentConversationId,
              conversationId: currentConversationId,
            });
            onRunComplete?.(createLoopRunResult(finalizedSummary, Date.now() - startTimeRef.current));
            return;
          }

          case 'project:error':
            throw new Error(event.data.message);
        }
      }
    } catch (error) {
      if (isAgentLoopAbortError(error)) {
        abortControllerRef.current = null;
        setIsLoopRunning(false);
        setPhase('idle');
        setErrorMessage(undefined);
        setProgressText('已取消');
        return;
      }
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
    executeCreatePage,
    executeModifyPage,
    finalizeLoop,
    legacy,
    listWorkspaceFiles,
    persistLoopState,
    proposeProjectPlan,
    readPageSchema,
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
