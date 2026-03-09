/**
 * 模型列表 — 首版硬编码，预留从 ai-service 动态加载的装配点
 */
import type { ModelInfo } from '@shenbi/ai-contracts';
import { loadEnv, type ProviderEnvConfig } from './env.ts';

export function buildProviderModelId(provider: string, model: string): string {
  return `${provider}::${model}`;
}

function getProviderModels(config: ProviderEnvConfig): string[] {
  if (config.models && config.models.length > 0) {
    return config.models;
  }

  if (config.provider === 'openai-compatible') {
    return ['GLM-4.6', 'GLM-4.7', 'GLM-5'];
  }

  return Array.from(new Set([
    config.plannerModel,
    config.blockModel,
  ].filter((value): value is string => Boolean(value))));
}

/**
 * 装配点：二期替换为从 ai-service 动态获取
 */
export function getAvailableModels(): ModelInfo[] {
  const env = loadEnv();
  const providerConfigs = env.providers.length > 0
    ? env.providers
    : (env.AI_PROVIDER ? [{
      provider: env.AI_PROVIDER,
      baseUrl: env.AI_OPENAI_COMPAT_BASE_URL,
      apiKey: env.AI_OPENAI_COMPAT_API_KEY,
      plannerModel: env.AI_PLANNER_MODEL,
      blockModel: env.AI_BLOCK_MODEL,
      models: env.AI_AVAILABLE_MODELS,
    }] : []);

  const models = providerConfigs.flatMap((config) => getProviderModels(config).map((model) => ({
    id: buildProviderModelId(config.provider, model),
    name: model,
    provider: config.provider,
    ...(config.provider === 'openai-compatible' ? { maxTokens: 128000 } : {}),
    features: ['streaming'],
  })));

  if (models.length > 0) {
    return models;
  }

  throw new Error(
    `No model list available for configured providers "${providerConfigs.map((item) => item.provider).join(', ') || env.AI_PROVIDER}". ` +
    'Set AI_PROVIDERS and per-provider *_MODELS in .env.local.',
  );
}
