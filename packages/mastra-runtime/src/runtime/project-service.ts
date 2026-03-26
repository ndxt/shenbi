import {
  buildProjectPlannerPrompt,
  normalizeProjectPlan,
  type AgentRuntimeDeps,
  type RunRequest,
} from '@shenbi/ai-agents';
import type {
  AgentEvent,
  ProjectAgentEvent,
  ProjectCancelRequest,
  ProjectConfirmRequest,
  ProjectPlan,
  ProjectPlanPage,
  ProjectReviseRequest,
  ProjectRunRequest,
  ProjectSessionMutationResult,
  RunMetadata,
} from '@shenbi/ai-contracts';

type ProjectSessionStatus =
  | 'planning'
  | 'awaiting_confirmation'
  | 'executing'
  | 'done'
  | 'error'
  | 'cancelled';

type ProjectControl =
  | { type: 'confirm' }
  | { type: 'revise'; revisionPrompt: string }
  | { type: 'cancel' };

interface ProjectSession {
  sessionId: string;
  conversationId: string;
  request: ProjectRunRequest;
  queue: AsyncEventQueue<ProjectAgentEvent>;
  status: ProjectSessionStatus;
  plan?: ProjectPlan;
  createdFileIds: string[];
  completedPageIds: string[];
  cancelRequested: boolean;
  controlBuffer: ProjectControl[];
  controlWaiters: Array<(control: ProjectControl) => void>;
}

interface CreateProjectServiceOptions {
  createDeps: () => AgentRuntimeDeps;
  prepareRunRequest: (request: RunRequest) => Promise<RunRequest>;
  runPageStream: (request: RunRequest) => AsyncIterable<AgentEvent>;
}

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
      this.waiters.shift()?.({ value: undefined as T, done: true });
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

