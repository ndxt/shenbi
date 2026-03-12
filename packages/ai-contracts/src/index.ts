import type { PageSchema, SchemaNode } from '@shenbi/schema';

export interface ThinkingConfig {
  type: 'enabled' | 'disabled';
}

export type AgentIntent =
  | 'schema.create'
  | 'schema.modify'
  | 'chat';

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
  | { type: 'intent'; data: { intent: AgentIntent; confidence: number } }
  | { type: 'message:start'; data: { role: 'assistant' } }
  | { type: 'message:delta'; data: { text: string } }
  | { type: 'tool:start'; data: { tool: string; label?: string } }
  | { type: 'tool:result'; data: { tool: string; ok: boolean; summary?: string } }
  | { type: 'plan'; data: PagePlan }
  | { type: 'modify:start'; data: { operationCount: number; explanation: string; operations: Array<{ op: string; label?: string; nodeId?: string }> } }
  | { type: 'modify:op'; data: { index: number; operation: AgentOperation; metrics?: AgentOperationMetrics } }
  | { type: 'modify:done'; data: {} }
  | { type: 'schema:skeleton'; data: { schema: PageSchema } }
  | { type: 'schema:block:start'; data: { blockId: string; description: string } }
  | { type: 'schema:block'; data: { blockId: string; node: SchemaNode; tokensUsed?: number } }
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
