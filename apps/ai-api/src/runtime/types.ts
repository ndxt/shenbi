/**
 * Runtime 接口定义 — API Host 通过此接口调用 Agent，不直接依赖 ai-agents 实现
 * 当前默认装配为 provider-backed agent runtime，路由层只依赖该接口。
 */
import type {
  AgentEvent,
  ChatRequest,
  ChatResponse,
  FinalizeRequest,
  FinalizeResult,
  RunMetadata,
  RunRequest,
} from '@shenbi/ai-contracts';

export interface AgentRuntime {
  run(request: RunRequest): Promise<{ events: AgentEvent[]; metadata: RunMetadata }>;
  runStream(request: RunRequest): AsyncIterable<AgentEvent>;
  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream(request: ChatRequest): AsyncIterable<{ delta: string }>;
  finalize(request: FinalizeRequest): Promise<FinalizeResult>;
}
