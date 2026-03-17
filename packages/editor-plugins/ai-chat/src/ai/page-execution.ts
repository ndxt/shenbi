import type { AgentOperationMetrics } from '@shenbi/ai-contracts';
import type { PageSchema, SchemaNode } from '@shenbi/schema';
import type {
  AIClient,
  AgentEvent,
  AgentIntent,
  AgentOperation,
  PagePlan,
  RunMetadata,
  RunRequest,
  RunStreamOptions,
} from './api-types';

export type PageExecutionMode = 'create' | 'modify';
export type BlockRunStatus = 'waiting' | 'generating' | 'done' | 'failed';

export interface ModifyPlan {
  operationCount: number;
  explanation: string;
  operationLabels: string[];
}

export interface PageExecutionSnapshot {
  mode: PageExecutionMode;
  intent?: AgentIntent;
  plan: PagePlan | null;
  plannerMetrics: AgentOperationMetrics | null;
  blockStatuses: Record<string, BlockRunStatus>;
  blockTokens: Record<string, number>;
  blockInputTokens: Record<string, number>;
  blockOutputTokens: Record<string, number>;
  blockDurationMs: Record<string, number>;
  modifyPlan: ModifyPlan | null;
  modifyStatuses: Record<number, BlockRunStatus>;
  modifyOpMetrics: Record<number, AgentOperationMetrics>;
  progressText: string;
  finalSchema?: PageSchema;
  metadata?: RunMetadata;
  didApplySchema: boolean;
}

export interface RunPageExecutionCallbacks {
  onIntent?: (intent: AgentIntent) => void | Promise<void>;
  onMessageStart?: () => void | Promise<void>;
  onMessageDelta?: (text: string) => void | Promise<void>;
  onToolStart?: (tool: string, label?: string) => void | Promise<void>;
  onToolResult?: (tool: string, ok: boolean, summary?: string) => void | Promise<void>;
  onSnapshot?: (snapshot: PageExecutionSnapshot) => void | Promise<void>;
  onPlan?: (plan: PagePlan, snapshot: PageExecutionSnapshot) => void | Promise<void>;
  onSchemaSkeleton?: (
    schema: PageSchema,
    snapshot: PageExecutionSnapshot,
    event: Extract<AgentEvent, { type: 'schema:skeleton' }>,
  ) => void | Promise<void>;
  onSchemaBlock?: (
    data: Extract<AgentEvent, { type: 'schema:block' }>['data'],
    snapshot: PageExecutionSnapshot,
    event: Extract<AgentEvent, { type: 'schema:block' }>,
  ) => void | Promise<void>;
  onSchemaDone?: (
    schema: PageSchema,
    snapshot: PageExecutionSnapshot,
    event: Extract<AgentEvent, { type: 'schema:done' }>,
  ) => void | Promise<void>;
  onModifyOperation?: (
    data: Extract<AgentEvent, { type: 'modify:op' }>['data'],
    snapshot: PageExecutionSnapshot,
    event: Extract<AgentEvent, { type: 'modify:op' }>,
  ) => void | Promise<void>;
  onDone?: (metadata: RunMetadata, snapshot: PageExecutionSnapshot) => void | Promise<void>;
}

export interface RunPageExecutionOptions {
  aiClient: AIClient;
  request: RunRequest;
  signal?: AbortSignal;
  initialMode?: PageExecutionMode;
  callbacks?: RunPageExecutionCallbacks;
}

export interface RunPageExecutionResult {
  snapshot: PageExecutionSnapshot;
  metadata?: RunMetadata;
  finalSchema?: PageSchema;
  modifyOperations: AgentOperation[];
}

