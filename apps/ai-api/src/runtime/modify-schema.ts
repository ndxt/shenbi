import {
  buildSelectedNodeHint,
  formatConversationHistory,
  type ModifyResult,
  type ModifySchemaInput,
} from '@shenbi/ai-agents';
import { LLMError } from '../adapters/errors.ts';
import {
  writeInvalidJsonDump,
  type InvalidJsonSource,
} from '../adapters/debug-dump.ts';
import { loadEnv } from '../adapters/env.ts';
import { logger } from '../adapters/logger.ts';
import {
  OpenAICompatibleClient,
  type OpenAICompatibleMessage,
  type OpenAICompatibleRequestDebugSummary,
  type OpenAICompatibleThinking,
} from '../adapters/openai-compatible.ts';

const env = loadEnv();
const clientCache = new Map<string, OpenAICompatibleClient>();

export interface ModifySchemaTraceEntry {
  requestSummary?: OpenAICompatibleRequestDebugSummary & { provider: string };
  model: string;
  rawOutput: string;
  normalizedResult?: ModifyResult;
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
  });
  clientCache.set(config.provider, client);
  return client;
}

function requireModel(model: string | undefined): string {
  if (!model) {
    throw new LLMError('Missing block model configuration', 'MISSING_MODEL');
  }
  return model;
}

function getThinking(request: ModifySchemaInput['request']): OpenAICompatibleThinking | undefined {
  return request.thinking ? { type: request.thinking.type } : undefined;
}

function extractJsonCandidate(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? text).trim();
}

function summarizeModelOutput(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > 400 ? `${compact.slice(0, 400)}...` : compact;
}

function extractJson<T>(
  text: string,
  source: InvalidJsonSource,
  request: ModifySchemaInput['request'],
  model: string,
): T {
  try {
    return JSON.parse(extractJsonCandidate(text)) as T;
  } catch {
    const summarizedOutput = summarizeModelOutput(text);
    const debugFile = writeInvalidJsonDump({
      source,
      rawOutput: text,
      summarizedOutput,
      request,
      model,
    });
    logger.error('ai.model.invalid_json', {
      source,
      rawOutput: text,
      summarizedOutput,
      debugFile,
    });
    throw new LLMError(
      `Model returned invalid JSON (${source}). Debug file: ${debugFile}. Raw output: ${summarizedOutput}`,
      'MODEL_INVALID_JSON',
    );
  }
}

function isModifyResult(value: unknown): value is ModifyResult {
  if (!isRecord(value) || typeof value.explanation !== 'string' || !Array.isArray(value.operations)) {
    return false;
  }
  return value.operations.every((operation) => isRecord(operation) && typeof operation.op === 'string');
}

function createModifyMessages(input: ModifySchemaInput): OpenAICompatibleMessage[] {
  const conversationHistory = formatConversationHistory(input.context.conversation.history);
  const selectedNodeHint = buildSelectedNodeHint(input.request.selectedNodeId);
  const documentTree = input.context.document.tree ?? '[schema tree unavailable]';
  const lastOperations = input.context.conversation.lastOperations?.length
    ? JSON.stringify(input.context.conversation.lastOperations, null, 2)
    : '[]';

  return [
    {
      role: 'system',
      content: [
        'You are a low-code schema modification planner.',
        'Return JSON only.',
        'Return exactly this shape: {"explanation":"string","operations":[...]}',
        'Use the smallest valid set of operations.',
        'Supported operations:',
        '- schema.patchProps: {"op":"schema.patchProps","nodeId":"node-id","patch":{}}',
        '- schema.patchStyle: {"op":"schema.patchStyle","nodeId":"node-id","patch":{}}',
        '- schema.patchEvents: {"op":"schema.patchEvents","nodeId":"node-id","patch":{}}',
        '- schema.patchLogic: {"op":"schema.patchLogic","nodeId":"node-id","patch":{}}',
        '- schema.patchColumns: {"op":"schema.patchColumns","nodeId":"node-id","columns":[]}',
        '- schema.insertNode: {"op":"schema.insertNode","parentId":"node-id","index":0,"node":{...}}',
        '- schema.removeNode: {"op":"schema.removeNode","nodeId":"node-id"}',
        '- schema.replace: {"op":"schema.replace","schema":{...}}',
        'Rules:',
        '- nodeId and parentId must reference schema node ids from the provided schema tree.',
        '- Prefer patch operations over schema.replace when a local edit is enough.',
        '- Omit index for append-like inserts when order is not explicit.',
        '- explanation should be a short Chinese sentence summarizing what will change.',
        '- Do not invent components or node ids that are not grounded in the schema tree unless you are inserting a new node.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Prompt: ${input.request.prompt}`,
        `Schema Summary: ${input.context.document.summary}`,
        `Component Summary: ${input.context.componentSummary}`,
        ...(selectedNodeHint ? [selectedNodeHint] : []),
        'Schema Tree:',
        documentTree,
        'Conversation History:',
        conversationHistory,
        'Last Successful Operations:',
        lastOperations,
      ].join('\n'),
    },
  ];
}

export async function executeModifySchema(
  input: ModifySchemaInput,
  trace?: { modify?: ModifySchemaTraceEntry },
): Promise<ModifyResult> {
  if (!input.request.context.schemaJson) {
    throw new LLMError('modifySchema requires context.schemaJson', 'MISSING_SCHEMA_CONTEXT');
  }

  const requestedModel = input.request.blockModel ?? env.AI_BLOCK_MODEL;
  const modelRef = parseProviderModelRef(requestedModel);
  const client = createClient(modelRef.provider);
  const model = requireModel(modelRef.model ?? requestedModel);
  const messages = createModifyMessages(input);
  const thinking = getThinking(input.request);
  const requestSummary = {
    provider: modelRef.provider ?? env.AI_PROVIDER,
    ...client.buildRequestDebugSummary(model, messages, thinking, false),
  };
  const text = await client.chat(model, messages, thinking);
  const parsed = extractJson<unknown>(text, 'modify', input.request, model);
  if (!isModifyResult(parsed)) {
    throw new LLMError('modifySchema returned an invalid result shape', 'INVALID_MODIFY_RESULT');
  }

  if (trace) {
    trace.modify = {
      requestSummary,
      model,
      rawOutput: text,
      normalizedResult: parsed,
    };
  }

  return parsed;
}
