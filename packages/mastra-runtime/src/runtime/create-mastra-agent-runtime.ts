import {
  buildRuntimeContext,
  finalizeAgentSessionMemory,
  classifyIntentByRules,
  type AgentMemoryAttachment,
  type AgentRuntimeContext,
  type AgentRuntimeDeps,
  type IntentClassification,
  type RunRequest,
} from '@shenbi/ai-agents';
import type {
  AgentEvent,
  AgentIntent,
  ChatRequest,
  ChatResponse,
  ClassifyRouteRequest,
  ClassifyRouteResponse,
  FinalizeRequest,
  FinalizeResult,
  ModelInfo,
  ProjectAgentEvent,
  ProjectCancelRequest,
  ProjectConfirmRequest,
  ProjectReviseRequest,
  ProjectRunRequest,
  ProjectSessionMutationResult,
  RunMetadata,
} from '@shenbi/ai-contracts';
import {
  createPageCreateWorkflow,
  createPageModifyWorkflow,
} from './workflows';
import { createProjectWorkflowRuntime } from './project-service';

export interface MastraAgentRuntime {
  run(request: RunRequest): Promise<{ events: AgentEvent[]; metadata: RunMetadata }>;
  runStream(request: RunRequest): AsyncIterable<AgentEvent>;
  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream(request: ChatRequest): AsyncIterable<{ delta: string }>;
  classifyRoute(request: ClassifyRouteRequest): Promise<ClassifyRouteResponse>;
  finalize(request: FinalizeRequest): Promise<FinalizeResult>;
  listModels(): Promise<ModelInfo[]> | ModelInfo[];
  writeClientDebug(input: {
    error: unknown;
    requestId?: string;
    method?: string;
    path?: string;
    request?: unknown;
  }): Promise<string> | string;
  writeTraceDebug(input: {
    status: 'success' | 'error';
    trace: unknown;
  }): Promise<string> | string;
  projectStream(request: ProjectRunRequest): AsyncIterable<ProjectAgentEvent>;
  confirmProject(request: ProjectConfirmRequest): Promise<ProjectSessionMutationResult>;
  reviseProject(request: ProjectReviseRequest): Promise<ProjectSessionMutationResult>;
  cancelProject(request: ProjectCancelRequest): Promise<ProjectSessionMutationResult>;
}

export interface CreateMastraAgentRuntimeOptions {
  legacyRuntime: MastraAgentRuntime;
  createDeps: () => AgentRuntimeDeps;
  prepareRunRequest: (request: RunRequest) => Promise<RunRequest>;
  writeMemoryDump?: (input: { category: 'finalize'; memory: unknown }) => string;
  listModels: () => Promise<ModelInfo[]> | ModelInfo[];
  writeClientDebug: (input: {
    error: unknown;
    requestId?: string;
    method?: string;
    path?: string;
    request?: unknown;
  }) => Promise<string> | string;
  writeTraceDebug: (input: {
    status: 'success' | 'error';
    trace: unknown;
  }) => Promise<string> | string;
}

const PAGE_STREAM_INTENTS: ReadonlySet<AgentIntent> = new Set(['schema.create', 'schema.modify']);

class AsyncEventQueue<T> implements AsyncIterable<T> {
  private readonly items: T[] = [];
  private readonly waiters: Array<(result: IteratorResult<T>) => void> = [];
  private closed = false;
  private error: unknown;

  push(item: T): void {
    if (this.closed) {
      return;
    }
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value: item, done: false });
      return;
    }
    this.items.push(item);
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.({ value: undefined as T, done: true });
    }
  }

  fail(error: unknown): void {
    this.error = error;
    this.close();
  }

  async next(): Promise<IteratorResult<T>> {
    if (this.items.length > 0) {
      return { value: this.items.shift() as T, done: false };
    }
    if (this.error) {
      throw this.error;
    }
    if (this.closed) {
      return { value: undefined as T, done: true };
    }
    return new Promise<IteratorResult<T>>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => this.next(),
    };
  }
}

