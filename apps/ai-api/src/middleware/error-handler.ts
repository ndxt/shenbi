import type { Context } from 'hono';
import { errorToBody, errorToStatus } from '../adapters/errors.ts';
import { writeErrorDump } from '../adapters/debug-dump.ts';
import { logger } from '../adapters/logger.ts';

export function handleError(error: unknown, c: Context): Response {
  const status = errorToStatus(error);
  const requestId = (c.get('requestId' as never) as string | undefined) ?? 'unknown';
  const request = c.get('runRequest' as never) as unknown;
  const body = errorToBody(error);

  if (!body.error.includes('Debug file:')) {
    const debugFile = writeErrorDump({
      category: 'http-error',
      error,
      requestId,
      method: c.req.method,
      path: c.req.path,
      status,
      code: body.code,
      request,
    });
    body.error = `${body.error}. Debug file: ${debugFile}`;
  }

  if (status >= 500) {
    logger.error('ai.request.error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      path: c.req.path,
      debugFile: body.error.includes('Debug file:') ? body.error.split('Debug file: ')[1] : undefined,
    });
  } else {
    logger.warn('ai.request.client_error', {
      requestId,
      error: body.error,
      code: body.code,
      status,
      path: c.req.path,
    });
  }

  return c.json(body, status as 400 | 429 | 500 | 503);
}
