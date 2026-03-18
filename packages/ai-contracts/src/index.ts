import type { PageSchema, SchemaNode } from '@shenbi/schema';

export interface ThinkingConfig {
  type: 'enabled' | 'disabled';
}

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessageInput {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessageInput[];
  model: string;
  maxTokens?: number;
  thinking?: ThinkingConfig;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  tokensUsed?: {
    input?: number;
    output?: number;
    total?: number;
  };
  durationMs?: number;
}

export type ProjectPlanPageAction = 'create' | 'modify' | 'skip';

export interface ProjectPlanPage {
  pageId: string;
  pageName: string;
  action: ProjectPlanPageAction;
  description: string;
  group?: string;
  prompt?: string;
  evidence?: string;
  reason?: string;
}

export interface ProjectPlan {
  projectName: string;
  pages: ProjectPlanPage[];
}

export interface ReActStep {
  stepIndex: number;
  timestamp: string;
  status?: string;
  reasoningSummary?: string;
  action: string;
  actionInput: Record<string, unknown>;
  observation?: string;
  llmDurationMs?: number;
  toolDurationMs?: number;
  tokensInput?: number;
  tokensOutput?: number;
  nestedTraceFile?: string;
  error?: string;
}

export interface LoopSessionState {
  conversationId: string;
  status: 'planning' | 'awaiting_confirmation' | 'executing' | 'done' | 'failed' | 'cancelled';
  approvedPlan?: ProjectPlan;
  createdFileIds: string[];
  completedPageIds: string[];
  failedPageIds: string[];
  currentPageId?: string;
  lastCompletedAction?: string;
  updatedAt: string;
}

export type RunAttachmentKind = 'image' | 'document';

export interface RunAttachmentInput {
  id: string;
  kind: RunAttachmentKind;
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}

export type AgentIntent =
  | 'schema.create'
  | 'schema.modify'
  | 'chat';

export type AgentScope = 'single-page' | 'multi-page';

export interface AgentOperationMetrics {
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  tokensUsed?: number;
}

export type AgentOperation =
  | { op: 'schema.patchProps'; label?: string; nodeId: string; patch: Record<string, unknown>; _metrics?: AgentOperationMetrics }
  | { op: 'schema.patchStyle'; label?: string; nodeId: string; patch: Record<string, unknown>; _metrics?: AgentOperationMetrics }
  | { op: 'schema.patchEvents'; label?: string; nodeId: string; patch: Record<string, unknown>; _metrics?: AgentOperationMetrics }
  | { op: 'schema.patchLogic'; label?: string; nodeId: string; patch: Record<string, unknown>; _metrics?: AgentOperationMetrics }
  | { op: 'schema.patchColumns'; label?: string; nodeId: string; columns: unknown; _metrics?: AgentOperationMetrics }
  | { op: 'schema.insertNode'; label?: string; parentId?: string; container?: 'body' | 'dialogs'; index?: number; node: SchemaNode; _metrics?: AgentOperationMetrics }
  | { op: 'schema.removeNode'; label?: string; nodeId: string; _metrics?: AgentOperationMetrics }
  | { op: 'schema.replace'; label?: string; schema: PageSchema; _metrics?: AgentOperationMetrics };

export type PageType = 'dashboard' | 'list' | 'form' | 'detail' | 'statistics' | 'custom';

export type LayoutRow =
  | { blocks: string[] }
  | { columns: Array<{ span: number; blocks: string[] }> };

export interface RunRequest {
  prompt: string;
  attachments?: RunAttachmentInput[];
  intent?: AgentIntent;
  plannerModel?: string;
  blockModel?: string;
  conversationId?: string;
  selectedNodeId?: string;
  thinking?: ThinkingConfig;
  /** 并发生成 block 的最大数量，范围 1-8，默认 3 */
  blockConcurrency?: number;
  context: {
    schemaSummary: string;
    componentSummary: string;
    schemaJson?: PageSchema;
    workspaceFileIds?: string[];
  };
}

export interface ClassifyRouteRequest {
  prompt: string;
  attachments?: RunAttachmentInput[];
  plannerModel?: string;
  thinking?: ThinkingConfig;
  context: {
    schemaSummary: string;
  };
}

export interface ClassifyRouteResponse {
  scope: AgentScope;
  intent: AgentIntent;
  confidence: number;
  /** 提取附件文档内容后的完整 prompt，供 Agent Loop 的 user message 使用 */
  preparedPrompt?: string;
}

export interface RunMetadata {
  sessionId: string;
  conversationId?: string;
  plannerModel?: string;
  blockModel?: string;
  tokensUsed?: number;
  durationMs?: number;
  debugFile?: string;
  memoryDebugFile?: string;
  repairs?: Array<{ message: string; path?: string }>;
}

export interface PagePlan {
  pageTitle: string;
  pageType: PageType;
  layout?: LayoutRow[];
  blocks: Array<{
    id: string;
    description: string;
    components: string[];
    priority: number;
    complexity: 'simple' | 'medium' | 'complex';
  }>;
}

export interface FinalizeRequest {
  conversationId: string;
  sessionId: string;
  success: boolean;
  failedOpIndex?: number;
  error?: string;
  schemaDigest?: string;
}

export interface FinalizeResult {
  memoryDebugFile?: string;
}

export interface ModifyResult {
  explanation: string;
  operations: AgentOperation[];
}

export type AgentEvent =
  | { type: 'run:start'; data: { sessionId: string; conversationId?: string } }
  | { type: 'intent'; data: { intent: AgentIntent; confidence: number; scope?: AgentScope } }
  | { type: 'message:start'; data: { role: 'assistant' } }
  | { type: 'message:delta'; data: { text: string } }
  | { type: 'tool:start'; data: { tool: string; label?: string } }
  | { type: 'tool:result'; data: { tool: string; ok: boolean; summary?: string } }
  | { type: 'plan'; data: PagePlan & { _plannerMetrics?: AgentOperationMetrics } }
  | { type: 'modify:start'; data: { operationCount: number; explanation: string; operations: Array<{ op: string; label?: string; nodeId?: string }> } }
  | { type: 'modify:op:pending'; data: { index: number; label?: string } }
  | { type: 'modify:op'; data: { index: number; operation: AgentOperation; metrics?: AgentOperationMetrics } }
  | { type: 'modify:done'; data: {} }
  | { type: 'schema:skeleton'; data: { schema: PageSchema } }
  | { type: 'schema:block:start'; data: { blockId: string; description: string } }
  | { type: 'schema:block'; data: { blockId: string; node: SchemaNode; tokensUsed?: number; inputTokens?: number; outputTokens?: number; durationMs?: number } }
  | { type: 'schema:done'; data: { schema: PageSchema } }
  | { type: 'done'; data: { metadata: RunMetadata } }
  | { type: 'error'; data: { message: string; code?: string } };

export interface RunResponse {
  success: true;
  data: {
    events: AgentEvent[];
    metadata: RunMetadata;
  };
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  maxTokens?: number;
  features?: string[];
  costPer1kTokens?: {
    input: number;
    output: number;
  };
}

export interface FeedbackRequest {
  sessionId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  feedback?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

export function createSchemaDigest(schema: PageSchema | undefined): string | undefined {
  if (!schema) {
    return undefined;
  }
  const text = JSON.stringify(schema);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