function createSessionId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getOriginalPrompt(request: RunRequest): string {
  const originalPrompt = (request as RunRequest & { _originalPrompt?: unknown })._originalPrompt;
  return typeof originalPrompt === 'string' ? originalPrompt : request.prompt;
}

function getMemoryAttachments(request: RunRequest): AgentMemoryAttachment[] | undefined {
  const internalAttachments = (request as RunRequest & { _memoryAttachments?: unknown })._memoryAttachments;
  if (Array.isArray(internalAttachments)) {
    return internalAttachments as AgentMemoryAttachment[];
  }
  if (!request.attachments || request.attachments.length === 0) {
    return undefined;
  }
  return request.attachments.map((attachment) => ({
    id: attachment.id,
    kind: attachment.kind,
    name: attachment.name,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
  }));
}

function extractMetadata(events: AgentEvent[]): RunMetadata {
  const doneEvent = [...events]
    .reverse()
    .find((event): event is Extract<AgentEvent, { type: 'done' }> => event.type === 'done');
  if (!doneEvent) {
    throw new Error('Mastra runtime completed without done metadata');
  }
  return doneEvent.data.metadata;
}

async function classifyIntent(
  request: RunRequest,
  context: AgentRuntimeContext,
  deps: AgentRuntimeDeps,
  options: { preferTool?: boolean } = {},
): Promise<IntentClassification> {
  if (request.intent) {
    return {
      intent: request.intent,
      confidence: 1,
      scope: request.intent === 'schema.create' ? 'single-page' : 'single-page',
    };
  }

  const ruleResult = classifyIntentByRules(context);
  if (!options.preferTool && ruleResult.confidence >= 0.85) {
    return ruleResult;
  }

  const classifyIntentTool = deps.tools.get('classifyIntent');
  if (!classifyIntentTool) {
    return ruleResult;
  }

  try {
    const result = await classifyIntentTool.execute({ request, context });
    if (
      result
      && typeof result === 'object'
      && 'intent' in result
      && 'confidence' in result
      && (result.intent === 'schema.create' || result.intent === 'schema.modify' || result.intent === 'chat')
      && Number.isFinite(result.confidence)
    ) {
      return result as IntentClassification;
    }
  } catch {
    // Fall through to the rule-based result.
  }

  return ruleResult;
}

async function resolvePreparedContext(
  preparedRequest: RunRequest & { conversationId: string },
  deps: AgentRuntimeDeps,
) {
  const conversationId = preparedRequest.conversationId;
  const [conversation, lastRunMetadata, lastBlockIds] = await Promise.all([
    deps.memory.getConversation(conversationId),
    deps.memory.getLastRunMetadata(conversationId),
    deps.memory.getLastBlockIds(conversationId),
  ]);
  const context = buildRuntimeContext({
    request: preparedRequest,
    conversation,
    ...(lastRunMetadata ? { lastRunMetadata } : {}),
    lastBlockIds,
  });

  return {
    preparedRequest,
    conversationId,
    context,
  };
}

function buildSyntheticRunRequest(request: ClassifyRouteRequest): RunRequest {
  return {
    prompt: request.prompt,
    ...(request.attachments ? { attachments: request.attachments } : {}),
    ...(request.plannerModel ? { plannerModel: request.plannerModel } : {}),
    ...(request.thinking ? { thinking: request.thinking } : {}),
    context: {
      schemaSummary: request.context.schemaSummary,
      componentSummary: '',
    },
  };
}

function isPageIntent(intent: AgentIntent): intent is 'schema.create' | 'schema.modify' {
  return PAGE_STREAM_INTENTS.has(intent);
}

function getRunContextTag(request: RunRequest): 'single-page' | 'multi-page-loop' {
  return Array.isArray(request.context.workspaceFileIds) && request.context.workspaceFileIds.length > 0
    ? 'multi-page-loop'
    : 'single-page';
}

