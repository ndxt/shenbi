import fs from 'node:fs';
import path from 'node:path';

export interface Env {
  PORT: number;
  AI_RUNTIME: 'legacy' | 'mastra';
  AI_PROVIDER: string;
  AI_OPENAI_COMPAT_BASE_URL?: string | undefined;
  AI_OPENAI_COMPAT_API_KEY?: string | undefined;
  AI_PLANNER_MODEL?: string | undefined;
  AI_BLOCK_MODEL?: string | undefined;
  AI_AVAILABLE_MODELS?: string[] | undefined;
  AI_RATE_LIMIT_WINDOW_MS: number;
  AI_RATE_LIMIT_MAX_REQUESTS: number;
  providers: ProviderEnvConfig[];

  // GitLab OAuth
  GITLAB_OAUTH_CLIENT_ID: string;
  GITLAB_OAUTH_CLIENT_SECRET: string;
  GITLAB_OAUTH_REDIRECT_URI: string;
  GITLAB_DEFAULT_URL: string;
  GITLAB_DEFAULT_GROUP_ID: number | undefined;
}

export interface ProviderEnvConfig {
  provider: string;
  baseUrl?: string | undefined;
  apiKey?: string | undefined;
  plannerModel?: string | undefined;
  blockModel?: string | undefined;
  models?: string[] | undefined;
  temperature?: number | undefined;
  thinkingModels?: string[] | undefined;
  nonThinkingModels?: string[] | undefined;
  /** Models using Qwen-style `enable_thinking: boolean` format (e.g. `qwen*`). */
  enableThinkingModels?: string[] | undefined;
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

function toProviderEnvPrefix(provider: string): string | undefined {
  const normalized = provider.trim().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!normalized || normalized === 'openai_compatible') {
    return undefined;
  }
  return normalized.toUpperCase();
}

function parseModelList(raw: string | undefined): string[] | undefined {
  if (!raw) {
    return undefined;
  }
  const models = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return models.length > 0 ? Array.from(new Set(models)) : undefined;
}

function parseProviderList(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return Array.from(new Set(
    raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  ));
}

function parseTemperature(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function mergeModelLists(...lists: Array<string[] | undefined>): string[] | undefined {
  const merged = lists.flatMap((list) => list ?? []).map((item) => item.trim()).filter(Boolean);
  return merged.length > 0 ? Array.from(new Set(merged)) : undefined;
}

function resolveWorkspaceRoot(startDir: string): string {
  let currentDir = startDir;
  while (true) {
    if (
      fs.existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))
      || fs.existsSync(path.join(currentDir, '.env.local'))
      || fs.existsSync(path.join(currentDir, '.env'))
    ) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return startDir;
    }
    currentDir = parentDir;
  }
}

function resolveRuntimeBaseDir(): string {
  if (typeof __dirname === 'string' && __dirname.trim()) {
    return __dirname;
  }

  const entryScript = process.argv[1];
  if (typeof entryScript === 'string' && entryScript.trim()) {
    return path.dirname(path.resolve(entryScript));
  }

  return process.cwd();
}

function resolveProviderConfig(
  loaded: Record<string, string>,
  provider: string,
  isActiveProvider: boolean,
): ProviderEnvConfig {
  const providerPrefix = toProviderEnvPrefix(provider);
  const providerKeys = (suffix: string): string[] => (
    providerPrefix ? [`${providerPrefix}_${suffix}`] : []
  );
  const useSharedCompatKeys = isActiveProvider || provider === 'openai-compatible';

  const providerThinkingModels = parseModelList(readEnvValue(loaded, [
    ...providerKeys('THINKING_MODELS'),
    ...(useSharedCompatKeys ? ['AI_THINKING_MODELS'] : []),
  ]));
  const providerNonThinkingModels = parseModelList(readEnvValue(loaded, provider === 'openai-compatible'
    ? [
      ...providerKeys('NON_THINKING_MODELS'),
      'AI_NON_THINKING_MODELS',
    ]
    : [
      ...providerKeys('NON_THINKING_MODELS'),
    ]));
  const globalNonThinkingModels = provider === 'openai-compatible'
    ? undefined
    : parseModelList(readEnvValue(loaded, ['AI_NON_THINKING_MODELS']));

  const providerEnableThinkingModels = parseModelList(readEnvValue(loaded, [
    ...providerKeys('ENABLE_THINKING_MODELS'),
    ...(useSharedCompatKeys ? ['AI_ENABLE_THINKING_MODELS'] : []),
  ]));
  const globalEnableThinkingModels = provider === 'openai-compatible'
    ? undefined
    : parseModelList(readEnvValue(loaded, ['AI_ENABLE_THINKING_MODELS']));

  return {
    provider,
    baseUrl: readEnvValue(loaded, [
      ...providerKeys('BASE_URL'),
      ...(useSharedCompatKeys ? [
        'AI_OPENAI_COMPAT_BASE_URL',
        'OPENAI_BASE_URL',
        'VITE_OPENAI_BASE_URL',
      ] : []),
    ]),
    apiKey: readEnvValue(loaded, [
      ...providerKeys('API_KEY'),
      ...(useSharedCompatKeys ? [
        'AI_OPENAI_COMPAT_API_KEY',
        'OPENAI_API_KEY',
        'VITE_OPENAI_API_KEY',
      ] : []),
    ]),
    plannerModel: readEnvValue(loaded, [
      ...providerKeys('PLANNER_MODEL'),
      ...(useSharedCompatKeys ? [
        'AI_PLANNER_MODEL',
        'OPENAI_PLANNER_MODEL',
        'VITE_OPENAI_PLANNER_MODEL',
      ] : []),
    ]),
    blockModel: readEnvValue(loaded, [
      ...providerKeys('BLOCK_MODEL'),
      ...(useSharedCompatKeys ? [
        'AI_BLOCK_MODEL',
        'OPENAI_BLOCK_MODEL',
        'VITE_OPENAI_BLOCK_MODEL',
      ] : []),
    ]),
    models: parseModelList(readEnvValue(loaded, [
      ...providerKeys('MODELS'),
      ...(useSharedCompatKeys ? ['AI_AVAILABLE_MODELS'] : []),
    ])),
    temperature: parseTemperature(readEnvValue(loaded, [
      ...providerKeys('TEMPERATURE'),
      ...(useSharedCompatKeys ? ['AI_TEMPERATURE'] : []),
    ])),
    thinkingModels: providerThinkingModels,
    nonThinkingModels: mergeModelLists(providerNonThinkingModels, globalNonThinkingModels),
    enableThinkingModels: mergeModelLists(providerEnableThinkingModels, globalEnableThinkingModels),
  };
}

