import { createMiddleware } from 'hono/factory';
import { logger } from '../adapters/logger.ts';

export const requestIdMiddleware = createMiddleware(async (c, next) => {
  const requestId =
    c.req.header('x-request-id') ?? `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  c.set('requestId' as never, requestId);
  c.header('x-request-id', requestId);

  const start = Date.now();
  logger.info('ai.request.incoming', {
    requestId,
    method: c.req.method,
    path: c.req.path,
  });

  await next();

  logger.info('ai.request.duration_ms', {
    requestId,
    durationMs: Date.now() - start,
    status: c.res.status,
  });
});
