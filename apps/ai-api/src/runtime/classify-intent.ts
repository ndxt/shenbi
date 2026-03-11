import {
  formatConversationHistory,
  type ClassifyIntentInput,
  type IntentClassification,
} from '@shenbi/ai-agents';
import { LLMError } from '../adapters/errors.ts';
import { loadEnv } from '../adapters/env.ts';
import {
  OpenAICompatibleClient,
  type OpenAICompatibleMessage,
  type OpenAICompatibleRequestDebugSummary,
  type OpenAICompatibleThinking,
} from '../adapters/openai-compatible.ts';

const env = loadEnv();
const clientCache = new Map<string, OpenAICompatibleClient>();

export interface ClassifyIntentTraceEntry {
  requestSummary?: OpenAICompatibleRequestDebugSummary & { provider: string };
  model: string;
  rawOutput: string;
  normalizedResult?: IntentClassification;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseProviderModelRef(modelRef: string | undefined): { provider?: string; model?: string } {
  if (!modelRef) {
    return {};
  }
  const separatorIndex = modelRef.indexOf('::');
  if (separatorIndex === -1) {
    return env.AI_PROVIDER
      ? { provider: env.AI_PROVIDER, model: modelRef }
      : { model: modelRef };
  }
  const provider = modelRef.slice(0, separatorIndex);
  const model = modelRef.slice(separatorIndex + 2);
  return {
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
  };
}

function resolveProviderConfig(providerName: string | undefined): {
  provider: string;
  baseUrl?: string | undefined;
  apiKey?: string | undefined;
  thinkingModels?: string[] | undefined;
  nonThinkingModels?: string[] | undefined;
  enableThinkingModels?: string[] | undefined;
} {
  const provider = providerName ?? env.AI_PROVIDER;
  if (!provider) {
    throw new LLMError('AI_PROVIDER is not configured. Set AI_PROVIDER in .env.local.', 'MISSING_PROVIDER');
  }

  const matched = env.providers.find((item) => item.provider === provider);
  return {
    provider,
    baseUrl: matched?.baseUrl ?? (provider === env.AI_PROVIDER ? env.AI_OPENAI_COMPAT_BASE_URL : undefined),
    apiKey: matched?.apiKey ?? (provider === env.AI_PROVIDER ? env.AI_OPENAI_COMPAT_API_KEY : undefined),
    thinkingModels: matched?.thinkingModels,
    nonThinkingModels: matched?.nonThinkingModels,
    enableThinkingModels: matched?.enableThinkingModels,
  };
}

function createClient(providerName?: string): OpenAICompatibleClient {
  const config = resolveProviderConfig(providerName);
  const cached = clientCache.get(config.provider);
  if (cached) {
    return cached;
  }
  if (!config.baseUrl) {
    throw new LLMError(`Missing base URL for provider "${config.provider}"`, 'MISSING_PROVIDER_BASE_URL');
  }
  if (!config.apiKey) {
    throw new LLMError(`Missing API key for provider "${config.provider}"`, 'MISSING_PROVIDER_API_KEY');
  }
  const client = new OpenAICompatibleClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    ...(config.thinkingModels ? { thinkingModels: config.thinkingModels } : {}),
    ...(config.nonThinkingModels ? { nonThinkingModels: config.nonThinkingModels } : {}),
    ...(config.enableThinkingModels ? { enableThinkingModels: config.enableThinkingModels } : {}),
  });
  clientCache.set(config.provider, client);
  return client;
}

function requireModel(model: string | undefined): string {
  if (!model) {
    throw new LLMError('Missing planner model configuration', 'MISSING_MODEL');
  }
  return model;
}

function getThinking(request: ClassifyIntentInput['request']): OpenAICompatibleThinking | undefined {
  return request.thinking ? { type: request.thinking.type } : undefined;
}

function extractJsonCandidate(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? text).trim();
}

function normalizeClassification(value: unknown): IntentClassification {
  if (!isRecord(value)) {
    throw new LLMError('Intent classifier must return a JSON object', 'INVALID_INTENT_OUTPUT');
  }
  const intent = value['intent'];
  if (intent !== 'schema.create' && intent !== 'schema.modify' && intent !== 'chat') {
    throw new LLMError('Intent classifier returned an unsupported intent', 'INVALID_INTENT_OUTPUT');
  }
  const confidenceCandidate = typeof value['confidence'] === 'number'
    ? value['confidence']
    : Number(value['confidence']);
  const confidence = Number.isFinite(confidenceCandidate)
    ? Math.max(0, Math.min(1, confidenceCandidate))
    : 0.5;
  return { intent, confidence };
}

function createMessages(input: ClassifyIntentInput): OpenAICompatibleMessage[] {
  const conversationHistory = formatConversationHistory(input.context.conversation.history, {
    maxTurns: 4,
    maxCharsPerTurn: 240,
    ...(input.context.document.schemaDigest ? { schemaDigest: input.context.document.schemaDigest } : {}),
  });
  return [
    {
      role: 'system',
      content: [
        'You classify low-code assistant user intent.',
        'Choose exactly one intent from: schema.create, schema.modify, chat.',
        'Rules:',
        '- schema.create: the user wants to generate a new page or regenerate the current page from scratch.',
        '- schema.modify: the user wants to change an existing element — including any visual, style, layout, or structural change.',
        '  Examples of schema.modify: resize, fill space, center, align, change color, adjust spacing, rename, add a button, delete a row.',
        '- chat: the user is asking a pure question, requesting explanation or analysis, without any intent to change the page.',
        '- When a node is selected (Selected Node ≠ none), default to schema.modify UNLESS the prompt is clearly a question (ends with ? or contains 吗/呢/是什么/怎么).',
        '- If the prompt contains both create and modify signals, prefer schema.create only when the user explicitly asks for a new page.',
        '- Existing document context is a prerequisite for schema.modify; without one, prefer schema.create or chat.',
        'Return JSON only with this exact shape:',
        '{"intent":"schema.create|schema.modify|chat","confidence":0.0}',
      ].join('\n'),

    },
    {
      role: 'user',
      content: [
        `Prompt: ${input.request.prompt}`,
        `Document Exists: ${input.context.document.exists ? 'yes' : 'no'}`,
        `Schema Summary: ${input.context.document.summary}`,
        `Selected Node: ${input.context.selectedNodeId ?? 'none'}`,
        'Schema Tree:',
        input.context.document.tree ?? '[schema tree unavailable]',
        'Conversation History:',
        conversationHistory,
      ].join('\n'),
    },
  ];
}

export async function classifyIntentWithModel(
  input: ClassifyIntentInput,
  trace?: ClassifyIntentTraceEntry,
): Promise<IntentClassification> {
  const requestedModel = input.request.plannerModel ?? env.AI_PLANNER_MODEL ?? env.AI_BLOCK_MODEL;
  const modelRef = parseProviderModelRef(requestedModel);
  const client = createClient(modelRef.provider);
  const model = requireModel(modelRef.model ?? requestedModel);
  const messages = createMessages(input);
  const thinking = getThinking(input.request);
  const text = await client.chat(model, messages, thinking);
  const normalized = normalizeClassification(JSON.parse(extractJsonCandidate(text)));

  if (trace) {
    trace.requestSummary = {
      provider: modelRef.provider ?? env.AI_PROVIDER,
      ...client.buildRequestDebugSummary(model, messages, thinking, false),
    };
    trace.model = model;
    trace.rawOutput = text;
    trace.normalizedResult = normalized;
  }

  return normalized;
}