function logInfo(
  deps: AgentRuntimeDeps,
  message: string,
  payload: Record<string, unknown>,
): void {
  deps.logger?.info(message, {
    runtime: 'mastra',
    ...payload,
  });
}

function logError(
  deps: AgentRuntimeDeps,
  message: string,
  payload: Record<string, unknown>,
): void {
  deps.logger?.error(message, {
    runtime: 'mastra',
    ...payload,
  });
}

function getChatContent(result: unknown): string {
  if (!result || typeof result !== 'object') {
    return '';
  }
  if ('content' in result && typeof (result as { content?: unknown }).content === 'string') {
    return (result as { content: string }).content;
  }
  if ('text' in result && typeof (result as { text?: unknown }).text === 'string') {
    return (result as { text: string }).text;
  }
  return '';
}

function toChatResponse(result: unknown): ChatResponse {
  if (!result || typeof result !== 'object') {
    return { content: '' };
  }

  const candidate = result as {
    content?: unknown;
    text?: unknown;
    tokensUsed?: unknown;
    durationMs?: unknown;
  };

  const response: ChatResponse = {
    content: getChatContent(result),
  };
  if (candidate.tokensUsed && typeof candidate.tokensUsed === 'object') {
    response.tokensUsed = candidate.tokensUsed as NonNullable<ChatResponse['tokensUsed']>;
  }
  if (typeof candidate.durationMs === 'number') {
    response.durationMs = candidate.durationMs;
  }
  return response;
}

