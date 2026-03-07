/**
 * 共享契约类型 — 与 ai-plan.md 冻结基线逐字保持一致
 * SchemaNode / PageSchema 从 @shenbi/schema 导入，不自行定义
 * API Host 只负责透传和序列化，不新增宿主私有字段
 */
import type { SchemaNode, PageSchema } from '@shenbi/schema';

export interface RunRequest {
  prompt: string;
  plannerModel?: string | undefined;
  blockModel?: string | undefined;
  conversationId?: string | undefined;
  selectedNodeId?: string | undefined;
  context: {
    schemaSummary: string;
    componentSummary: string;
  };
}

export interface RunMetadata {
  sessionId: string;
  conversationId?: string | undefined;
  plannerModel?: string | undefined;
  blockModel?: string | undefined;
  tokensUsed?: number | undefined;
  durationMs?: number | undefined;
  repairs?: Array<{ message: string; path?: string | undefined }> | undefined;
}

export interface PagePlan {
  pageTitle: string;
  blocks: Array<{
    id: string;
    type: string;
    description: string;
    components: string[];
    priority: number;
    complexity: 'simple' | 'medium' | 'complex';
  }>;
}

export type AgentEvent =
  | { type: 'run:start'; data: { sessionId: string; conversationId?: string } }
  | { type: 'message:start'; data: { role: 'assistant' } }
  | { type: 'message:delta'; data: { text: string } }
  | { type: 'tool:start'; data: { tool: string; label?: string } }
  | { type: 'tool:result'; data: { tool: string; ok: boolean; summary?: string } }
  | { type: 'plan'; data: PagePlan }
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
