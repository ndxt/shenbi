import { Hono } from 'hono';
import { validateChatRequest } from './validate.ts';
import { handleError } from '../middleware/error-handler.ts';
import { logRequest, logger } from '../adapters/logger.ts';
import { writeErrorDump } from '../adapters/debug-dump.ts';
import type { AgentRuntime } from '../runtime/types.ts';

const HEARTBEAT_INTERVAL_MS = 15_000;

export function createChatRoute(runtime: AgentRuntime): Hono {
  let activeConnections = 0;
  const app = new Hono();

  app.post('/', async (c) => {
    const requestId = (c.get('requestId' as never) as string | undefined) ?? 'unknown';
    const start = Date.now();

    try {
      const body = await c.req.json().catch(() => null);
      const req = validateChatRequest(body);

      if (req.stream) {
        activeConnections++;
        logger.info('ai.chat.sse.active_connections', { count: activeConnections, requestId });
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

            try {
              for await (const chunk of runtime.chatStream(req)) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
              }

              logRequest({
                requestId,
                durationMs: Date.now() - start,
                success: true,
                route: 'POST /api/ai/chat',
              });
            } catch (error) {
              const debugFile = writeErrorDump({
                category: 'stream-error',
                error,
                requestId,
                method: c.req.method,
                path: c.req.path,
                status: 500,
                code: 'CHAT_STREAM_ERROR',
                request: req,
              });
              const errEvent = {
                error: `${error instanceof Error ? error.message : 'Chat stream error'}. Debug file: ${debugFile}`,
              };
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(errEvent)}\n\n`));
              } catch {
                // stream may already be closed
              }
              logRequest({
                requestId,
                durationMs: Date.now() - start,
                success: false,
                route: 'POST /api/ai/chat',
              });
            } finally {
              clearInterval(heartbeat);
              activeConnections--;
              logger.info('ai.chat.sse.active_connections', { count: activeConnections, requestId });
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
      }

      const result = await runtime.chat(req);
      logRequest({
        requestId,
        ...(req.model ? { model: req.model } : {}),
        durationMs: Date.now() - start,
        success: true,
        route: 'POST /api/ai/chat',
      });
      return c.json({ success: true, data: result });
    } catch (error) {
      logRequest({
        requestId,
        durationMs: Date.now() - start,
        success: false,
        route: 'POST /api/ai/chat',
      });
      return handleError(error, c);
    }
  });

  return app;
}