function loadLocalEnvFiles(): Record<string, string> {
  const currentDir = resolveRuntimeBaseDir();
  const cwdRoot = resolveWorkspaceRoot(process.cwd());
  const fallbackRoot = resolveWorkspaceRoot(path.resolve(currentDir, '../../../../'));
  const rootDir = fs.existsSync(path.join(cwdRoot, '.env.local')) || fs.existsSync(path.join(cwdRoot, '.env'))
    ? cwdRoot
    : fallbackRoot;
  return {
    ...parseEnvFile(path.join(rootDir, '.env')),
    ...parseEnvFile(path.join(rootDir, '.env.local')),
  };
}

export function loadEnv(): Env {
  const loaded = loadLocalEnvFiles();
  const provider = readEnvValue(loaded, ['AI_PROVIDER']) ?? '';
  const configuredProviders = parseProviderList(readEnvValue(loaded, ['AI_PROVIDERS']));
  const providers = Array.from(new Set([
    ...(provider ? [provider] : []),
    ...configuredProviders,
  ])).map((providerName) => resolveProviderConfig(loaded, providerName, providerName === provider));
  const activeProviderConfig = provider
    ? providers.find((item) => item.provider === provider) ?? resolveProviderConfig(loaded, provider, true)
    : undefined;

  const gitlabGroupIdRaw = readEnvValue(loaded, ['GITLAB_DEFAULT_GROUP_ID']);

  return {
    PORT: parseInt(readEnvValue(loaded, ['PORT']) ?? '3100', 10),
    AI_RUNTIME: readEnvValue(loaded, ['AI_RUNTIME']) === 'mastra' ? 'mastra' : 'legacy',
    AI_PROVIDER: provider,
    AI_OPENAI_COMPAT_BASE_URL: activeProviderConfig?.baseUrl,
    AI_OPENAI_COMPAT_API_KEY: activeProviderConfig?.apiKey,
    AI_PLANNER_MODEL: activeProviderConfig?.plannerModel,
    AI_BLOCK_MODEL: activeProviderConfig?.blockModel,
    AI_AVAILABLE_MODELS: activeProviderConfig?.models,
    AI_RATE_LIMIT_WINDOW_MS: parseInt(readEnvValue(loaded, ['AI_RATE_LIMIT_WINDOW_MS']) ?? '60000', 10),
    AI_RATE_LIMIT_MAX_REQUESTS: parseInt(readEnvValue(loaded, ['AI_RATE_LIMIT_MAX_REQUESTS']) ?? '60', 10),
    providers,

    // GitLab OAuth
    GITLAB_OAUTH_CLIENT_ID: readEnvValue(loaded, ['GITLAB_OAUTH_CLIENT_ID']) ?? '',
    GITLAB_OAUTH_CLIENT_SECRET: readEnvValue(loaded, ['GITLAB_OAUTH_CLIENT_SECRET']) ?? '',
    GITLAB_OAUTH_REDIRECT_URI: readEnvValue(loaded, ['GITLAB_OAUTH_REDIRECT_URI']) ?? 'http://localhost:5173/api/gitlab/oauth/callback',
    GITLAB_DEFAULT_URL: readEnvValue(loaded, ['GITLAB_DEFAULT_URL']) ?? 'https://gitlab.com',
    GITLAB_DEFAULT_GROUP_ID: gitlabGroupIdRaw ? parseInt(gitlabGroupIdRaw, 10) : undefined,
  };
}