function isSchemaNode(value: unknown): value is SchemaNode {
  return Boolean(value) && typeof value === 'object' && 'component' in (value as Record<string, unknown>);
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

export function replaceSkeletonNode(schema: PageSchema, blockId: string, node: SchemaNode): PageSchema {
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

export function createPageExecutionSnapshot(mode: PageExecutionMode = 'create'): PageExecutionSnapshot {
  return {
    mode,
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
    progressText: '',
    didApplySchema: false,
  };
}

function cloneSnapshot(snapshot: PageExecutionSnapshot): PageExecutionSnapshot {
  return {
    ...snapshot,
    ...(snapshot.finalSchema ? { finalSchema: snapshot.finalSchema } : {}),
    ...(snapshot.metadata ? { metadata: snapshot.metadata } : {}),
    blockStatuses: { ...snapshot.blockStatuses },
    blockTokens: { ...snapshot.blockTokens },
    blockInputTokens: { ...snapshot.blockInputTokens },
    blockOutputTokens: { ...snapshot.blockOutputTokens },
    blockDurationMs: { ...snapshot.blockDurationMs },
    ...(snapshot.modifyPlan
      ? {
          modifyPlan: {
            ...snapshot.modifyPlan,
            operationLabels: [...snapshot.modifyPlan.operationLabels],
          },
        }
      : {}),
    modifyStatuses: { ...snapshot.modifyStatuses },
    modifyOpMetrics: { ...snapshot.modifyOpMetrics },
  };
}

function buildModifyPlan(data: Extract<AgentEvent, { type: 'modify:start' }>['data']): ModifyPlan {
  const labels = (data.operations ?? []).map((operation) => {
    if (operation.label) {
      return operation.label;
    }
    const shortOp = operation.op.replace('schema.', '');
    return operation.nodeId ? `${shortOp} -> ${operation.nodeId}` : shortOp;
  });
  return {
    operationCount: data.operationCount,
    explanation: data.explanation,
    operationLabels: labels,
  };
}

async function emitSnapshot(
  callbacks: RunPageExecutionCallbacks | undefined,
  snapshot: PageExecutionSnapshot,
) {
  await callbacks?.onSnapshot?.(cloneSnapshot(snapshot));
}

export async function runPageExecution({
  aiClient,
  request,
  signal,
  initialMode = request.intent === 'schema.modify' ? 'modify' : 'create',
  callbacks,
}: RunPageExecutionOptions): Promise<RunPageExecutionResult> {
  const snapshot = createPageExecutionSnapshot(initialMode);
  const modifyOperations: AgentOperation[] = [];
  const options: RunStreamOptions | undefined = signal ? { signal } : undefined;
  const stream = aiClient.runStream(request, options);

  for await (const event of stream) {
    switch (event.type) {
      case 'run:start':
        snapshot.progressText = '运行开始';
        await emitSnapshot(callbacks, snapshot);
        break;
      case 'intent':
        snapshot.intent = event.data.intent;
        if (event.data.intent === 'schema.modify') {
          snapshot.mode = 'modify';
          snapshot.progressText = '识别为页面修改任务';
        } else if (event.data.intent === 'schema.create') {
          snapshot.mode = 'create';
          snapshot.progressText = '识别为页面生成任务';
        } else {
          snapshot.progressText = '识别为对话任务';
        }
        await callbacks?.onIntent?.(event.data.intent);
        await emitSnapshot(callbacks, snapshot);
        break;
      case 'message:start':
        await callbacks?.onMessageStart?.();
        break;
      case 'message:delta':
        await callbacks?.onMessageDelta?.(event.data.text);
        break;
      case 'tool:start':
        snapshot.progressText = `正在使用工具: ${event.data.label ?? event.data.tool}...`;
        await callbacks?.onToolStart?.(event.data.tool, event.data.label);
        await emitSnapshot(callbacks, snapshot);
        break;
      case 'tool:result':
        snapshot.progressText = `工具: ${event.data.tool} ${event.data.ok ? '完成' : '失败'}${event.data.summary ? `. ${event.data.summary}` : ''}`;
        await callbacks?.onToolResult?.(event.data.tool, event.data.ok, event.data.summary);
        await emitSnapshot(callbacks, snapshot);
        break;
      case 'plan':
        snapshot.mode = 'create';
        snapshot.plan = event.data;
        snapshot.plannerMetrics = event.data._plannerMetrics ?? null;
        snapshot.blockStatuses = Object.fromEntries(
          event.data.blocks.map((block) => [block.id, 'waiting' as const]),
        );
        snapshot.blockTokens = {};
        snapshot.blockInputTokens = {};
        snapshot.blockOutputTokens = {};
        snapshot.blockDurationMs = {};
        snapshot.progressText = '获取到架构计划';
        await callbacks?.onPlan?.(event.data, cloneSnapshot(snapshot));
        await emitSnapshot(callbacks, snapshot);
        break;
      case 'schema:skeleton':
        snapshot.mode = 'create';
        snapshot.progressText = '渲染页面骨架';
        snapshot.didApplySchema = true;
        await callbacks?.onSchemaSkeleton?.(event.data.schema, cloneSnapshot(snapshot), event);
        await emitSnapshot(callbacks, snapshot);
        break;
      case 'schema:block:start':
        snapshot.mode = 'create';
        snapshot.blockStatuses = {
          ...snapshot.blockStatuses,
          [event.data.blockId]: 'generating',
        };
        snapshot.progressText = `正在生成区块: ${event.data.description}`;
        await emitSnapshot(callbacks, snapshot);
        break;
      case 'schema:block':
        snapshot.mode = 'create';
        snapshot.didApplySchema = true;
        snapshot.blockStatuses = {
          ...snapshot.blockStatuses,
          [event.data.blockId]: 'done',
        };
        if (typeof event.data.tokensUsed === 'number') {
          snapshot.blockTokens = {
            ...snapshot.blockTokens,
            [event.data.blockId]: event.data.tokensUsed,
          };
        }
        if (typeof event.data.inputTokens === 'number') {
          snapshot.blockInputTokens = {
            ...snapshot.blockInputTokens,
            [event.data.blockId]: event.data.inputTokens,
          };
        }
        if (typeof event.data.outputTokens === 'number') {
          snapshot.blockOutputTokens = {
            ...snapshot.blockOutputTokens,
            [event.data.blockId]: event.data.outputTokens,
          };
        }
        if (typeof event.data.durationMs === 'number') {
          snapshot.blockDurationMs = {
            ...snapshot.blockDurationMs,
            [event.data.blockId]: event.data.durationMs,
          };
        }
        await callbacks?.onSchemaBlock?.(event.data, cloneSnapshot(snapshot), event);
        await emitSnapshot(callbacks, snapshot);
        break;
      case 'schema:done':
        snapshot.mode = 'create';
        snapshot.didApplySchema = true;
        snapshot.finalSchema = event.data.schema;
        snapshot.progressText = '更新页面 Schema';
        snapshot.blockStatuses = Object.fromEntries(
          Object.keys(snapshot.blockStatuses).map((blockId) => [blockId, 'done' as const]),
        );
        await callbacks?.onSchemaDone?.(event.data.schema, cloneSnapshot(snapshot), event);
        await emitSnapshot(callbacks, snapshot);
        break;
      case 'modify:start':
        snapshot.mode = 'modify';
        snapshot.modifyPlan = buildModifyPlan(event.data);
        snapshot.modifyStatuses = Object.fromEntries(
          Array.from({ length: event.data.operationCount }, (_, index) => [index, 'waiting' as const]),
        );
        snapshot.modifyOpMetrics = {};
        snapshot.progressText = `准备执行 ${event.data.operationCount} 个修改`;
        await emitSnapshot(callbacks, snapshot);
        break;
      case 'modify:op:pending':
        snapshot.mode = 'modify';
        snapshot.modifyStatuses = {
          ...snapshot.modifyStatuses,
          [event.data.index]: 'generating',
        };
        snapshot.progressText = `执行修改 ${event.data.index + 1}`;
        await emitSnapshot(callbacks, snapshot);
        break;
      case 'modify:op':
        snapshot.mode = 'modify';
        snapshot.didApplySchema = true;
        snapshot.modifyStatuses = {
          ...snapshot.modifyStatuses,
          [event.data.index]: 'done',
        };
        if (event.data.metrics && Object.keys(event.data.metrics).length > 0) {
          snapshot.modifyOpMetrics = {
            ...snapshot.modifyOpMetrics,
            [event.data.index]: event.data.metrics,
          };
        }
        snapshot.progressText = `执行修改 ${event.data.index + 1}`;
        modifyOperations.push(event.data.operation);
        await callbacks?.onModifyOperation?.(event.data, cloneSnapshot(snapshot), event);
        await emitSnapshot(callbacks, snapshot);
        break;
      case 'modify:done':
        snapshot.mode = 'modify';
        snapshot.progressText = '页面修改已应用';
        await emitSnapshot(callbacks, snapshot);
        break;
      case 'done':
        snapshot.metadata = event.data.metadata;
        await callbacks?.onDone?.(event.data.metadata, cloneSnapshot(snapshot));
        await emitSnapshot(callbacks, snapshot);
        return {
          snapshot: cloneSnapshot(snapshot),
          metadata: event.data.metadata,
          ...(snapshot.finalSchema ? { finalSchema: snapshot.finalSchema } : {}),
          modifyOperations,
        };
      case 'error':
        throw new Error(event.data.message);
    }
  }

  return {
    snapshot: cloneSnapshot(snapshot),
    ...(snapshot.metadata ? { metadata: snapshot.metadata } : {}),
    ...(snapshot.finalSchema ? { finalSchema: snapshot.finalSchema } : {}),
    modifyOperations,
  };
}
