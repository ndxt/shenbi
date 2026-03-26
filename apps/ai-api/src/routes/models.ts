/**
 * GET /api/ai/models — 返回可用模型列表
 */
import { Hono } from 'hono';
import type { AiApiService } from '../runtime/types.ts';

export function createModelsRoute(service: AiApiService): Hono {
  const app = new Hono();

  app.get('/', async (c) => {
    const models = await service.listModels();
    return c.json({ success: true, data: models });
  });

  return app;
}
