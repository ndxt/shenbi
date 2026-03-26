import { Hono } from 'hono';
import type { AiApiService } from '../runtime/types.ts';

export function createDebugRoute(service: AiApiService): Hono {
  const app = new Hono();

  app.post('/client-error', async (c) => {
    const body = await c.req.json().catch(() => null);
    const requestId = (c.get('requestId' as never) as string | undefined) ?? 'unknown';
    const error = body && typeof body === 'object' && 'error' in body
      ? (body as { error?: unknown }).error
      : 'Client debug dump';

    const debugFile = await service.writeClientDebug({
      error,
      requestId,
      method: c.req.method,
      path: c.req.path,
      request: body,
    });

    return c.json({
      success: true,
      data: {
        debugFile,
      },
    });
  });

  app.post('/trace', async (c) => {
    const body = await c.req.json().catch(() => null);
    const status = body && typeof body === 'object' && (body as { status?: unknown }).status === 'error'
      ? 'error'
      : 'success';
    const trace = body && typeof body === 'object' && 'trace' in body
      ? (body as { trace?: unknown }).trace
      : body;

    const traceFile = await service.writeTraceDebug({
      status,
      trace,
    });

    return c.json({
      success: true,
      data: {
        traceFile,
      },
    });
  });

  return app;
}
