/**
 * 结构化错误类 — 对应 ai-api-host-plan.md 错误映射
 * ValidationError -> 400
 * RateLimitError  -> 429
 * LLMError        -> 503
 * unknown         -> 500
 */

export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends Error {
  readonly code = 'RATE_LIMIT_EXCEEDED';
  constructor(message = 'Too many requests, please try again later') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class LLMError extends Error {
  readonly code: string;
  constructor(message: string, code = 'LLM_ERROR') {
    super(message);
    this.name = 'LLMError';
    this.code = code;
  }
}

export function errorToStatus(error: unknown): number {
  if (error instanceof ValidationError) return 400;
  if (error instanceof RateLimitError) return 429;
  if (error instanceof LLMError) return 503;
  return 500;
}

export function errorToBody(error: unknown): { success: false; error: string; code?: string } {
  if (
    error instanceof ValidationError ||
    error instanceof RateLimitError ||
    error instanceof LLMError
  ) {
    return { success: false, error: error.message, code: error.code };
  }
  const message = error instanceof Error ? error.message : 'Internal server error';
  return { success: false, error: message };
}
