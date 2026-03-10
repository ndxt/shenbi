import type { AgentRuntimeContext, BuildContextInput } from '../types';
import { serializeSchemaTree } from './schema-tree';

function getTurnCount(messages: BuildContextInput['conversation']): number {
  const userTurnCount = messages.filter((message) => message.role === 'user').length;
  if (userTurnCount > 0) {
    return userTurnCount;
  }
  return messages.length > 0 ? 1 : 0;
}

function getLastOperations(messages: BuildContextInput['conversation']) {
  return [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.meta?.operations?.length && message.meta.failed !== true)
    ?.meta?.operations;
}

export function buildRuntimeContext(input: BuildContextInput): AgentRuntimeContext {
  const schema = input.request.context.schemaJson;
  const conversationHistory = input.conversation;
  const lastOperations = getLastOperations(conversationHistory);
  const tree = schema ? serializeSchemaTree(schema) : undefined;

  return {
    prompt: input.request.prompt,
    ...(input.request.selectedNodeId ? { selectedNodeId: input.request.selectedNodeId } : {}),
    document: {
      exists: Boolean(schema || input.request.context.schemaSummary.trim()),
      summary: input.request.context.schemaSummary,
      ...(tree ? { tree } : {}),
      ...(schema ? { schema } : {}),
    },
    componentSummary: input.request.context.componentSummary,
    conversation: {
      history: conversationHistory,
      turnCount: getTurnCount(conversationHistory),
      ...(lastOperations ? { lastOperations } : {}),
    },
    ...(input.lastRunMetadata ? { lastRunMetadata: input.lastRunMetadata } : {}),
    lastBlockIds: input.lastBlockIds,
  };
}
