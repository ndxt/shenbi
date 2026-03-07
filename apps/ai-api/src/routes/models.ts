/**
 * GET /api/ai/models — 返回可用模型列表
 */
import { Hono } from 'hono';
import { getAvailableModels } from '../adapters/providers.ts';

export function createModelsRoute(): Hono {
  const app = new Hono();

  app.get('/', (c) => {
    const models = getAvailableModels();
    return c.json({ success: true, data: models });
  });

  return app;
}
