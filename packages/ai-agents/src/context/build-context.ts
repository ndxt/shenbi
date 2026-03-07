import type { AgentRuntimeContext, BuildContextInput } from '../types';

export function buildRuntimeContext(input: BuildContextInput): AgentRuntimeContext {
  return {
    prompt: input.request.prompt,
    ...(input.request.selectedNodeId ? { selectedNodeId: input.request.selectedNodeId } : {}),
    schemaSummary: input.request.context.schemaSummary,
    componentSummary: input.request.context.componentSummary,
    recentConversation: input.conversation,
    ...(input.lastRunMetadata ? { lastRunMetadata: input.lastRunMetadata } : {}),
    lastBlockIds: input.lastBlockIds,
  };
}
