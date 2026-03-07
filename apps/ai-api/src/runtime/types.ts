/**
 * Runtime 接口定义 — API Host 通过此接口调用 Agent，不直接依赖 ai-agents 实现
 * 二期：packages/ai-agents 实现此接口后，在 app.ts 装配点替换 fakeRuntime
 */
import type { AgentEvent, RunMetadata, RunRequest } from '@shenbi/ai-contracts';

export interface AgentRuntime {
  run(request: RunRequest): Promise<{ events: AgentEvent[]; metadata: RunMetadata }>;
  runStream(request: RunRequest): AsyncIterable<AgentEvent>;
}
