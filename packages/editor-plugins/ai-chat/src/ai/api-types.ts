import type { PagePlan, AgentEvent, RunMetadata, RunRequest } from '@shenbi/ai-contracts';

export type { AgentEvent, PagePlan, RunMetadata, RunRequest } from '@shenbi/ai-contracts';

export interface RunStreamOptions {
  signal?: AbortSignal;
}

export interface AIClient {
  runStream(request: RunRequest, options?: RunStreamOptions): AsyncIterable<AgentEvent>;
}
