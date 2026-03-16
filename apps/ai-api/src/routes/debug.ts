import { Hono } from 'hono';
import { writeErrorDump } from '../adapters/debug-dump.ts';

export function createDebugRoute(): Hono {
  const app = new Hono();

  app.post('/client-error', async (c) => {
    const body = await c.req.json().catch(() => null);
    const requestId = (c.get('requestId' as never) as string | undefined) ?? 'unknown';
    const error = body && typeof body === 'object' && 'error' in body
      ? (body as { error?: unknown }).error
      : 'Client debug dump';

    const debugFile = writeErrorDump({
      category: 'client-debug',
      error,
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: 200,
      code: 'CLIENT_DEBUG_DUMP',
      request: body,
    });

    return c.json({
      success: true,
      data: {
        debugFile,
      },
    });
  });

  return app;
}
