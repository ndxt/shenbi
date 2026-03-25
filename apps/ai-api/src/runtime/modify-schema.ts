import {
  buildModifyPlanPromptSpec,
  buildInsertNodePromptSpec,
  buildFocusedNodeContext,
  createModifyResult,
  formatConversationHistory,
  getComponentSchemaContracts,
  mergePlannedOperations,
  needsPhase2,
  splitPlannedOperations,
  summarizeOperations,
  type ComplexOpResult,
  type ModifyResult,
  type ModifySchemaInput,
  type PlanInsertNodeSkeleton,
  type PlanModifyResult,
  type PlanResult,
  type PlanOperation,
  isPlanResult,
} from '@shenbi/ai-agents';
import type { AgentOperation } from '@shenbi/ai-contracts';
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
import { buildUserMessageContentFromLines } from './request-attachments.ts';

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
  /** Phase 2 per-insertNode execution traces (only present when two-phase is used) */
  executeTraces?: Array<{
    operationIndex: number;
    requestSummary?: OpenAICompatibleRequestDebugSummary & { provider: string };
    rawOutput: string;
    generatedNode?: unknown;
    durationMs?: number;
    inputTokens?: number;
    outputTokens?: number;
    tokensUsed?: number;
  }>;
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

// ---------------------------------------------------------------------------
//  Phase 1: Plan prompt
// ---------------------------------------------------------------------------

function formatLastSuccessfulOperations(operations: AgentOperation[] | undefined): {
  summary: string;
  rawJson: string;
} {
  if (!operations || operations.length === 0) {
    return {
      summary: '[none]',
      rawJson: '[]',
    };
  }
  return {
    summary: summarizeOperations(operations),
    rawJson: JSON.stringify(operations, null, 2),
  };
}

function createPlanMessages(input: ModifySchemaInput): OpenAICompatibleMessage[] {
  const conversationHistory = formatConversationHistory(input.context.conversation.history, {
    ...(input.context.document.schemaDigest ? { schemaDigest: input.context.document.schemaDigest } : {}),
  });
  const focusedNodeContext = buildFocusedNodeContext(
    input.request.context.schemaJson ?? input.context.document.schema,
    input.request.selectedNodeId,
  );
  const documentTree = input.context.document.tree ?? '[schema tree unavailable]';
  const lastOperations = formatLastSuccessfulOperations(input.context.conversation.lastOperations);
  const promptSpec = buildModifyPlanPromptSpec({
    prompt: input.request.prompt,
    schemaSummary: input.context.document.summary,
    ...(focusedNodeContext ? { focusedNodeContext } : {}),
    documentTree,
    conversationHistory,
    lastSuccessfulOperationsSummary: lastOperations.summary,
    lastSuccessfulOperationsRawJson: lastOperations.rawJson,
  });

  return [
    {
      role: 'system',
      content: promptSpec.systemText,
    },
    {
      role: 'user',
      content: buildUserMessageContentFromLines(promptSpec.userLines, input.request.attachments),
    },
  ];
}

// ---------------------------------------------------------------------------
//  Phase 2: InsertNode generation prompt (with component contracts)
// ---------------------------------------------------------------------------

function createInsertNodeMessages(
  skeleton: PlanInsertNodeSkeleton,
  input: ModifySchemaInput,
): OpenAICompatibleMessage[] {
  const promptSpec = buildInsertNodePromptSpec({
    skeleton,
    documentTree: input.context.document.tree ?? '',
    componentContracts: getComponentSchemaContracts(skeleton.components ?? []),
  });

  return [
    {
      role: 'system',
      content: promptSpec.systemText,
    },
    {
      role: 'user',
      content: buildUserMessageContentFromLines(promptSpec.userLines, input.request.attachments),
    },
  ];
}

