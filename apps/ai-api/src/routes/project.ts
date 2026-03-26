import { Hono } from 'hono';
import { writeErrorDump } from '../adapters/debug-dump.ts';
import { handleError } from '../middleware/error-handler.ts';
import { logRequest, logger } from '../adapters/logger.ts';
import type { AiApiService } from '../runtime/types.ts';
import type { ProjectAgentEvent, ProjectRunRequest } from '@shenbi/ai-contracts';
import {
  validateProjectCancelRequest,
  validateProjectConfirmRequest,
  validateProjectReviseRequest,
  validateProjectRunRequest,
} from './validate.ts';

const HEARTBEAT_INTERVAL_MS = 15_000;

export function createProjectRoute(service: AiApiService): Hono {
  let activeConnections = 0;
  const app = new Hono();

  app.post('/stream', async (c) => {
    const requestId = (c.get('requestId' as never) as string | undefined) ?? 'unknown';
    const start = Date.now();

    let req: ProjectRunRequest;
    try {
      const body = await c.req.json().catch(() => null);
      req = validateProjectRunRequest(body);
    } catch (error) {
      return handleError(error, c);
    }

    activeConnections += 1;
    logger.info('ai.project.sse.active_connections', { count: activeConnections, requestId });
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(':heartbeat\n\n'));
          } catch {
            clearInterval(heartbeat);
          }
        }, HEARTBEAT_INTERVAL_MS);

        let sessionId: string | undefined;
        try {
          for await (const event of service.projectStream(req)) {
            if ('sessionId' in event.data && typeof event.data.sessionId === 'string') {
              sessionId = event.data.sessionId;
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          }

          logRequest({
            requestId,
            ...(sessionId ? { sessionId } : {}),
            durationMs: Date.now() - start,
            success: true,
            route: 'POST /api/ai/project/stream',
          });
        } catch (error) {
          const debugFile = writeErrorDump({
            category: 'stream-error',
            error,
            requestId,
            method: c.req.method,
            path: c.req.path,
            status: 500,
            code: 'PROJECT_STREAM_ERROR',
            request: req,
          });
          const errEvent: ProjectAgentEvent = {
            type: 'project:error',
            data: {
              sessionId: sessionId ?? 'unknown',
              message: `${error instanceof Error ? error.message : 'Project stream error'}. Debug file: ${debugFile}`,
            },
          };
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errEvent)}\n\n`));
          } catch {
            // Ignore enqueue failure on closed streams.
          }
          logRequest({
            requestId,
            ...(sessionId ? { sessionId } : {}),
            durationMs: Date.now() - start,
            success: false,
            route: 'POST /api/ai/project/stream',
          });
        } finally {
          clearInterval(heartbeat);
          activeConnections -= 1;
          logger.info('ai.project.sse.active_connections', { count: activeConnections, requestId });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'x-request-id': requestId,
      },
    });
  });

  app.post('/confirm', async (c) => {
    try {
      const body = await c.req.json().catch(() => null);
      const req = validateProjectConfirmRequest(body);
      const result = await service.confirmProject(req);
      return c.json({ success: true, data: result });
    } catch (error) {
      return handleError(error, c);
    }
  });

  app.post('/revise', async (c) => {
    try {
      const body = await c.req.json().catch(() => null);
      const req = validateProjectReviseRequest(body);
      const result = await service.reviseProject(req);
      return c.json({ success: true, data: result });
    } catch (error) {
      return handleError(error, c);
    }
  });

  app.post('/cancel', async (c) => {
    try {
      const body = await c.req.json().catch(() => null);
      const req = validateProjectCancelRequest(body);
      const result = await service.cancelProject(req);
      return c.json({ success: true, data: result });
    } catch (error) {
      return handleError(error, c);
    }
  });

  return app;
}
