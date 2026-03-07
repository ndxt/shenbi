/**
 * POST /api/ai/run/stream — SSE 流式请求
 *
 * 约定：
 * - 客户端用 fetch + POST 发送 RunRequest JSON
 * - 服务端返回 text/event-stream，每条 AgentEvent 序列化为 `data: <json>\n\n`
 * - 每 15 秒发送心跳 `:heartbeat\n\n` 保活
 * - API Host 不重写 AgentEvent 结构，不加宿主私有字段
 */
import { Hono } from 'hono';
import { validateRunRequest } from './validate.ts';
import { handleError } from '../middleware/error-handler.ts';
import { logRequest, logger } from '../adapters/logger.ts';
import type { AgentRuntime } from '../runtime/types.ts';
import type { RunRequest } from '../adapters/contracts.ts';

const HEARTBEAT_INTERVAL_MS = 15_000;

export function createRunStreamRoute(runtime: AgentRuntime): Hono {
  let activeConnections = 0;
  const app = new Hono();

  app.post('/', async (c) => {
    const requestId = (c.get('requestId' as never) as string | undefined) ?? 'unknown';
    const start = Date.now();

    let req: RunRequest;
    try {
      const body = await c.req.json().catch(() => null);
      req = validateRunRequest(body);
    } catch (error) {
      return handleError(error, c);
    }

    activeConnections++;
    logger.info('ai.sse.active_connections', { count: activeConnections, requestId });

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
          for await (const event of runtime.runStream(req)) {
            if (event.type === 'run:start') {
              sessionId = event.data.sessionId;
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          }

          logRequest({
            requestId,
            ...(sessionId !== undefined ? { sessionId } : {}),
            durationMs: Date.now() - start,
            success: true,
            route: 'POST /api/ai/run/stream',
          });
        } catch (error) {
          const errEvent = {
            type: 'error' as const,
            data: {
              message: error instanceof Error ? error.message : 'Stream error',
              code: 'STREAM_ERROR',
            },
          };
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errEvent)}\n\n`));
          } catch {
            // stream may already be closed
          }

          logRequest({
            requestId,
            ...(sessionId !== undefined ? { sessionId } : {}),
            durationMs: Date.now() - start,
            success: false,
            route: 'POST /api/ai/run/stream',
          });
        } finally {
          clearInterval(heartbeat);
          activeConnections--;
          logger.info('ai.sse.active_connections', { count: activeConnections, requestId });
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

  return app;
}
