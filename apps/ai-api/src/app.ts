/**
 * Hono App 装配 — 挂载路由、中间件
 *
 * 默认装配：
 * - 当前通过 @shenbi/ai-agents + provider runtime 生成真实 AgentEvent 流
 * - 后续只需要替换 runtime 装配中的 llm/tools/memory，不需要改路由层
 */
import { Hono } from 'hono';
import { requestIdMiddleware } from './middleware/request-id.ts';
import { createRateLimitMiddleware } from './middleware/rate-limit.ts';
import { handleError } from './middleware/error-handler.ts';
import { createRunRoute } from './routes/run.ts';
import { createRunStreamRoute } from './routes/run-stream.ts';
import { createFinalizeRoute } from './routes/finalize.ts';
import { createChatRoute } from './routes/chat.ts';
import { createModelsRoute } from './routes/models.ts';
import { agentRuntime } from './runtime/agent-runtime.ts';
import type { AgentRuntime } from './runtime/types.ts';

export interface AppOptions {
  /** 测试时可注入自定义 runtime */
  runtime?: AgentRuntime;
  /** 注入独立限流 store，用于测试隔离 */
  rateLimitStore?: Map<string, { count: number; resetAt: number }>;
}

export function createApp(options: AppOptions = {}): Hono {
  const runtime = options.runtime ?? agentRuntime;

  const app = new Hono();

  app.use('*', requestIdMiddleware);
  app.use(
    '/api/ai/*',
    createRateLimitMiddleware(
      options.rateLimitStore !== undefined ? { store: options.rateLimitStore } : {},
    ),
  );

  app.route('/api/ai/run/stream', createRunStreamRoute(runtime));
  app.route('/api/ai/run', createRunRoute(runtime));
  app.route('/api/ai/run/finalize', createFinalizeRoute(runtime));
  app.route('/api/ai/chat', createChatRoute(runtime));
  app.route('/api/ai/models', createModelsRoute());

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.onError((err, c) => handleError(err, c));

  return app;
}
