/**
 * POST /api/ai/classify-route — 轻量级路由分类
 *
 * 让大模型判断用户请求应该走单页面（legacy）还是多页面（Agent Loop）路径。
 * 请求体为 ClassifyRouteRequest，响应为 ClassifyRouteResponse。
 */
import { Hono } from 'hono';
import { handleError } from '../middleware/error-handler.ts';
import { logRequest, logger } from '../adapters/logger.ts';
import type { ClassifyRouteRequest, ClassifyRouteResponse } from '@shenbi/ai-contracts';
import type { AgentRuntime } from '../runtime/types.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateClassifyRouteRequest(body: unknown): ClassifyRouteRequest {
  if (!isRecord(body)) {
    throw new Error('Request body must be a JSON object');
  }
  const prompt = body['prompt'];
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('Missing required field: prompt');
  }
  const context = body['context'];
  if (!isRecord(context) || typeof context['schemaSummary'] !== 'string') {
    throw new Error('Missing required field: context.schemaSummary');
  }
  return body as unknown as ClassifyRouteRequest;
}

export function createClassifyRouteRoute(runtime: AgentRuntime): Hono {
  const app = new Hono();

  app.post('/', async (c) => {
    const requestId = (c.get('requestId' as never) as string | undefined) ?? 'unknown';
    const start = Date.now();

    let req: ClassifyRouteRequest;
    try {
      const body = await c.req.json().catch(() => null);
      req = validateClassifyRouteRequest(body);
    } catch (error) {
      return handleError(error, c);
    }

    try {
      const response: ClassifyRouteResponse = await runtime.classifyRoute(req);

      logRequest({
        requestId,
        durationMs: Date.now() - start,
        success: true,
        route: 'POST /api/ai/classify-route',
      });

      return c.json({ success: true, data: response });
    } catch (error) {
      logger.error('ai.classify-route.error', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      logRequest({
        requestId,
        durationMs: Date.now() - start,
        success: false,
        route: 'POST /api/ai/classify-route',
      });

      return handleError(error, c);
    }
  });

  return app;
}
