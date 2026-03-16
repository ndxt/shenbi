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
    input: { pageId: string; pageName: string; prompt: string },
    page: AgentLoopPageProgress,
  ) => {
    if (!bridge) {
      throw new Error('editor bridge unavailable');
    }
    const signal = abortControllerRef.current?.signal;
    const fileId = await ensureUniqueFileId(input.pageId);
    updatePage(page.pageId, (current) => ({
      ...(() => {
        const { error: _error, ...rest } = current;
        return rest;
      })(),
      pageName: input.pageName,
      status: 'running',
      blocks: [],
    }));
    const request: RunRequest = {
      prompt: input.prompt,
      intent: 'schema.create',
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

    for await (const event of aiClient.runStream(request, signal ? { signal } : undefined)) {
      if (event.type === 'plan') {
        updatePage(page.pageId, (current) => ({
          ...current,
          blocks: event.data.blocks.map((block) => ({
            id: block.id,
            label: block.description,
            status: 'waiting',
          })),
        }));
      } else if (event.type === 'schema:block:start') {
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

    if (!finalSchema) {
      throw new Error(`createPage did not produce a final schema for ${input.pageName}`);
    }

    await writePageSchema(fileId, finalSchema);
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
    const signal = abortControllerRef.current?.signal;
    const existingSchema = await readPageSchema(input.fileId);
    updatePage(page.pageId, (current) => ({
      ...(() => {
        const { error: _error, ...rest } = current;
        return rest;
      })(),
      status: 'running',
      blocks: [],
    }));

    const request: RunRequest = {
      prompt: input.prompt,
      intent: 'schema.modify',
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

    for await (const event of aiClient.runStream(request, signal ? { signal } : undefined)) {
      operations.push(event);
      if (event.type === 'modify:start') {
        updatePage(page.pageId, (current) => ({
          ...current,
          blocks: (event.data.operations ?? []).map((operation, index) => ({
            id: String(index),
            label: operation.label ?? operation.op,
            status: 'waiting',
          })),
        }));
      } else if (event.type === 'modify:op:pending') {
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

    const nextSchema = await applyModifyOperationsToSchema(
      existingSchema,
      operations
        .filter((event): event is Extract<AgentEvent, { type: 'modify:op' }> => event.type === 'modify:op')
        .map((event) => event.data.operation),
    );
    await writePageSchema(input.fileId, nextSchema);
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
    setPhase('done');
    setProgressText('Agent Loop 已完成');
    setIsLoopRunning(false);
    setErrorMessage(undefined);
    setLastRunResult(createLoopRunResult(summary, Date.now() - startTimeRef.current));
    if (summary.createdFileIds.length > 0 && bridge) {
      await bridge.execute('file.openSchema', { fileId: summary.createdFileIds[0] });
    }
    await clearPersistedLoopState();
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
        loopMessagesRef.current = [
          ...loopMessagesRef.current,
          { role: 'assistant', content: response.content },
        ];

        let parsed: ParsedReActResponse;
        try {
          parsed = parseReActResponse(response.content);
        } catch (error) {
          const debugFile = await writeAgentLoopDebugDump({
            source: 'agent-loop-react-parse',
            conversationId: currentConversationId,
            plannerModel,
            blockModel,
            thinkingEnabled,
            error: error instanceof Error ? error.message : String(error),
            rawResponse: response.content,
            messages: loopMessagesRef.current,
            loopState: loopStateRef.current,
          });
          if (debugFile) {
            throw new Error(`${error instanceof Error ? error.message : String(error)}. Debug file: ${debugFile}`);
          }
          throw error;
        }

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
          await finalizeLoop(summary);
          onDone({
            sessionId: currentConversationId,
            conversationId: currentConversationId,
          });
          onRunComplete?.(createLoopRunResult(summary, Date.now() - startTimeRef.current));
          return;
        }

        loopMessagesRef.current = [
          ...loopMessagesRef.current,
          { role: 'user', content: `Observation: ${observation}` },
        ];
      }

      throw new Error(`Agent Loop exceeded ${MAX_LOOP_ITERATIONS} iterations`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      tracerRef.current?.updateLastError(message);
      const failedSteps = tracerRef.current?.snapshot() ?? [];
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
