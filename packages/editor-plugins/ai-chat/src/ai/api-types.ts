import type { PageSchema, SchemaNode } from '@shenbi/schema';

export interface RunRequestContext {
  schemaSummary: string;
  componentSummary: string;
}

export interface RunRequest {
  prompt: string;
  plannerModel?: string;
  blockModel?: string;
  conversationId?: string;
  selectedNodeId?: string;
  context: RunRequestContext;
}

export interface RunMetadata {
  sessionId: string;
  conversationId?: string;
  plannerModel?: string;
  blockModel?: string;
  tokensUsed?: number;
  durationMs?: number;
  repairs?: Array<{ message: string; path?: string }>;
}

export interface PagePlanBlock {
  id: string;
  type: string;
  description: string;
  components: string[];
  priority: number;
  complexity: 'simple' | 'medium' | 'complex';
}

export interface PagePlan {
  pageTitle: string;
  blocks: PagePlanBlock[];
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

export interface RunStreamOptions {
  signal?: AbortSignal;
}

export interface AIClient {
  runStream(request: RunRequest, options?: RunStreamOptions): AsyncIterable<AgentEvent>;
}
