/**
 * 结构化日志适配器 — 首版用 console 输出，二期可接 pino/winston
 * 指标对应 ai-api-host-plan.md 监控章节
 */

export interface RequestLogEntry {
  requestId: string;
  sessionId?: string | undefined;
  model?: string | undefined;
  durationMs?: number | undefined;
  success: boolean;
  errorCode?: string | undefined;
  route: string;
}

export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

function formatLog(level: string, msg: string, meta?: Record<string, unknown>): string {
  return JSON.stringify({ level, msg, ts: new Date().toISOString(), ...meta });
}

export const logger: Logger = {
  info(msg, meta) {
    console.log(formatLog('info', msg, meta));
  },
  warn(msg, meta) {
    console.warn(formatLog('warn', msg, meta));
  },
  error(msg, meta) {
    console.error(formatLog('error', msg, meta));
  },
};

export function logRequest(entry: RequestLogEntry): void {
  const metric = entry.success ? 'ai.request.count[success]' : 'ai.request.count[fail]';
  logger.info(metric, {
    requestId: entry.requestId,
    ...(entry.sessionId !== undefined ? { sessionId: entry.sessionId } : {}),
    ...(entry.model !== undefined ? { model: entry.model } : {}),
    ...(entry.durationMs !== undefined ? { durationMs: entry.durationMs } : {}),
    route: entry.route,
    ...(entry.errorCode !== undefined ? { errorCode: entry.errorCode } : {}),
  });
}
