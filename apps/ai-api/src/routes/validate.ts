/**
 * RunRequest 校验 — 首版必须校验 prompt、context.schemaSummary、context.componentSummary
 */
import { ValidationError } from '../adapters/errors.ts';
import type { RunRequest } from '@shenbi/ai-contracts';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isSchemaNodeLike(value: unknown): boolean {
  return isRecord(value) && typeof value['component'] === 'string';
}

function isPageSchemaLike(value: unknown): boolean {
  if (!isRecord(value) || !('body' in value)) {
    return false;
  }
  const body = value['body'];
  return Array.isArray(body)
    ? body.every((item) => isSchemaNodeLike(item))
    : isSchemaNodeLike(body);
}

export function validateRunRequest(body: unknown): RunRequest {
  if (!isRecord(body)) {
    throw new ValidationError('Request body must be a JSON object');
  }

  if (typeof body['prompt'] !== 'string' || body['prompt'].trim() === '') {
    throw new ValidationError('prompt is required and must be a non-empty string');
  }

  if (!isRecord(body['context'])) {
    throw new ValidationError('context is required and must be an object');
  }

  const ctx = body['context'];

  if (typeof ctx['schemaSummary'] !== 'string' || ctx['schemaSummary'].trim() === '') {
    throw new ValidationError('context.schemaSummary is required and must be a non-empty string');
  }

  if (typeof ctx['componentSummary'] !== 'string' || ctx['componentSummary'].trim() === '') {
    throw new ValidationError('context.componentSummary is required and must be a non-empty string');
  }

  const req: RunRequest = {
    prompt: body['prompt'].trim(),
    context: {
      schemaSummary: ctx['schemaSummary'],
      componentSummary: ctx['componentSummary'],
    },
  };

  if (ctx['schemaJson'] !== undefined) {
    if (!isPageSchemaLike(ctx['schemaJson'])) {
      throw new ValidationError('context.schemaJson must be a valid PageSchema');
    }
    req.context.schemaJson = ctx['schemaJson'] as NonNullable<RunRequest['context']['schemaJson']>;
  }

  if (ctx['workspaceFileIds'] !== undefined) {
    if (!Array.isArray(ctx['workspaceFileIds']) || !ctx['workspaceFileIds'].every((item) => typeof item === 'string')) {
      throw new ValidationError('context.workspaceFileIds must be an array of strings');
    }
    req.context.workspaceFileIds = [...ctx['workspaceFileIds']];
  }

  if (typeof body['plannerModel'] === 'string') req.plannerModel = body['plannerModel'];
  if (typeof body['blockModel'] === 'string') req.blockModel = body['blockModel'];
  if (typeof body['conversationId'] === 'string') req.conversationId = body['conversationId'];
  if (typeof body['selectedNodeId'] === 'string') req.selectedNodeId = body['selectedNodeId'];
  if (isRecord(body['thinking'])) {
    const thinkingType = body['thinking']['type'];
    if (thinkingType === 'enabled' || thinkingType === 'disabled') {
      req.thinking = { type: thinkingType };
    } else {
      throw new ValidationError('thinking.type must be "enabled" or "disabled"');
    }
  }

  return req;
}
