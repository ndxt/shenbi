import { Hono } from 'hono';
import { validateFinalizeRequest } from './validate.ts';
import { handleError } from '../middleware/error-handler.ts';
import { logRequest } from '../adapters/logger.ts';
import type { AgentRuntime } from '../runtime/types.ts';

export function createFinalizeRoute(runtime: AgentRuntime): Hono {
  const app = new Hono();

  app.post('/', async (c) => {
    const requestId = (c.get('requestId' as never) as string | undefined) ?? 'unknown';
    const start = Date.now();

    try {
      const body = await c.req.json().catch(() => null);
      const req = validateFinalizeRequest(body);
      const result = await runtime.finalize(req);

      logRequest({
        requestId,
        sessionId: req.sessionId,
        durationMs: Date.now() - start,
        success: true,
        route: 'POST /api/ai/run/finalize',
      });

      return c.json({ success: true, data: result });
    } catch (error) {
      logRequest({
        requestId,
        durationMs: Date.now() - start,
        success: false,
        route: 'POST /api/ai/run/finalize',
      });
      return handleError(error, c);
    }
  });

  return app;
}
