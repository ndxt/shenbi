import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from './env.ts';

describe('loadEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps shared openai-compatible config available in multi-provider mode', () => {
    vi.stubEnv('AI_PROVIDER', 'nextai');
    vi.stubEnv('AI_PROVIDERS', 'openai-compatible,nextai');
    vi.stubEnv('AI_OPENAI_COMPAT_BASE_URL', 'https://open.bigmodel.cn/api/coding/paas/v4');
    vi.stubEnv('AI_OPENAI_COMPAT_API_KEY', 'glm-key');
    vi.stubEnv('AI_PLANNER_MODEL', 'GLM-4.7');
    vi.stubEnv('AI_BLOCK_MODEL', 'GLM-4.6');
    vi.stubEnv('AI_AVAILABLE_MODELS', 'GLM-4.6,GLM-4.7');
    vi.stubEnv('AI_THINKING_MODELS', 'GLM-4.6,GLM-4.7');
    vi.stubEnv('NEXTAI_BASE_URL', 'https://api.nextaicore.com/v1');
    vi.stubEnv('NEXTAI_API_KEY', 'nextai-key');
    vi.stubEnv('NEXTAI_PLANNER_MODEL', 'gpt-4o-mini');
    vi.stubEnv('NEXTAI_BLOCK_MODEL', 'gpt-4o-mini');
    vi.stubEnv('NEXTAI_MODELS', 'gpt-4o-mini');

    const env = loadEnv();
    const glmProvider = env.providers.find((item) => item.provider === 'openai-compatible');

    expect(glmProvider).toMatchObject({
      provider: 'openai-compatible',
      baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
      apiKey: 'glm-key',
      plannerModel: 'GLM-4.7',
      blockModel: 'GLM-4.6',
      models: ['GLM-4.6', 'GLM-4.7'],
      thinkingModels: ['GLM-4.6', 'GLM-4.7'],
      nonThinkingModels: undefined,
    });
  });
});