async function* runMastraPageStream(
  request: RunRequest,
  options: CreateMastraAgentRuntimeOptions,
): AsyncGenerator<AgentEvent> {
  const deps = options.createDeps();
  const preparedRequest = await options.prepareRunRequest(request);
  const sessionId = createSessionId();
  const conversationId = preparedRequest.conversationId ?? sessionId;
  const { context } = await resolvePreparedContext(
    { ...preparedRequest, conversationId },
    deps,
  );

  const resolvedIntent = await classifyIntent(
    { ...preparedRequest, conversationId },
    context,
    deps,
  );

  logInfo(deps, 'mastra.runtime.run_stream.classified', {
    conversationId,
    requestedIntent: request.intent ?? null,
    resolvedIntent: resolvedIntent.intent,
    confidence: resolvedIntent.confidence,
    scope: resolvedIntent.scope ?? 'single-page',
    runContext: getRunContextTag(preparedRequest),
  });

  if (!isPageIntent(resolvedIntent.intent)) {
    if (resolvedIntent.intent !== 'chat') {
      logInfo(deps, 'mastra.runtime.run_stream.fallback_legacy', {
        conversationId,
        resolvedIntent: resolvedIntent.intent,
        fallbackReason: 'unsupported_intent',
        runContext: getRunContextTag(preparedRequest),
      });
      yield* options.legacyRuntime.runStream(request);
      return;
    }

    const metadata: RunMetadata = {
      sessionId,
      conversationId,
      ...(preparedRequest.plannerModel ? { plannerModel: preparedRequest.plannerModel } : {}),
      ...(preparedRequest.blockModel ? { blockModel: preparedRequest.blockModel } : {}),
    };
    const startedAt = Date.now();
    const assistantChunks: string[] = [];

    try {
      logInfo(deps, 'mastra.runtime.run_stream.start', {
        conversationId,
        sessionId,
        intent: resolvedIntent.intent,
        runContext: getRunContextTag(preparedRequest),
        plannerModel: preparedRequest.plannerModel ?? null,
        blockModel: preparedRequest.blockModel ?? null,
        promptPreview: getOriginalPrompt(request).slice(0, 120),
      });

      const memoryAttachments = getMemoryAttachments(preparedRequest);
      await deps.memory.appendConversationMessage(conversationId, {
        role: 'user',
        text: getOriginalPrompt(request),
        ...(memoryAttachments ? { attachments: memoryAttachments } : {}),
      });

      yield { type: 'run:start', data: { sessionId, conversationId } };
      yield {
        type: 'intent',
        data: {
          intent: resolvedIntent.intent,
          confidence: resolvedIntent.confidence,
          ...(resolvedIntent.scope ? { scope: resolvedIntent.scope } : {}),
        },
      };
      yield { type: 'message:start', data: { role: 'assistant' } };

      for await (const chunk of deps.llm.streamChat({
        prompt: preparedRequest.prompt,
        ...(preparedRequest.attachments ? { attachments: preparedRequest.attachments } : {}),
        plannerModel: preparedRequest.plannerModel,
        blockModel: preparedRequest.blockModel,
        context,
      })) {
        if (!chunk.text) {
          continue;
        }
        assistantChunks.push(chunk.text);
        yield { type: 'message:delta', data: { text: chunk.text } };
      }

      if (assistantChunks.length === 0) {
        const fallbackText = '未生成有效回复。';
        assistantChunks.push(fallbackText);
        yield { type: 'message:delta', data: { text: fallbackText } };
      }

      metadata.durationMs = Date.now() - startedAt;
      await Promise.all([
        deps.memory.appendConversationMessage(conversationId, {
          role: 'assistant',
          text: assistantChunks.join(''),
          meta: {
            sessionId,
            intent: resolvedIntent.intent,
          },
        }),
        deps.memory.setLastRunMetadata(conversationId, metadata),
        deps.memory.setLastBlockIds(conversationId, []),
      ]);

      logInfo(deps, 'mastra.runtime.run_stream.done', {
        conversationId,
        sessionId,
        intent: resolvedIntent.intent,
        runContext: getRunContextTag(preparedRequest),
        durationMs: metadata.durationMs ?? null,
        tokensUsed: metadata.tokensUsed ?? null,
        finalSchemaBlockCount: 0,
        operationCount: 0,
      });
      yield { type: 'done', data: { metadata } };
      return;
    } catch (error) {
      logError(deps, 'mastra.runtime.run_stream.error', {
        conversationId,
        sessionId,
        intent: resolvedIntent.intent,
        runContext: getRunContextTag(preparedRequest),
        message: error instanceof Error ? error.message : 'Mastra runtime failed',
      });
      yield {
        type: 'error',
        data: {
          message: error instanceof Error ? error.message : 'Mastra runtime failed',
        },
      };
      return;
    }
  }

  const metadata: RunMetadata = {
    sessionId,
    conversationId,
    ...(preparedRequest.plannerModel ? { plannerModel: preparedRequest.plannerModel } : {}),
    ...(preparedRequest.blockModel ? { blockModel: preparedRequest.blockModel } : {}),
  };
  const startedAt = Date.now();
  const events: AgentEvent[] = [];
  const queue = new AsyncEventQueue<AgentEvent>();
  const emit = (event: AgentEvent) => {
    queue.push(event);
  };

  try {
    logInfo(deps, 'mastra.runtime.run_stream.start', {
      conversationId,
      sessionId,
      intent: resolvedIntent.intent,
      runContext: getRunContextTag(preparedRequest),
      plannerModel: preparedRequest.plannerModel ?? null,
      blockModel: preparedRequest.blockModel ?? null,
      promptPreview: getOriginalPrompt(request).slice(0, 120),
    });

    const memoryAttachments = getMemoryAttachments(preparedRequest);
    await deps.memory.appendConversationMessage(conversationId, {
      role: 'user',
      text: getOriginalPrompt(request),
      ...(memoryAttachments ? { attachments: memoryAttachments } : {}),
    });

    const startEvent: AgentEvent = { type: 'run:start', data: { sessionId, conversationId } };
    events.push(startEvent);
    yield startEvent;

    const intentEvent: AgentEvent = {
      type: 'intent',
      data: {
        intent: resolvedIntent.intent,
        confidence: resolvedIntent.confidence,
        ...(resolvedIntent.scope ? { scope: resolvedIntent.scope } : {}),
      },
    };
    events.push(intentEvent);
    yield intentEvent;

    const workflowInput = {
      request: { ...preparedRequest, conversationId },
      context,
      metadata,
    };

    const workflow = resolvedIntent.intent === 'schema.create'
      ? createPageCreateWorkflow(deps, emit)
      : createPageModifyWorkflow(deps, emit);
    const workflowRun = await workflow.createRun();
    const workflowPromise = (async () => {
      try {
        const result = await workflowRun.start({ inputData: workflowInput });
        queue.close();
        return result;
      } catch (error) {
        queue.fail(error);
        throw error;
      }
    })();

    for await (const event of queue) {
      events.push(event);
      yield event;
    }

    const workflowResult = await workflowPromise;

    if (workflowResult.status !== 'success') {
      throw ('error' in workflowResult && workflowResult.error)
        ? workflowResult.error
        : new Error(`Mastra workflow failed with status ${workflowResult.status}`);
    }

    metadata.durationMs = Date.now() - startedAt;
    const totalTokensUsed = events
      .filter((event): event is Extract<AgentEvent, { type: 'schema:block' }> => event.type === 'schema:block')
      .reduce((sum, event) => sum + (event.data.tokensUsed ?? 0), 0);
    if (totalTokensUsed > 0) {
      metadata.tokensUsed = totalTokensUsed;
    }

    const assistantText = events
      .filter((event): event is Extract<AgentEvent, { type: 'message:delta' }> => event.type === 'message:delta')
      .map((event) => event.data.text)
      .join('');
    const operations = events
      .filter((event): event is Extract<AgentEvent, { type: 'modify:op' }> => event.type === 'modify:op')
      .map((event) => event.data.operation);
    const finalSchemaBlocks = events
      .filter((event): event is Extract<AgentEvent, { type: 'schema:block' }> => event.type === 'schema:block')
      .map((event) => event.data.blockId);

    await Promise.all([
      deps.memory.appendConversationMessage(conversationId, {
        role: 'assistant',
        text: assistantText,
        meta: {
          sessionId,
          intent: resolvedIntent.intent,
          ...(operations.length > 0 ? { operations } : {}),
        },
      }),
      deps.memory.setLastRunMetadata(conversationId, metadata),
      deps.memory.setLastBlockIds(conversationId, finalSchemaBlocks),
    ]);

    const doneEvent: AgentEvent = { type: 'done', data: { metadata } };
    logInfo(deps, 'mastra.runtime.run_stream.done', {
      conversationId,
      sessionId,
      intent: resolvedIntent.intent,
      runContext: getRunContextTag(preparedRequest),
      durationMs: metadata.durationMs ?? null,
      tokensUsed: metadata.tokensUsed ?? null,
      finalSchemaBlockCount: finalSchemaBlocks.length,
      operationCount: operations.length,
    });
    yield doneEvent;
  } catch (error) {
    logError(deps, 'mastra.runtime.run_stream.error', {
      conversationId,
      sessionId,
      intent: resolvedIntent.intent,
      runContext: getRunContextTag(preparedRequest),
      message: error instanceof Error ? error.message : 'Mastra runtime failed',
    });
    yield {
      type: 'error',
      data: {
        message: error instanceof Error ? error.message : 'Mastra runtime failed',
      },
    };
  }
}