// ---------------------------------------------------------------------------
//  executeModifySchema: two-phase orchestration
// ---------------------------------------------------------------------------

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
  const thinking = getThinking(input.request);
  const provider = modelRef.provider ?? env.AI_PROVIDER;

  // ========================
  // Phase 1: Plan
  // ========================
  const planMessages = createPlanMessages(input);
  const planRequestSummary = {
    provider,
    ...client.buildRequestDebugSummary(model, planMessages, thinking, false),
  };
  const { content: planText, durationMs: planDurationMs, inputTokens: planInputTokens, outputTokens: planOutputTokens, tokensUsed: planTokensUsed } = await client.chat(model, planMessages, thinking);
  const planParsed = extractJson<unknown>(planText, 'modify', input.request, model);
  if (!isPlanResult(planParsed)) {
    const debugFile = writeInvalidJsonDump({
      source: 'modify',
      rawOutput: planText,
      summarizedOutput: planText.slice(0, 400),
      request: input.request,
      model,
    });
    throw new LLMError(`modifySchema planner returned an invalid result shape. Debug file: ${debugFile}`, 'INVALID_MODIFY_RESULT');
  }

  const planned = splitPlannedOperations(planParsed, {
    ...(planDurationMs !== undefined ? { durationMs: planDurationMs } : {}),
    ...(planInputTokens !== undefined ? { inputTokens: planInputTokens } : {}),
    ...(planOutputTokens !== undefined ? { outputTokens: planOutputTokens } : {}),
    ...(planTokensUsed !== undefined ? { tokensUsed: planTokensUsed } : {}),
  });

  // ========================
  // Fast path: no complex ops
  // ========================
  if (planned.complexOps.length === 0) {
    const result = createModifyResult(
      planned.explanation,
      planned.simpleOps.map((entry) => entry.operation),
    );
    if (trace) {
      trace.modify = {
        requestSummary: planRequestSummary,
        model,
        rawOutput: planText,
        normalizedResult: result,
      };
    }
    return result;
  }

  // ========================
  // Phase 2: Execute complex insertNode ops with component contracts
  // ========================
  const executeTraces: NonNullable<ModifySchemaTraceEntry['executeTraces']> = [];
  const executedOps: Array<{ index: number; operation: AgentOperation }> = [];

  // Execute Phase 2 calls in parallel
  const phase2Tasks = planned.complexOps.map(async ({ index, skeleton }) => {
    const insertMessages = createInsertNodeMessages(skeleton, input);
    const insertRequestSummary = {
      provider,
      ...client.buildRequestDebugSummary(model, insertMessages, thinking, false),
    };

    try {
      const { content: insertText, durationMs: insertDurationMs, inputTokens: insertInputTokens, outputTokens: insertOutputTokens, tokensUsed: insertTokensUsed } = await client.chat(model, insertMessages, thinking);
      const insertParsed = extractJson<unknown>(insertText, 'modify-insertNode', input.request, model);

      let node: unknown;
      if (isRecord(insertParsed) && 'node' in insertParsed) {
        node = insertParsed.node;
      } else if (isRecord(insertParsed) && 'component' in insertParsed) {
        // LLM returned the node directly instead of wrapped in {node: ...}
        node = insertParsed;
      } else {
        throw new LLMError('Phase 2 insertNode returned invalid shape', 'INVALID_INSERT_NODE_RESULT');
      }

      executeTraces.push({
        operationIndex: index,
        requestSummary: insertRequestSummary,
        rawOutput: insertText,
        generatedNode: node,
        ...(insertDurationMs !== undefined ? { durationMs: insertDurationMs } : {}),
        ...(insertInputTokens !== undefined ? { inputTokens: insertInputTokens } : {}),
        ...(insertOutputTokens !== undefined ? { outputTokens: insertOutputTokens } : {}),
        ...(insertTokensUsed !== undefined ? { tokensUsed: insertTokensUsed } : {}),
      });

      const insertMetrics: import('@shenbi/ai-contracts').AgentOperationMetrics = {
        ...(insertDurationMs !== undefined ? { durationMs: insertDurationMs } : {}),
        ...(insertInputTokens !== undefined ? { inputTokens: insertInputTokens } : {}),
        ...(insertOutputTokens !== undefined ? { outputTokens: insertOutputTokens } : {}),
        ...(insertTokensUsed !== undefined ? { tokensUsed: insertTokensUsed } : {}),
      };

      const finalOp: AgentOperation = {
        op: 'schema.insertNode',
        ...(skeleton.parentId ? { parentId: skeleton.parentId } : {}),
        ...(skeleton.container ? { container: skeleton.container } : {}),
        ...(skeleton.index !== undefined ? { index: skeleton.index } : {}),
        ...('label' in skeleton && skeleton.label ? { label: skeleton.label as string } : {}),
        node: node as AgentOperation extends { op: 'schema.insertNode'; node: infer N } ? N : never,
        _metrics: insertMetrics,
      } as AgentOperation;

      executedOps.push({ index, operation: finalOp });
    } catch (error) {
      // Fallback: generate a placeholder Typography.Text node
      logger.error('modify.phase2_insertNode_failed', {
        operationIndex: index,
        error: error instanceof Error ? error.message : String(error),
      });
      executeTraces.push({
        operationIndex: index,
        requestSummary: insertRequestSummary,
        rawOutput: error instanceof Error ? error.message : String(error),
      });

      const fallbackOp: AgentOperation = {
        op: 'schema.insertNode',
        ...(skeleton.parentId ? { parentId: skeleton.parentId } : {}),
        ...(skeleton.container ? { container: skeleton.container } : {}),
        ...(skeleton.index !== undefined ? { index: skeleton.index } : {}),
        node: {
          id: `generated-${index}-${Date.now().toString(36)}`,
          component: 'Typography.Text',
          props: { type: 'secondary' },
          children: skeleton.description ?? '(生成失败，请重试)',
        },
      } as AgentOperation;

      executedOps.push({ index, operation: fallbackOp });
    }
  });

  await Promise.all(phase2Tasks);

  const result = createModifyResult(
    planned.explanation,
    mergePlannedOperations(planParsed.operations, planned.simpleOps, executedOps),
  );

  if (trace) {
    trace.modify = {
      requestSummary: planRequestSummary,
      model,
      rawOutput: planText,
      normalizedResult: result,
      executeTraces,
    };
  }

  return result;
}

