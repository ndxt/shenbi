import type { PageSchema, SchemaNode } from '@shenbi/schema';

export interface ThinkingConfig {
  type: 'enabled' | 'disabled';
}

export type PageType = 'dashboard' | 'list' | 'form' | 'detail' | 'statistics' | 'custom';

export type LayoutRow =
  | { blocks: string[] }
  | { columns: Array<{ span: number; blocks: string[] }> };

export interface RunRequest {
  prompt: string;
  plannerModel?: string;
  blockModel?: string;
  conversationId?: string;
  selectedNodeId?: string;
  thinking?: ThinkingConfig;
  context: {
    schemaSummary: string;
    componentSummary: string;
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

export type AgentEvent =
  | { type: 'run:start'; data: { sessionId: string; conversationId?: string } }
  | { type: 'message:start'; data: { role: 'assistant' } }
  | { type: 'message:delta'; data: { text: string } }
  | { type: 'tool:start'; data: { tool: string; label?: string } }
  | { type: 'tool:result'; data: { tool: string; ok: boolean; summary?: string } }
  | { type: 'plan'; data: PagePlan }
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
