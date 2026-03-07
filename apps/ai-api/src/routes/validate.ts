/**
 * RunRequest 校验 — 首版必须校验 prompt、context.schemaSummary、context.componentSummary
 */
import { ValidationError } from '../adapters/errors.ts';
import type { RunRequest } from '@shenbi/ai-contracts';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
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

  if (typeof body['plannerModel'] === 'string') req.plannerModel = body['plannerModel'];
  if (typeof body['blockModel'] === 'string') req.blockModel = body['blockModel'];
  if (typeof body['conversationId'] === 'string') req.conversationId = body['conversationId'];
  if (typeof body['selectedNodeId'] === 'string') req.selectedNodeId = body['selectedNodeId'];

  return req;
}
