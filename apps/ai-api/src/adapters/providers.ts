/**
 * 模型列表 — 首版硬编码，预留从 ai-service 动态加载的装配点
 */
import type { ModelInfo } from '@shenbi/ai-contracts';
import { loadEnv } from './env.ts';

/**
 * 装配点：二期替换为从 ai-service 动态获取
 */
export function getAvailableModels(): ModelInfo[] {
  const env = loadEnv();
  if (env.AI_PROVIDER === 'openai-compatible') {
    return [
      {
        id: 'GLM-4.6',
        name: 'GLM-4.6',
        provider: 'openai-compatible',
        maxTokens: 128000,
        features: ['streaming'],
      },
      {
        id: 'GLM-4.7',
        name: 'GLM-4.7',
        provider: 'openai-compatible',
        maxTokens: 128000,
        features: ['streaming'],
      },
      {
        id: 'GLM-5',
        name: 'GLM-5',
        provider: 'openai-compatible',
        maxTokens: 128000,
        features: ['streaming'],
      },
    ];
  }

  throw new Error(
    `No model list available for provider "${env.AI_PROVIDER}". ` +
    'Set AI_PROVIDER=openai-compatible in .env.local.',
  );
}
