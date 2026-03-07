import type { Context } from 'hono';
import { errorToBody, errorToStatus } from '../adapters/errors.ts';
import { logger } from '../adapters/logger.ts';

export function handleError(error: unknown, c: Context): Response {
  const status = errorToStatus(error);
  const body = errorToBody(error);

  if (status >= 500) {
    logger.error('ai.request.error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      path: c.req.path,
    });
  } else {
    logger.warn('ai.request.client_error', {
      error: body.error,
      code: body.code,
      status,
      path: c.req.path,
    });
  }

  return c.json(body, status as 400 | 429 | 500 | 503);
}
