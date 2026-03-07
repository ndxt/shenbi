/**
 * 模型列表 — 首版硬编码，预留从 ai-service 动态加载的装配点
 */
import type { ModelInfo } from '@shenbi/ai-contracts';

export const SUPPORTED_MODELS: ModelInfo[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    maxTokens: 128000,
    features: ['streaming', 'function-calling'],
    costPer1kTokens: { input: 0.005, output: 0.015 },
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    maxTokens: 128000,
    features: ['streaming', 'function-calling'],
    costPer1kTokens: { input: 0.00015, output: 0.0006 },
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    maxTokens: 200000,
    features: ['streaming', 'function-calling'],
    costPer1kTokens: { input: 0.003, output: 0.015 },
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    maxTokens: 200000,
    features: ['streaming', 'function-calling'],
    costPer1kTokens: { input: 0.00025, output: 0.00125 },
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    maxTokens: 1048576,
    features: ['streaming'],
    costPer1kTokens: { input: 0.0001, output: 0.0004 },
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    provider: 'deepseek',
    maxTokens: 65536,
    features: ['streaming'],
    costPer1kTokens: { input: 0.00027, output: 0.0011 },
  },
  {
    id: 'qwen-plus',
    name: 'Qwen Plus',
    provider: 'dashscope',
    maxTokens: 131072,
    features: ['streaming'],
    costPer1kTokens: { input: 0.0004, output: 0.0012 },
  },
];

/**
 * 装配点：二期替换为从 ai-service 动态获取
 */
export function getAvailableModels(): ModelInfo[] {
  return SUPPORTED_MODELS;
}
