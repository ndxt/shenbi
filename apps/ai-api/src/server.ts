import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { loadEnv } from './adapters/env.ts';
import { logger } from './adapters/logger.ts';

const env = loadEnv();
const app = createApp();

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info('ai-api started', { port: info.port, url: `http://localhost:${info.port}` });
});
