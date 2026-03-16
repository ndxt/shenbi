import type { LoopSessionState, ProjectPlan, ReActStep } from './api-types';

export type UIPhase =
  | 'idle'
  | 'thinking'
  | 'awaiting_confirmation'
  | 'executing'
  | 'done'
  | 'error';

export type AgentLoopPageStatus =
  | 'waiting'
  | 'running'
  | 'done'
  | 'failed'
  | 'skipped';

export interface AgentLoopBlockProgress {
  id: string;
  label: string;
  status: 'waiting' | 'generating' | 'done' | 'failed';
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AgentLoopPageProgress {
  pageId: string;
  pageName: string;
  action: 'create' | 'modify' | 'skip';
  description: string;
  status: AgentLoopPageStatus;
  reason?: string;
  fileId?: string;
  durationMs?: number;
  error?: string;
  blocks: AgentLoopBlockProgress[];
}

export interface AgentLoopResultSummary {
  projectPlan?: ProjectPlan;
  trace: ReActStep[];
  pages: AgentLoopPageProgress[];
  createdFileIds: string[];
  loopState?: LoopSessionState;
  traceFile?: string;
}

export interface PersistedAgentLoopState {
  loopState: LoopSessionState;
  reactMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  projectPlan?: ProjectPlan;
  trace: ReActStep[];
  pages: AgentLoopPageProgress[];
  createdFileIds: string[];
}
