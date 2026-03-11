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

function hasSchemaContent(schema: BuildContextInput['request']['context']['schemaJson']): boolean {
  if (!schema) {
    return false;
  }
  const bodyCount = Array.isArray(schema.body) ? schema.body.length : (schema.body ? 1 : 0);
  const dialogCount = Array.isArray(schema.dialogs) ? schema.dialogs.length : (schema.dialogs ? 1 : 0);
  return bodyCount + dialogCount > 0;
}

function hasDocumentSummary(summary: string): boolean {
  const normalized = summary.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return !normalized.includes('nodecount=0') && normalized !== 'empty page';
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
      exists: hasSchemaContent(schema) || hasDocumentSummary(input.request.context.schemaSummary),
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
