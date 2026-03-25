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
import { createDebugRoute } from './routes/debug.ts';
import { createModelsRoute } from './routes/models.ts';
import { createClassifyRouteRoute } from './routes/classify-route.ts';
import { createGitLabRoute } from './routes/gitlab.ts';
import { loadEnv } from './adapters/env.ts';
import { configuredRuntime } from './runtime/runtime-switch.ts';
import type { AgentRuntime } from './runtime/types.ts';

export interface AppOptions {
  /** 测试时可注入自定义 runtime */
  runtime?: AgentRuntime;
  /** 注入独立限流 store，用于测试隔离 */
  rateLimitStore?: Map<string, { count: number; resetAt: number }>;
  rateLimitWindowMs?: number;
  rateLimitMaxRequests?: number;
}

export function createApp(options: AppOptions = {}): Hono {
  const runtime = options.runtime ?? configuredRuntime;
  const env = loadEnv();

  const app = new Hono();

  app.use('*', requestIdMiddleware);
  const rateLimitOptions = {
    ...(options.rateLimitStore !== undefined ? { store: options.rateLimitStore } : {}),
    windowMs: options.rateLimitWindowMs ?? env.AI_RATE_LIMIT_WINDOW_MS,
    maxRequests: options.rateLimitMaxRequests ?? env.AI_RATE_LIMIT_MAX_REQUESTS,
  };
  const rateLimitMiddleware = createRateLimitMiddleware(rateLimitOptions);
  app.use('/api/ai/run', rateLimitMiddleware);
  app.use('/api/ai/run/stream', rateLimitMiddleware);
  app.use('/api/ai/run/finalize', rateLimitMiddleware);
  app.use('/api/ai/chat', rateLimitMiddleware);
  app.use('/api/ai/classify-route', rateLimitMiddleware);

  app.route('/api/ai/run/stream', createRunStreamRoute(runtime));
  app.route('/api/ai/run', createRunRoute(runtime));
  app.route('/api/ai/run/finalize', createFinalizeRoute(runtime));
  app.route('/api/ai/chat', createChatRoute(runtime));
  app.route('/api/ai/classify-route', createClassifyRouteRoute());
  app.route('/api/ai/debug', createDebugRoute());
  app.route('/api/ai/models', createModelsRoute());

  // GitLab integration
  if (env.GITLAB_OAUTH_CLIENT_ID) {
    app.route('/api/gitlab', createGitLabRoute({
      clientId: env.GITLAB_OAUTH_CLIENT_ID,
      clientSecret: env.GITLAB_OAUTH_CLIENT_SECRET,
      redirectUri: env.GITLAB_OAUTH_REDIRECT_URI,
      defaultInstanceUrl: env.GITLAB_DEFAULT_URL,
      defaultGroupId: env.GITLAB_DEFAULT_GROUP_ID,
    }));
  }

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.onError((err, c) => handleError(err, c));

  return app;
}
