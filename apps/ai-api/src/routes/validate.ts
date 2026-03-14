/**
 * RunRequest 校验 — 首版必须校验 prompt、context.schemaSummary、context.componentSummary
 */
import { ValidationError } from '../adapters/errors.ts';
import type { FinalizeRequest, RunRequest } from '@shenbi/ai-contracts';
import { MAX_ATTACHMENT_BYTES, SUPPORTED_DOCUMENT_MIME_TYPES } from '../runtime/request-attachments.ts';

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

function isValidAttachmentMime(kind: unknown, mimeType: unknown): boolean {
  if (typeof mimeType !== 'string') {
    return false;
  }
  if (kind === 'image') {
    return mimeType.startsWith('image/');
  }
  if (kind === 'document') {
    return SUPPORTED_DOCUMENT_MIME_TYPES.has(mimeType);
  }
  return false;
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

  if (body['attachments'] !== undefined) {
    if (!Array.isArray(body['attachments'])) {
      throw new ValidationError('attachments must be an array');
    }
    req.attachments = body['attachments'].map((attachment, index) => {
      if (!isRecord(attachment)) {
        throw new ValidationError(`attachments[${index}] must be an object`);
      }

      const kind = attachment['kind'];
      const name = attachment['name'];
      const mimeType = attachment['mimeType'];
      const sizeBytes = attachment['sizeBytes'];
      const dataUrl = attachment['dataUrl'];
      const id = attachment['id'];

      if (typeof id !== 'string' || id.trim() === '') {
        throw new ValidationError(`attachments[${index}].id must be a non-empty string`);
      }
      if (kind !== 'image' && kind !== 'document') {
        throw new ValidationError(`attachments[${index}].kind must be "image" or "document"`);
      }
      if (typeof name !== 'string' || name.trim() === '') {
        throw new ValidationError(`attachments[${index}].name must be a non-empty string`);
      }
      if (!isValidAttachmentMime(kind, mimeType)) {
        throw new ValidationError(`attachments[${index}].mimeType is not supported`);
      }
      if (!Number.isFinite(sizeBytes) || Number(sizeBytes) <= 0 || Number(sizeBytes) > MAX_ATTACHMENT_BYTES) {
        throw new ValidationError(`attachments[${index}].sizeBytes must be between 1 and ${MAX_ATTACHMENT_BYTES}`);
      }
      if (
        typeof dataUrl !== 'string'
        || !dataUrl.startsWith(`data:${mimeType};base64,`)
      ) {
        throw new ValidationError(`attachments[${index}].dataUrl must be a matching base64 data URL`);
      }

      return {
        id: id.trim(),
        kind,
        name: name.trim(),
        mimeType: mimeType as string,
        sizeBytes: Number(sizeBytes),
        dataUrl,
      };
    });
  }

  if (typeof body['plannerModel'] === 'string') req.plannerModel = body['plannerModel'];
  if (typeof body['blockModel'] === 'string') req.blockModel = body['blockModel'];
  if (typeof body['conversationId'] === 'string') req.conversationId = body['conversationId'];
  if (typeof body['selectedNodeId'] === 'string') req.selectedNodeId = body['selectedNodeId'];
  if (body['intent'] !== undefined) {
    if (body['intent'] === 'schema.create' || body['intent'] === 'schema.modify' || body['intent'] === 'chat') {
      req.intent = body['intent'];
    } else {
      throw new ValidationError('intent must be "schema.create", "schema.modify", or "chat"');
    }
  }
  if (isRecord(body['thinking'])) {
    const thinkingType = body['thinking']['type'];
    if (thinkingType === 'enabled' || thinkingType === 'disabled') {
      req.thinking = { type: thinkingType };
    } else {
      throw new ValidationError('thinking.type must be "enabled" or "disabled"');
    }
  }

  if (typeof body['blockConcurrency'] === 'number') {
    const c = Math.floor(body['blockConcurrency']);
    if (c >= 1 && c <= 8) {
      req.blockConcurrency = c;
    }
  }

  return req;
}

export function validateFinalizeRequest(body: unknown): FinalizeRequest {
  if (!isRecord(body)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  if (typeof body['conversationId'] !== 'string' || body['conversationId'].trim() === '') {
    throw new ValidationError('conversationId is required and must be a non-empty string');
  }
  if (typeof body['sessionId'] !== 'string' || body['sessionId'].trim() === '') {
    throw new ValidationError('sessionId is required and must be a non-empty string');
  }
  if (typeof body['success'] !== 'boolean') {
    throw new ValidationError('success is required and must be a boolean');
  }

  const request: FinalizeRequest = {
    conversationId: body['conversationId'].trim(),
    sessionId: body['sessionId'].trim(),
    success: body['success'],
  };

  if (body['failedOpIndex'] !== undefined) {
    if (!Number.isInteger(body['failedOpIndex']) || Number(body['failedOpIndex']) < 0) {
      throw new ValidationError('failedOpIndex must be a non-negative integer');
    }
    request.failedOpIndex = Number(body['failedOpIndex']);
  }
  if (body['error'] !== undefined) {
    if (typeof body['error'] !== 'string' || body['error'].trim() === '') {
      throw new ValidationError('error must be a non-empty string');
    }
    request.error = body['error'];
  }
  if (body['schemaDigest'] !== undefined) {
    if (typeof body['schemaDigest'] !== 'string' || body['schemaDigest'].trim() === '') {
      throw new ValidationError('schemaDigest must be a non-empty string');
    }
    request.schemaDigest = body['schemaDigest'];
  }

  return request;
}
