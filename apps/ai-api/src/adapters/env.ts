import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Env {
  PORT: number;
  AI_PROVIDER: string;
  AI_OPENAI_COMPAT_BASE_URL?: string | undefined;
  AI_OPENAI_COMPAT_API_KEY?: string | undefined;
  AI_PLANNER_MODEL?: string | undefined;
  AI_BLOCK_MODEL?: string | undefined;
  OPENAI_API_KEY?: string | undefined;
  ANTHROPIC_API_KEY?: string | undefined;
  GOOGLE_API_KEY?: string | undefined;
  DEEPSEEK_API_KEY?: string | undefined;
  DASHSCOPE_API_KEY?: string | undefined;
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const entries: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith('\'') && value.endsWith('\''))
    ) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }
  return entries;
}

function readEnvValue(loaded: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const processValue = process.env[key];
    if (processValue !== undefined && processValue !== '') {
      return processValue;
    }
    const loadedValue = loaded[key];
    if (loadedValue !== undefined && loadedValue !== '') {
      return loadedValue;
    }
  }
  return undefined;
}

function loadLocalEnvFiles(): Record<string, string> {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(currentDir, '../../../../');
  return {
    ...parseEnvFile(path.join(rootDir, '.env')),
    ...parseEnvFile(path.join(rootDir, '.env.local')),
  };
}

export function loadEnv(): Env {
  const loaded = loadLocalEnvFiles();

  return {
    PORT: parseInt(readEnvValue(loaded, ['PORT']) ?? '3100', 10),
    AI_PROVIDER: readEnvValue(loaded, ['AI_PROVIDER']) ?? 'fake',
    AI_OPENAI_COMPAT_BASE_URL: readEnvValue(loaded, [
      'AI_OPENAI_COMPAT_BASE_URL',
      'OPENAI_BASE_URL',
      'VITE_OPENAI_BASE_URL',
    ]),
    AI_OPENAI_COMPAT_API_KEY: readEnvValue(loaded, [
      'AI_OPENAI_COMPAT_API_KEY',
      'OPENAI_API_KEY',
      'VITE_OPENAI_API_KEY',
    ]),
    AI_PLANNER_MODEL: readEnvValue(loaded, [
      'AI_PLANNER_MODEL',
      'OPENAI_PLANNER_MODEL',
      'VITE_OPENAI_PLANNER_MODEL',
    ]),
    AI_BLOCK_MODEL: readEnvValue(loaded, [
      'AI_BLOCK_MODEL',
      'OPENAI_BLOCK_MODEL',
      'VITE_OPENAI_BLOCK_MODEL',
    ]),
    OPENAI_API_KEY: readEnvValue(loaded, ['OPENAI_API_KEY']),
    ANTHROPIC_API_KEY: readEnvValue(loaded, ['ANTHROPIC_API_KEY']),
    GOOGLE_API_KEY: readEnvValue(loaded, ['GOOGLE_API_KEY']),
    DEEPSEEK_API_KEY: readEnvValue(loaded, ['DEEPSEEK_API_KEY']),
    DASHSCOPE_API_KEY: readEnvValue(loaded, ['DASHSCOPE_API_KEY']),
  };
}