/** Phase 1 only: run the planner LLM call and classify ops into simple vs complex. */
export async function planModify(
  input: ModifySchemaInput,
  trace?: { modify?: ModifySchemaTraceEntry },
): Promise<PlanModifyResult> {
  if (!input.request.context.schemaJson) {
    throw new LLMError('modifySchema requires context.schemaJson', 'MISSING_SCHEMA_CONTEXT');
  }

  const requestedModel = input.request.blockModel ?? env.AI_BLOCK_MODEL;
  const modelRef = parseProviderModelRef(requestedModel);
  const client = createClient(modelRef.provider);
  const model = requireModel(modelRef.model ?? requestedModel);
  const thinking = getThinking(input.request);
  const provider = modelRef.provider ?? env.AI_PROVIDER;

  const planMessages = createPlanMessages(input);
  const planRequestSummary = {
    provider,
    ...client.buildRequestDebugSummary(model, planMessages, thinking, false),
  };
  const {
    content: planText,
    durationMs: planDurationMs,
    inputTokens: planInputTokens,
    outputTokens: planOutputTokens,
    tokensUsed: planTokensUsed,
  } = await client.chat(model, planMessages, thinking);
  const planParsed = extractJson<unknown>(planText, 'modify', input.request, model);
  if (!isPlanResult(planParsed)) {
    const debugFile = writeInvalidJsonDump({
      source: 'modify',
      rawOutput: planText,
      summarizedOutput: planText.slice(0, 400),
      request: input.request,
      model,
    });
    throw new LLMError(`modifySchema planner returned an invalid result shape. Debug file: ${debugFile}`, 'INVALID_MODIFY_RESULT');
  }

  if (trace) {
    trace.modify = { requestSummary: planRequestSummary, model, rawOutput: planText };
  }

  return splitPlannedOperations(planParsed, {
    ...(planDurationMs !== undefined ? { durationMs: planDurationMs } : {}),
    ...(planInputTokens !== undefined ? { inputTokens: planInputTokens } : {}),
    ...(planOutputTokens !== undefined ? { outputTokens: planOutputTokens } : {}),
    ...(planTokensUsed !== undefined ? { tokensUsed: planTokensUsed } : {}),
  });
}

