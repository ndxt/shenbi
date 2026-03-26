/**
 * Runtime 接口定义 — API Host 通过此接口调用 Agent，不直接依赖 ai-agents 实现
 * 当前默认装配为 provider-backed agent runtime，路由层只依赖该接口。
 */
import type {
  AgentEvent,
  ChatRequest,
  ChatResponse,
  ClassifyRouteRequest,
  ClassifyRouteResponse,
  FinalizeRequest,
  FinalizeResult,
  ModelInfo,
  ProjectAgentEvent,
  ProjectCancelRequest,
  ProjectConfirmRequest,
  ProjectReviseRequest,
  ProjectRunRequest,
  ProjectSessionMutationResult,
  RunMetadata,
  RunRequest,
} from '@shenbi/ai-contracts';

export interface ClientDebugDumpInput {
  error: unknown;
  requestId?: string;
  method?: string;
  path?: string;
  request?: unknown;
}

export interface TraceDebugDumpInput {
  status: 'success' | 'error';
  trace: unknown;
}

export interface AgentRuntime {
  run(request: RunRequest): Promise<{ events: AgentEvent[]; metadata: RunMetadata }>;
  runStream(request: RunRequest): AsyncIterable<AgentEvent>;
  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream(request: ChatRequest): AsyncIterable<{ delta: string }>;
  classifyRoute(request: ClassifyRouteRequest): Promise<ClassifyRouteResponse>;
  finalize(request: FinalizeRequest): Promise<FinalizeResult>;
}

export interface AiApiService extends AgentRuntime {
  listModels(): Promise<ModelInfo[]> | ModelInfo[];
  writeClientDebug(input: ClientDebugDumpInput): Promise<string> | string;
  writeTraceDebug(input: TraceDebugDumpInput): Promise<string> | string;
  projectStream(request: ProjectRunRequest): AsyncIterable<ProjectAgentEvent>;
  confirmProject(request: ProjectConfirmRequest): Promise<ProjectSessionMutationResult>;
  reviseProject(request: ProjectReviseRequest): Promise<ProjectSessionMutationResult>;
  cancelProject(request: ProjectCancelRequest): Promise<ProjectSessionMutationResult>;
}
