import type { ComponentContract, PageSchema, SchemaNode } from '@shenbi/schema';

export interface RunRequest {
  prompt: string;
  plannerModel?: string;
  blockModel?: string;
  conversationId?: string;
  selectedNodeId?: string;
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

export interface RunResponse {
  success: true;
  data: {
    events: AgentEvent[];
    metadata: RunMetadata;
  };
}

export interface AgentTool<TInput = unknown, TOutput = unknown> {
  name: string;
  execute(input: TInput): Promise<TOutput>;
}

export interface AgentToolRegistry {
  get(name: string): AgentTool | undefined;
  list(): AgentTool[];
}

export interface AgentMemoryMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface AgentMemoryEntry {
  conversation: AgentMemoryMessage[];
  lastRunMetadata?: RunMetadata;
  lastBlockIds: string[];
}

export interface AgentMemoryStore {
  getConversation(conversationId: string): Promise<AgentMemoryMessage[]>;
  appendConversationMessage(conversationId: string, message: AgentMemoryMessage): Promise<void>;
  getLastRunMetadata(conversationId: string): Promise<RunMetadata | undefined>;
  setLastRunMetadata(conversationId: string, metadata: RunMetadata): Promise<void>;
  getLastBlockIds(conversationId: string): Promise<string[]>;
  setLastBlockIds(conversationId: string, blockIds: string[]): Promise<void>;
}

export interface AgentLogger {
  info(message: string, payload?: Record<string, unknown>): void;
  error(message: string, payload?: Record<string, unknown>): void;
}

export interface ChatChunk {
  text: string;
}

export interface AgentRuntimeDeps {
  llm: {
    chat(request: unknown): Promise<unknown>;
    streamChat(request: unknown): AsyncIterable<ChatChunk>;
  };
  tools: AgentToolRegistry;
  memory: AgentMemoryStore;
  logger?: AgentLogger;
}

export interface AgentRuntimeContext {
  prompt: string;
  selectedNodeId?: string;
  schemaSummary: string;
  componentSummary: string;
  recentConversation: AgentMemoryMessage[];
  lastRunMetadata?: RunMetadata;
  lastBlockIds: string[];
}

export interface PlanPageInput {
  request: RunRequest;
  context: AgentRuntimeContext;
}

export interface GenerateBlockInput {
  block: PagePlanBlock;
  request: RunRequest;
  context: AgentRuntimeContext;
}

export interface GenerateBlockResult {
  blockId: string;
  node: SchemaNode;
  summary?: string;
}

export interface AssembleSchemaInput {
  plan: PagePlan;
  blocks: GenerateBlockResult[];
  request: RunRequest;
}

export interface RepairSchemaInput {
  schema: PageSchema;
  request: RunRequest;
}

export interface RepairSchemaResult {
  schema: PageSchema;
  repairs?: Array<{ message: string; path?: string }>;
}

export interface BuildContextInput {
  request: RunRequest;
  conversation: AgentMemoryMessage[];
  lastRunMetadata?: RunMetadata;
  lastBlockIds: string[];
}

export type ComponentSummarySource = ComponentContract[];
