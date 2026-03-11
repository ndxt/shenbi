import type { PageSchema, SchemaNode } from '@shenbi/schema';

export interface ThinkingConfig {
  type: 'enabled' | 'disabled';
}

export type AgentIntent =
  | 'schema.create'
  | 'schema.modify'
  | 'chat';

export type AgentOperation =
  | { op: 'schema.patchProps'; nodeId: string; patch: Record<string, unknown> }
  | { op: 'schema.patchStyle'; nodeId: string; patch: Record<string, unknown> }
  | { op: 'schema.patchEvents'; nodeId: string; patch: Record<string, unknown> }
  | { op: 'schema.patchLogic'; nodeId: string; patch: Record<string, unknown> }
  | { op: 'schema.patchColumns'; nodeId: string; columns: unknown }
  | { op: 'schema.insertNode'; parentId?: string; container?: 'body' | 'dialogs'; index?: number; node: SchemaNode }
  | { op: 'schema.removeNode'; nodeId: string }
  | { op: 'schema.replace'; schema: PageSchema };

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
  | { type: 'modify:start'; data: { operationCount: number; explanation: string } }
  | { type: 'modify:op'; data: { index: number; operation: AgentOperation } }
  | { type: 'modify:done'; data: {} }
  | { type: 'schema:skeleton'; data: { schema: PageSchema } }
  | { type: 'schema:block:start'; data: { blockId: string; description: string } }
  | { type: 'schema:block'; data: { blockId: string; node: SchemaNode } }
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