/** Phase 2: generate the full node for a single insertNode skeleton. */
export async function executeComplexOp(
  skeleton: PlanInsertNodeSkeleton,
  index: number,
  input: ModifySchemaInput,
  trace?: { modify?: ModifySchemaTraceEntry },
): Promise<ComplexOpResult> {
  const requestedModel = input.request.blockModel ?? env.AI_BLOCK_MODEL;
  const modelRef = parseProviderModelRef(requestedModel);
  const client = createClient(modelRef.provider);
  const model = requireModel(modelRef.model ?? requestedModel);
  const thinking = getThinking(input.request);
  const provider = modelRef.provider ?? env.AI_PROVIDER;

  const insertMessages = createInsertNodeMessages(skeleton, input);
  const insertRequestSummary = {
    provider,
    ...client.buildRequestDebugSummary(model, insertMessages, thinking, false),
  };

  try {
    const {
      content: insertText,
      durationMs: insertDurationMs,
      inputTokens: insertInputTokens,
      outputTokens: insertOutputTokens,
      tokensUsed: insertTokensUsed,
    } = await client.chat(model, insertMessages, thinking);
    const insertParsed = extractJson<unknown>(insertText, 'modify-insertNode', input.request, model);

    let node: unknown;
    if (isRecord(insertParsed) && 'node' in insertParsed) {
      node = insertParsed.node;
    } else if (isRecord(insertParsed) && 'component' in insertParsed) {
      node = insertParsed;
    } else {
      throw new LLMError('Phase 2 insertNode returned invalid shape', 'INVALID_INSERT_NODE_RESULT');
    }

    const insertMetrics: import('@shenbi/ai-contracts').AgentOperationMetrics = {
      ...(insertDurationMs !== undefined ? { durationMs: insertDurationMs } : {}),
      ...(insertInputTokens !== undefined ? { inputTokens: insertInputTokens } : {}),
      ...(insertOutputTokens !== undefined ? { outputTokens: insertOutputTokens } : {}),
      ...(insertTokensUsed !== undefined ? { tokensUsed: insertTokensUsed } : {}),
    };

    const finalOp: AgentOperation = {
      op: 'schema.insertNode',
      ...(skeleton.parentId ? { parentId: skeleton.parentId } : {}),
      ...(skeleton.container ? { container: skeleton.container } : {}),
      ...(skeleton.index !== undefined ? { index: skeleton.index } : {}),
      ...('label' in skeleton && skeleton.label ? { label: skeleton.label as string } : {}),
      node: node as AgentOperation extends { op: 'schema.insertNode'; node: infer N } ? N : never,
      _metrics: insertMetrics,
    } as AgentOperation;

    if (trace?.modify) {
      trace.modify.executeTraces = [
        ...(trace.modify.executeTraces ?? []),
        {
          operationIndex: index,
          requestSummary: insertRequestSummary,
          rawOutput: insertText,
          generatedNode: node,
          ...(insertDurationMs !== undefined ? { durationMs: insertDurationMs } : {}),
          ...(insertInputTokens !== undefined ? { inputTokens: insertInputTokens } : {}),
          ...(insertOutputTokens !== undefined ? { outputTokens: insertOutputTokens } : {}),
          ...(insertTokensUsed !== undefined ? { tokensUsed: insertTokensUsed } : {}),
        },
      ];
    }

    return { index, operation: finalOp, metrics: insertMetrics };
  } catch (error) {
    logger.error('modify.phase2_insertNode_failed', {
      operationIndex: index,
      error: error instanceof Error ? error.message : String(error),
    });
    const fallbackOp: AgentOperation = {
      op: 'schema.insertNode',
      ...(skeleton.parentId ? { parentId: skeleton.parentId } : {}),
      ...(skeleton.container ? { container: skeleton.container } : {}),
      ...(skeleton.index !== undefined ? { index: skeleton.index } : {}),
      node: {
        id: `generated-${index}-${Date.now().toString(36)}`,
        component: 'Typography.Text',
        props: { type: 'secondary' },
        children: skeleton.description ?? '(生成失败，请重试)',
      },
    } as AgentOperation;
    return { index, operation: fallbackOp, metrics: {} };
  }
}
