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
type JsonSalvageStrategy =
  | 'balanced_object'
  | 'trimmed_trailing_noise'
  | 'appended_missing_braces'
  | 'trimmed_extra_closing_braces';

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

function findBalancedJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) {
    return null;
  }

  const { chars } = normalizeMismatchedClosers(text.slice(start));
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{' || char === '[') {
      stack.push(char);
      continue;
    }
    if (char === '}') {
      if (stack.at(-1) !== '{') {
        return null;
      }
      stack.pop();
      if (stack.length === 0) {
        return chars.slice(0, index + 1).join('');
      }
      continue;
    }
    if (char === ']') {
      if (stack.at(-1) !== '[') {
        return null;
      }
      stack.pop();
    }
  }

  return null;
}

function normalizeMismatchedClosers(text: string): { text: string; chars: string[] } {
  const stack: string[] = [];
  const chars = text.split('');
  let inString = false;
  let escaped = false;

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{' || char === '[') {
      stack.push(char);
      continue;
    }
    if (char === '}') {
      if (stack.at(-1) === '[') {
        chars[index] = ']';
        stack.pop();
        continue;
      }
      if (stack.at(-1) === '{') {
        stack.pop();
      }
      continue;
    }
    if (char === ']') {
      if (stack.at(-1) === '{') {
        chars[index] = '}';
        stack.pop();
        continue;
      }
      if (stack.at(-1) === '[') {
        stack.pop();
      }
    }
  }

  return {
    text: chars.join(''),
    chars,
  };
}

function countOutsideStrings(text: string, target: string): number {
  let count = 0;
  let inString = false;
  let escaped = false;

  for (const char of text) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === target) {
      count += 1;
    }
  }

  return count;
}

function trySalvageJsonCandidate(text: string): { candidate: string; strategy: JsonSalvageStrategy } | null {
  const extracted = findBalancedJsonObject(text);
  if (extracted) {
    return {
      candidate: extracted,
      strategy: 'balanced_object',
    };
  }

  const trimmed = text.trim();
  for (let trimCount = 1; trimCount <= Math.min(24, trimmed.length); trimCount += 1) {
    const candidate = trimmed.slice(0, trimmed.length - trimCount).trimEnd();
    if (!candidate) {
      break;
    }
    try {
      JSON.parse(candidate);
      return {
        candidate,
        strategy: 'trimmed_trailing_noise',
      };
    } catch {
      // continue trimming
    }
  }

  const start = text.indexOf('{');
  if (start < 0) {
    return null;
  }

  const fullBase = normalizeMismatchedClosers(text.slice(start).trim()).text;
  const fullOpenCount = countOutsideStrings(fullBase, '{');
  const fullCloseCount = countOutsideStrings(fullBase, '}');
  if (fullOpenCount > fullCloseCount) {
    if (fullOpenCount - fullCloseCount > 8) {
      return null;
    }
    return {
      candidate: `${fullBase}${'}'.repeat(fullOpenCount - fullCloseCount)}`,
      strategy: 'appended_missing_braces',
    };
  }

  const end = text.lastIndexOf('}');
  const base = text.slice(start, end >= start ? end + 1 : text.length).trim();
  const openCount = countOutsideStrings(base, '{');
  const closeCount = countOutsideStrings(base, '}');
  if (openCount === closeCount) {
    return {
      candidate: base,
      strategy: 'balanced_object',
    };
  }
  if (openCount < closeCount) {
    let trimmedBase = base;
    while (trimmedBase.length > 0) {
      const next = trimmedBase.trimEnd().slice(0, -1);
      if (!next) {
        break;
      }
      const nextOpenCount = countOutsideStrings(next, '{');
      const nextCloseCount = countOutsideStrings(next, '}');
      trimmedBase = next;
      if (nextOpenCount === nextCloseCount) {
        return {
          candidate: trimmedBase.trim(),
          strategy: 'trimmed_extra_closing_braces',
        };
      }
      if (nextCloseCount < nextOpenCount) {
        break;
      }
    }
  }

  return null;
}

function stripArrowFunctions(text: string): { text: string; stripped: boolean } {
  const arrowPattern = /:\s*\([^)]*\)\s*=>/g;
  let match: RegExpExecArray | null;
  const chunks: string[] = [];
  let lastEnd = 0;
  arrowPattern.lastIndex = 0;
  while ((match = arrowPattern.exec(text)) !== null) {
    const colonIdx = match.index;
    let pos = match.index + match[0].length;
    let inBacktick = false;
    while (pos < text.length) {
      const ch = text[pos];
      if (inBacktick) {
        if (ch === '`') {
          inBacktick = false;
        }
        pos += 1;
        continue;
      }
      if (ch === '`') {
        inBacktick = true;
        pos += 1;
        continue;
      }
      if (ch === ',' || ch === '}' || ch === ']') {
        break;
      }
      pos += 1;
    }
    chunks.push(text.slice(lastEnd, colonIdx), ': null');
    lastEnd = pos;
  }
  if (chunks.length === 0) {
    return { text, stripped: false };
  }
  chunks.push(text.slice(lastEnd));
  return { text: chunks.join(''), stripped: true };
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
  let candidate = extractJsonCandidate(text);
  const arrowResult = stripArrowFunctions(candidate);
  if (arrowResult.stripped) {
    candidate = arrowResult.text;
    logger.warn('ai.model.invalid_json_salvaged', {
      source,
      model,
      strategy: 'stripped_arrow_functions',
    });
  }

  try {
    return JSON.parse(candidate.trim()) as T;
  } catch {
    const salvaged = trySalvageJsonCandidate(candidate);
    if (salvaged) {
      try {
        logger.warn('ai.model.invalid_json_salvaged', {
          source,
          model,
          strategy: salvaged.strategy,
        });
        return JSON.parse(salvaged.candidate) as T;
      } catch {
        // fall through to debug dump
      }
    }
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
  const conversationHistory = formatConversationHistory(input.context.conversation.history, {
    ...(input.context.document.schemaDigest ? { schemaDigest: input.context.document.schemaDigest } : {}),
  });
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
        '- schema.insertNode: {"op":"schema.insertNode","parentId":"node-id","index":0,"node":{"id":"unique-id","component":"ComponentName","props":{},"children":[]}}',
        '  IMPORTANT: node MUST have "component" field (NOT "type"). Text content goes in top-level "children" (NOT "props.children").',
        '- root append: {"op":"schema.insertNode","container":"body","node":{"id":"unique-id","component":"ComponentName","props":{},"children":[]}} or same with "container":"dialogs"',
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
