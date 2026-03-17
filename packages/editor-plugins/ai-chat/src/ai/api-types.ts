import type {
  AgentEvent,
  AgentIntent,
  AgentScope,
  AgentOperation,
  ChatRequest,
  ChatResponse,
  ClassifyRouteRequest,
  ClassifyRouteResponse,
  FinalizeRequest,
  FinalizeResult,
  LoopSessionState,
  PagePlan,
  ProjectPlan,
  ReActStep,
  RunAttachmentInput,
  RunMetadata,
  RunRequest,
} from '@shenbi/ai-contracts';

export type {
  AgentEvent,
  AgentIntent,
  AgentScope,
  AgentOperation,
  ChatRequest,
  ChatResponse,
  ClassifyRouteRequest,
  ClassifyRouteResponse,
  FinalizeRequest,
  FinalizeResult,
  LoopSessionState,
  PagePlan,
  ProjectPlan,
  ReActStep,
  RunAttachmentInput,
  RunMetadata,
  RunRequest,
} from '@shenbi/ai-contracts';
export { createSchemaDigest } from '@shenbi/ai-contracts';

export interface RunStreamOptions {
  signal?: AbortSignal;
}

export interface AIClient {
  runStream(request: RunRequest, options?: RunStreamOptions): AsyncIterable<AgentEvent>;
  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream(request: ChatRequest, options?: RunStreamOptions): AsyncIterable<{ delta: string }>;
  finalize(request: FinalizeRequest): Promise<FinalizeResult>;
  classifyRoute(request: ClassifyRouteRequest): Promise<ClassifyRouteResponse>;
}
