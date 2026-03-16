/**
 * 基于 IP 的内存限流 — 默认 60 req/min
 * 二期替换为 Redis 限流，支持多实例部署
 */
import { createMiddleware } from 'hono/factory';
import { RateLimitError } from '../adapters/errors.ts';
import { logger } from '../adapters/logger.ts';

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 60;

interface WindowEntry {
  count: number;
  resetAt: number;
}

function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    'unknown'
  );
}

export function createRateLimitMiddleware(
  opts: {
    windowMs?: number;
    maxRequests?: number;
    /** 注入外部 store，方便测试隔离 */
    store?: Map<string, WindowEntry>;
  } = {},
) {
  const windowMs = opts.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const maxRequests = opts.maxRequests ?? RATE_LIMIT_MAX_REQUESTS;
  const store = opts.store ?? new Map<string, WindowEntry>();

  return createMiddleware(async (c, next) => {
    const ip = getClientIp(c);
    const now = Date.now();

    let entry = store.get(ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(ip, entry);
    }

    entry.count++;

    c.header('x-ratelimit-limit', String(maxRequests));
    c.header('x-ratelimit-remaining', String(Math.max(0, maxRequests - entry.count)));
    c.header('x-ratelimit-reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > maxRequests) {
      logger.warn('ai.rate_limit.rejected', { ip });
      throw new RateLimitError();
    }

    await next();
  });
}

export const rateLimitMiddleware = createRateLimitMiddleware();
