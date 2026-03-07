import type { ComponentContract, PageSchema, SchemaNode } from '@shenbi/schema';

export interface RunMetadata {
  tokensUsed?: number;
  durationMs?: number;
  [key: string]: unknown;
}

export type AgentEvent =
  | { type: 'run:start'; data?: unknown }
  | { type: 'message:start'; data?: unknown }
  | { type: 'message:delta'; data: string }
  | { type: 'tool:start'; data: { name: string; input?: unknown } }
  | { type: 'tool:result'; data: { name: string; summary: string } }
  | { type: 'plan'; data: { title?: string; blocks: Array<{ type: string; description: string }> } }
  | { type: 'schema:block'; data: { node: SchemaNode; parentTreeId?: string } }
  | { type: 'schema:update'; data: { treeId: string; node: SchemaNode } }
  | { type: 'schema:done'; data: PageSchema }
  | { type: 'error'; data: { message: string } }
  | { type: 'done'; data: { metadata?: RunMetadata } };

export interface RunRequestContext {
  schemaSummary: string; // Serialized schema summary
  componentSummary: string; // Serialized component summary
}

export interface RunRequest {
  prompt: string;
  conversationId?: string | undefined; // Optional for ongoing conversations
  selectedNodeId?: string | undefined; // Context mapping
  context: RunRequestContext;
  plannerModel?: string | undefined;
  blockModel?: string | undefined;
}

/**
 * Common shape for the AI API Client.
 */
export interface AIClient {
  runStream(request: RunRequest): AsyncIterable<AgentEvent>;
}
