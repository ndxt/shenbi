/**
 * POST /api/ai/run — 非流式请求，返回完整 RunResponse
 */
import { Hono } from 'hono';
import { validateRunRequest } from './validate.ts';
import { handleError } from '../middleware/error-handler.ts';
import { logRequest } from '../adapters/logger.ts';
import type { AgentRuntime } from '../runtime/types.ts';

export function createRunRoute(runtime: AgentRuntime): Hono {
  const app = new Hono();

  app.post('/', async (c) => {
    const requestId = (c.get('requestId' as never) as string | undefined) ?? 'unknown';
    const start = Date.now();

    try {
      const body = await c.req.json().catch(() => null);
      const req = validateRunRequest(body);

      const result = await runtime.run(req);

      logRequest({
        requestId,
        sessionId: result.metadata.sessionId,
        ...(result.metadata.plannerModel !== undefined ? { model: result.metadata.plannerModel } : {}),
        durationMs: Date.now() - start,
        success: true,
        route: 'POST /api/ai/run',
      });

      return c.json({ success: true, data: result });
    } catch (error) {
      logRequest({
        requestId,
        durationMs: Date.now() - start,
        success: false,
        route: 'POST /api/ai/run',
      });
      return handleError(error, c);
    }
  });

  return app;
}
