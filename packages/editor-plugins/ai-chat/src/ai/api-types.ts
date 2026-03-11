import type { AgentEvent, AgentIntent, AgentOperation, FinalizeRequest, PagePlan, RunMetadata, RunRequest } from '@shenbi/ai-contracts';

export type { AgentEvent, AgentIntent, AgentOperation, FinalizeRequest, PagePlan, RunMetadata, RunRequest } from '@shenbi/ai-contracts';
export { createSchemaDigest } from '@shenbi/ai-contracts';

export interface RunStreamOptions {
  signal?: AbortSignal;
}

export interface AIClient {
  runStream(request: RunRequest, options?: RunStreamOptions): AsyncIterable<AgentEvent>;
  finalize(request: FinalizeRequest): Promise<void>;
}