function createProjectSessionId(): string {
  return `project_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function toProjectMutationResult(session: ProjectSession): ProjectSessionMutationResult {
  if (session.status === 'executing') {
    return { sessionId: session.sessionId, status: 'executing' };
  }
  if (session.status === 'cancelled') {
    return { sessionId: session.sessionId, status: 'cancelled' };
  }
  return { sessionId: session.sessionId, status: 'awaiting_confirmation' };
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

function extractJsonCandidate(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? text).trim();
}

function parseProjectPlan(text: string, request: ProjectRunRequest): ProjectPlan {
  const candidate = extractJsonCandidate(text);
  return normalizeProjectPlan(JSON.parse(candidate), request.workspace);
}

function enqueueControl(session: ProjectSession, control: ProjectControl): void {
  if (session.controlWaiters.length > 0) {
    session.controlWaiters.shift()?.(control);
    return;
  }
  session.controlBuffer.push(control);
}

function waitForControl(session: ProjectSession): Promise<ProjectControl> {
  const buffered = session.controlBuffer.shift();
  if (buffered) {
    return Promise.resolve(buffered);
  }
  return new Promise<ProjectControl>((resolve) => {
    session.controlWaiters.push(resolve);
  });
}

async function generateProjectPlan(
  session: ProjectSession,
  deps: AgentRuntimeDeps,
  revisionPrompt?: string,
): Promise<ProjectPlan> {
  const promptSpec = buildProjectPlannerPrompt({
    prompt: session.request.prompt,
    workspace: session.request.workspace,
    ...(revisionPrompt ? { revisionPrompt } : {}),
  });
  const llmRequest: Record<string, unknown> = {
    messages: [
      { role: 'system', content: promptSpec.systemText },
      { role: 'user', content: promptSpec.userText },
    ],
    ...(session.request.thinking ? { thinking: session.request.thinking } : {}),
  };
  if (session.request.plannerModel) {
    llmRequest.model = session.request.plannerModel;
  }
  const result = await deps.llm.chat(llmRequest);
  return parseProjectPlan(getChatContent(result), session.request);
}

function resolveModifyPage(
  request: ProjectRunRequest,
  page: ProjectPlanPage,
): { fileId: string; pageName: string; schemaSummary: string; schemaJson?: ProjectRunRequest['workspace']['files'][number]['schemaJson'] } {
  const matched = request.workspace.files.find((file) => (
    file.fileId === page.fileId
    || file.fileId === page.pageId
    || file.pageName === page.pageName
  ));
  if (!matched) {
    throw new Error(`Project page "${page.pageId}" could not be matched to an existing workspace file`);
  }
  return {
    fileId: matched.fileId,
    pageName: matched.pageName,
    schemaSummary: matched.schemaSummary,
    ...(matched.schemaJson ? { schemaJson: matched.schemaJson } : {}),
  };
}

function buildSinglePagePrompt(page: ProjectPlanPage): string {
  if (page.prompt && page.prompt.trim().length > 0) {
    return page.prompt;
  }
  return `${page.pageName}\n${page.description}`.trim();
}

function buildSinglePageRequest(
  session: ProjectSession,
  page: ProjectPlanPage,
): RunRequest {
  const workspaceFileIds = session.request.workspace.files.map((file) => file.fileId);
  const sharedRequest = {
    prompt: buildSinglePagePrompt(page),
    ...(session.request.plannerModel ? { plannerModel: session.request.plannerModel } : {}),
    ...(session.request.blockModel ? { blockModel: session.request.blockModel } : {}),
    ...(session.request.thinking ? { thinking: session.request.thinking } : {}),
    conversationId: `${session.conversationId}:${page.pageId}`,
    context: {
      componentSummary: session.request.workspace.componentSummary,
      workspaceFileIds,
      schemaSummary: '',
    },
  } satisfies RunRequest;

  if (page.action === 'modify') {
    const resolved = resolveModifyPage(session.request, page);
    return {
      ...sharedRequest,
      intent: 'schema.modify',
      context: {
        ...sharedRequest.context,
        schemaSummary: resolved.schemaSummary,
        ...(resolved.schemaJson ? { schemaJson: resolved.schemaJson } : {}),
      },
    };
  }

  return {
    ...sharedRequest,
    intent: 'schema.create',
    context: {
      ...sharedRequest.context,
      schemaSummary: `pageId=${page.fileId ?? page.pageId}; pageName=${page.pageName}; nodeCount=0`,
    },
  };
}

async function executeProjectSession(
  session: ProjectSession,
  options: CreateProjectServiceOptions,
): Promise<void> {
  const deps = options.createDeps();
  try {
    logInfo(deps, 'mastra.runtime.project.start', {
      sessionId: session.sessionId,
      conversationId: session.conversationId,
    });
    session.queue.push({
      type: 'project:start',
      data: {
        sessionId: session.sessionId,
        conversationId: session.conversationId,
        prompt: session.request.prompt,
      },
    });

    let revisionPrompt: string | undefined;
    while (true) {
      session.status = 'planning';
      const plan = await generateProjectPlan(session, deps, revisionPrompt);
      session.plan = plan;
      session.status = 'awaiting_confirmation';
      logInfo(deps, 'mastra.runtime.project.plan', {
        sessionId: session.sessionId,
        pageCount: plan.pages.length,
      });
      session.queue.push({
        type: 'project:plan',
        data: {
          sessionId: session.sessionId,
          plan,
        },
      });
      session.queue.push({
        type: 'project:awaiting_confirmation',
        data: {
          sessionId: session.sessionId,
          plan,
        },
      });

      const control = await waitForControl(session);
      if (control.type === 'cancel') {
        session.status = 'cancelled';
        session.queue.push({
          type: 'project:error',
          data: {
            sessionId: session.sessionId,
            message: 'Project workflow cancelled by user',
          },
        });
        return;
      }
      if (control.type === 'revise') {
        revisionPrompt = control.revisionPrompt;
        continue;
      }
      break;
    }

    session.status = 'executing';
    const actionablePages = (session.plan?.pages ?? []).filter((page) => page.action !== 'skip');
    for (const [index, page] of actionablePages.entries()) {
      if (session.cancelRequested) {
        throw new Error('Project workflow cancelled by user');
      }
      session.queue.push({
        type: 'project:page:start',
        data: {
          sessionId: session.sessionId,
          index,
          total: actionablePages.length,
          page,
        },
      });
      const pageRequest = buildSinglePageRequest(session, page);
      let pageMetadata: RunMetadata | undefined;
      for await (const event of options.runPageStream(pageRequest)) {
        session.queue.push({
          type: 'project:page:event',
          data: {
            sessionId: session.sessionId,
            pageId: page.pageId,
            event,
          },
        });
        if (event.type === 'done') {
          pageMetadata = event.data.metadata as typeof pageMetadata;
        }
        if (event.type === 'error') {
          throw new Error(event.data.message);
        }
      }
      session.completedPageIds.push(page.pageId);
      if (page.action === 'create') {
        session.createdFileIds.push(page.fileId ?? page.pageId);
      }
      session.queue.push({
        type: 'project:page:done',
        data: {
          sessionId: session.sessionId,
          pageId: page.pageId,
          ...(page.fileId ? { fileId: page.fileId } : {}),
          ...(pageMetadata ? { metadata: pageMetadata } : {}),
        },
      });
    }

    session.status = 'done';
    session.queue.push({
      type: 'project:done',
      data: {
        sessionId: session.sessionId,
        createdFileIds: session.createdFileIds,
        completedPageIds: session.completedPageIds,
      },
    });
    logInfo(deps, 'mastra.runtime.project.done', {
      sessionId: session.sessionId,
      createdFileIds: session.createdFileIds,
      completedPageIds: session.completedPageIds,
    });
  } catch (error) {
    session.status = session.cancelRequested ? 'cancelled' : 'error';
    logError(deps, 'mastra.runtime.project.error', {
      sessionId: session.sessionId,
      message: error instanceof Error ? error.message : 'Project workflow failed',
    });
    session.queue.push({
      type: 'project:error',
      data: {
        sessionId: session.sessionId,
        message: error instanceof Error ? error.message : 'Project workflow failed',
      },
    });
  } finally {
    session.queue.close();
  }
}

export interface ProjectWorkflowRuntime {
  projectStream(request: ProjectRunRequest): AsyncIterable<ProjectAgentEvent>;
  confirmProject(request: ProjectConfirmRequest): Promise<ProjectSessionMutationResult>;
  reviseProject(request: ProjectReviseRequest): Promise<ProjectSessionMutationResult>;
  cancelProject(request: ProjectCancelRequest): Promise<ProjectSessionMutationResult>;
}

export function createProjectWorkflowRuntime(
  options: CreateProjectServiceOptions,
): ProjectWorkflowRuntime {
  const sessions = new Map<string, ProjectSession>();

  return {
    async *projectStream(request: ProjectRunRequest): AsyncIterable<ProjectAgentEvent> {
      const syntheticRunRequest = await options.prepareRunRequest({
        prompt: request.prompt,
        ...(request.attachments ? { attachments: request.attachments } : {}),
        ...(request.plannerModel ? { plannerModel: request.plannerModel } : {}),
        ...(request.thinking ? { thinking: request.thinking } : {}),
        context: {
          schemaSummary: request.workspace.currentSchemaSummary ?? 'pageId=empty; pageName=empty; nodeCount=0',
          componentSummary: request.workspace.componentSummary,
          ...(request.workspace.currentSchemaJson ? { schemaJson: request.workspace.currentSchemaJson } : {}),
        },
      });
      const sessionId = createProjectSessionId();
      const session: ProjectSession = {
        sessionId,
        conversationId: request.conversationId ?? syntheticRunRequest.conversationId ?? sessionId,
        request: {
          ...request,
          prompt: syntheticRunRequest.prompt,
          ...(syntheticRunRequest.attachments ? { attachments: syntheticRunRequest.attachments } : {}),
        },
        queue: new AsyncEventQueue<ProjectAgentEvent>(),
        status: 'planning',
        createdFileIds: [],
        completedPageIds: [],
        cancelRequested: false,
        controlBuffer: [],
        controlWaiters: [],
      };
      sessions.set(sessionId, session);
      void executeProjectSession(session, options).finally(() => {
        sessions.delete(sessionId);
      });
      yield* session.queue;
    },

    async confirmProject(request: ProjectConfirmRequest): Promise<ProjectSessionMutationResult> {
      const session = sessions.get(request.sessionId);
      if (!session) {
        throw new Error(`Unknown project session: ${request.sessionId}`);
      }
      session.status = 'executing';
      enqueueControl(session, { type: 'confirm' });
      return toProjectMutationResult(session);
    },

    async reviseProject(request: ProjectReviseRequest): Promise<ProjectSessionMutationResult> {
      const session = sessions.get(request.sessionId);
      if (!session) {
        throw new Error(`Unknown project session: ${request.sessionId}`);
      }
      session.status = 'awaiting_confirmation';
      enqueueControl(session, { type: 'revise', revisionPrompt: request.revisionPrompt });
      return toProjectMutationResult(session);
    },

    async cancelProject(request: ProjectCancelRequest): Promise<ProjectSessionMutationResult> {
      const session = sessions.get(request.sessionId);
      if (!session) {
        throw new Error(`Unknown project session: ${request.sessionId}`);
      }
      session.cancelRequested = true;
      session.status = 'cancelled';
      enqueueControl(session, { type: 'cancel' });
      return toProjectMutationResult(session);
    },
  };
}
