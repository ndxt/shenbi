/**
 * 环境变量读取 — 首版只读 LLM API Key，二期才引入 REDIS_URL / DATABASE_URL
 */

export interface Env {
  PORT: number;
  OPENAI_API_KEY?: string | undefined;
  ANTHROPIC_API_KEY?: string | undefined;
  GOOGLE_API_KEY?: string | undefined;
  DEEPSEEK_API_KEY?: string | undefined;
  DASHSCOPE_API_KEY?: string | undefined;
}

export function loadEnv(): Env {
  return {
    PORT: parseInt(process.env['PORT'] ?? '3100', 10),
    OPENAI_API_KEY: process.env['OPENAI_API_KEY'],
    ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'],
    GOOGLE_API_KEY: process.env['GOOGLE_API_KEY'],
    DEEPSEEK_API_KEY: process.env['DEEPSEEK_API_KEY'],
    DASHSCOPE_API_KEY: process.env['DASHSCOPE_API_KEY'],
  };
}
