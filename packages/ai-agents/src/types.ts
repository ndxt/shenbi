import type { ComponentContract, PageSchema, SchemaNode } from '@shenbi/schema';
import type {
  AgentEvent,
  FeedbackRequest,
  ModelInfo,
  PagePlan as SharedPagePlan,
  PageType,
  RunMetadata,
  RunRequest,
  RunResponse,
  ZoneType,
} from '@shenbi/ai-contracts';

export type {
  AgentEvent,
  FeedbackRequest,
  ModelInfo,
  PageType,
  RunMetadata,
  RunRequest,
  RunResponse,
  ZoneType,
} from '@shenbi/ai-contracts';

export type PagePlan = SharedPagePlan;
export type PagePlanBlock = PagePlan['blocks'][number];

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