export function createMastraAgentRuntime(options: CreateMastraAgentRuntimeOptions): MastraAgentRuntime {
  let runtime: MastraAgentRuntime;
  const projectRuntime = createProjectWorkflowRuntime({
    createDeps: options.createDeps,
    prepareRunRequest: options.prepareRunRequest,
    runPageStream: (request) => runtime.runStream(request),
  });
  runtime = {
    async run(request) {
      const events: AgentEvent[] = [];
      for await (const event of runtime.runStream(request)) {
        events.push(event);
      }
      return {
        events,
        metadata: extractMetadata(events),
      };
    },
    async *runStream(request) {
      yield* runMastraPageStream(request, options);
    },
    async chat(request: ChatRequest): Promise<ChatResponse> {
      const deps = options.createDeps();
      logInfo(deps, 'mastra.runtime.chat.request', {
        model: request.model,
        messageCount: request.messages.length,
      });
      const result = await deps.llm.chat(request);
      logInfo(deps, 'mastra.runtime.chat.response', {
        model: request.model,
      });
      return toChatResponse(result);
    },
    async *chatStream(request: ChatRequest): AsyncIterable<{ delta: string }> {
      const deps = options.createDeps();
      logInfo(deps, 'mastra.runtime.chat_stream.request', {
        model: request.model,
        messageCount: request.messages.length,
      });
      for await (const chunk of deps.llm.streamChat(request)) {
        yield { delta: chunk.text };
      }
    },
    async classifyRoute(request: ClassifyRouteRequest): Promise<ClassifyRouteResponse> {
      const deps = options.createDeps();
      const preparedRequest = await options.prepareRunRequest(buildSyntheticRunRequest(request));
      const conversationId = preparedRequest.conversationId ?? `classify_${Date.now().toString(36)}`;
      const { context } = await resolvePreparedContext({ ...preparedRequest, conversationId }, deps);
      const resolvedIntent = await classifyIntent(
        { ...preparedRequest, conversationId },
        context,
        deps,
        { preferTool: true },
      );
      logInfo(deps, 'mastra.runtime.classify_route.result', {
        conversationId,
        intent: resolvedIntent.intent,
        confidence: resolvedIntent.confidence,
        scope: resolvedIntent.scope ?? 'single-page',
      });
      const preparedPrompt = preparedRequest.prompt !== request.prompt
        ? preparedRequest.prompt
        : undefined;

      return {
        scope: resolvedIntent.scope ?? 'single-page',
        intent: resolvedIntent.intent,
        confidence: resolvedIntent.confidence,
        ...(preparedPrompt ? { preparedPrompt } : {}),
      };
    },
    finalize(request: FinalizeRequest): Promise<FinalizeResult> {
      const deps = options.createDeps();
      logInfo(deps, 'mastra.runtime.finalize.start', {
        conversationId: request.conversationId,
        sessionId: request.sessionId,
        success: request.success,
      });
      return finalizeAgentSessionMemory(deps.memory, request)
        .then((finalized) => {
          const memoryDebugFile = finalized && options.writeMemoryDump
            ? options.writeMemoryDump({
              category: 'finalize',
              memory: {
                request,
                outcome: finalized.outcome,
                before: finalized.before,
                after: finalized.after,
              },
            })
            : undefined;

          logInfo(deps, 'mastra.runtime.finalize.done', {
            conversationId: request.conversationId,
            sessionId: request.sessionId,
            success: request.success,
            outcome: finalized?.outcome ?? 'unsupported_memory_store',
            memoryDebugFile: memoryDebugFile ?? null,
          });

          return memoryDebugFile ? { memoryDebugFile } : {};
        })
        .catch((error) => {
          logError(deps, 'mastra.runtime.finalize.error', {
            conversationId: request.conversationId,
            sessionId: request.sessionId,
            success: request.success,
            message: error instanceof Error ? error.message : 'Mastra finalize failed',
          });
          throw error;
        });
    },
    listModels() {
      return options.listModels();
    },
    writeClientDebug(input) {
      return options.writeClientDebug(input);
    },
    writeTraceDebug(input) {
      return options.writeTraceDebug(input);
    },
    projectStream(request) {
      return projectRuntime.projectStream(request);
    },
    confirmProject(request) {
      return projectRuntime.confirmProject(request);
    },
    reviseProject(request) {
      return projectRuntime.reviseProject(request);
    },
    cancelProject(request) {
      return projectRuntime.cancelProject(request);
    },
  };
  return runtime;
}

export const createMastraAiService = createMastraAgentRuntime;
