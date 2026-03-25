/**
 * Default runtime assembly — API Host 通过 @shenbi/ai-agents 产出真实事件流，
 * 底层直接调用真实 provider；provider/模型异常时明确抛错。
 */
import {
  assessBlockQuality,
  assembleSchema,
  buildPageBlockPromptSpec,
  expandComponents,
  getDesignPolicySummary,
  getFreeLayoutPatternSummary,
  getFullComponentContracts,
  getPageSkeleton,
  getPageSkeletonSummary,
  getPlannerContractSummary,
  buildSkeletonSchema,
  buildPagePlannerPromptSpec,
  createInMemoryAgentMemoryStore,
  createToolRegistry,
  isMasterDetailPrompt,
  isMasterListBlock,
  shouldUseRetryResult,
  type AgentMemoryMessage,
  type AgentMemoryStore,
  type BlockQualityDiagnostic,
  type ClassifyIntentInput,
  formatConversationHistory,
  type FinalizeRequest,
  type FinalizeResult,
  type IntentClassification,
  type LayoutRow,
  runAgent,
  runAgentStream,
  type AgentRuntimeDeps,
  type AssembleSchemaInput,
  type GenerateBlockInput,
  type GenerateBlockResult,
  type PagePlan,
  type PageType,
  type PlanPageInput,
  type RunMetadata,
  type RunRequest,
} from '@shenbi/ai-agents';
import type { AgentEvent, ChatRequest, ChatResponse } from '@shenbi/ai-contracts';
import type { PageSchema, SchemaNode } from '@shenbi/schema';
import { LLMError } from '../adapters/errors.ts';
import {
  writeInvalidJsonDump,
  writeMemoryDump,
  writeTraceDump,
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
import {
  buildUserMessageContent,
  buildUserMessageContentFromLines,
  prepareRunRequest,
} from './request-attachments.ts';
import {
  isNodeLike,
  normalizeGeneratedNode,
  normalizeGeneratedNodeWithDiagnostics,
  type SanitizationDiagnostic,
  supportedComponents,
  supportedComponentList,
} from './normalize-schema.ts';
import {
  classifyIntentWithModel,
  type ClassifyIntentTraceEntry,
} from './classify-intent.ts';
import { executeModifySchema, planModify, executeComplexOp as executeComplexOpFn, type ModifySchemaTraceEntry } from './modify-schema.ts';
import type { AgentRuntime } from './types.ts';

export { assessBlockQuality };

const defaultMemory = createInMemoryAgentMemoryStore();
const env = loadEnv();
type JsonSalvageStrategy =
  | 'balanced_object'
  | 'trimmed_trailing_noise'
  | 'appended_missing_braces'
  | 'trimmed_extra_closing_braces';
const supportedPageTypes = ['dashboard', 'list', 'form', 'detail', 'statistics', 'custom'] as const;
const plannerContractSummary = getPlannerContractSummary();
const designPolicySummary = getDesignPolicySummary();

interface ProviderRequestTraceSummary extends OpenAICompatibleRequestDebugSummary {
  provider: string;
}

interface RunTraceRecord {
  request: RunRequest;
  suggestedPageType?: PageType;
  memory?: {
    finalAssistantMessage?: AgentMemoryMessage;
    conversationTail?: AgentMemoryMessage[];
    lastRunMetadata?: RunMetadata;
    lastBlockIds?: string[];
  };
  classifyIntent?: ClassifyIntentTraceEntry;
  planner?: {
    requestSummary?: ProviderRequestTraceSummary;
    model: string;
    rawOutput: string;
    normalizedPlan?: PagePlan;
  };
  blocks: Array<{
    blockId: string;
    description: string;
    suggestedComponents: string[];
    requestSummary?: ProviderRequestTraceSummary;
    model: string;
    rawOutput: string;
    normalizedNode?: GenerateBlockResult['node'];
    sanitizationDiagnostics?: SanitizationDiagnostic[];
    qualityDiagnostics?: BlockQualityDiagnostic[];
    retryRequestSummary?: ProviderRequestTraceSummary;
    retryRawOutput?: string;
    retryNormalizedNode?: GenerateBlockResult['node'];
    retrySanitizationDiagnostics?: SanitizationDiagnostic[];
  }>;
  modify?: ModifySchemaTraceEntry;
  finalSchema?: PageSchema;
  error?: {
    message: string;
    stack?: string;
  };
}

interface MemoryDebugSnapshot {
  conversationId: string;
  sessionId?: string;
  conversationSize: number;
  assistantMessage?: AgentMemoryMessage;
  conversationTail: AgentMemoryMessage[];
  lastRunMetadata?: RunMetadata;
  lastBlockIds: string[];
}

function cloneDebugValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function classifyPromptToPageType(prompt: string): PageType {
  const normalized = prompt.toLowerCase();
  if (/自定义|自由|创意|landing|marketing/.test(prompt)) {
    return 'custom';
  }
  if (
    (/主从|master[-\s]?detail/i.test(prompt) || /左侧.*(树|列表)|右侧.*tabs?/i.test(prompt))
    && /详情|tabs?|树|列表/i.test(prompt)
  ) {
    return 'detail';
  }

  const scores: Record<PageType, number> = {
    dashboard: 0,
    list: 0,
    form: 0,
    detail: 0,
    statistics: 0,
    custom: 0,
  };

  if (/首页|工作台|大屏|dashboard|概览|看板|驾驶舱/.test(prompt) || normalized.includes('home')) {
    scores.dashboard += 5;
  }
  if (/趋势|报表|分析|统计|概览/.test(prompt)) {
    scores.dashboard += 2;
    scores.statistics += 3;
  }
  if (/列表|list|table|查询|管理/.test(prompt)) {
    scores.list += 3;
  }
  if (/表单|新建|创建|编辑|录入/.test(prompt)) {
    scores.form += 3;
  }
  if (/审批/.test(prompt)) {
    scores.form += 1;
    scores.detail += 1;
    scores.dashboard += 1;
  }
  if (/详情|detail|profile|信息页/.test(prompt)) {
    scores.detail += 3;
  }
  if (/抽屉|drawer/.test(prompt)) {
    scores.dashboard += 1;
    scores.detail += 1;
  }

  if (scores.dashboard > 0 && /表格|table|筛选|tabs|快捷操作/.test(prompt)) {
    scores.dashboard += 2;
  }

  const orderedTypes: PageType[] = ['dashboard', 'statistics', 'list', 'detail', 'form', 'custom'];
  let bestType: PageType = 'custom';
  let bestScore = 0;
  for (const pageType of orderedTypes) {
    if (scores[pageType] > bestScore) {
      bestType = pageType;
      bestScore = scores[pageType];
    }
  }

  return bestScore > 0 ? bestType : 'custom';
}

function defaultLayoutFromBlocks(blockIds: string[]): LayoutRow[] {
  return [{ blocks: blockIds }];
}

function isBlocksRow(row: LayoutRow): row is Extract<LayoutRow, { blocks: string[] }> {
  return 'blocks' in row;
}

function validateLayoutRow(row: LayoutRow, knownBlockIds: Set<string>, rowIndex: number): void {
  if (isBlocksRow(row)) {
    if (!Array.isArray(row.blocks) || row.blocks.length === 0) {
      throw new LLMError(`Planner returned empty layout row at index ${rowIndex}`, 'INVALID_LAYOUT_ROW');
    }
    for (const blockId of row.blocks) {
      if (!knownBlockIds.has(blockId)) {
        throw new LLMError(`Planner layout references unknown block id: ${blockId}`, 'UNKNOWN_LAYOUT_BLOCK');
      }
    }
    return;
  }

  if (!Array.isArray(row.columns) || row.columns.length === 0) {
    throw new LLMError(`Planner returned empty layout columns at index ${rowIndex}`, 'INVALID_LAYOUT_COLUMNS');
  }

  const totalSpan = row.columns.reduce((sum, column) => sum + (Number.isFinite(column.span) ? column.span : 0), 0);
  if (totalSpan !== 24) {
    throw new LLMError(`Planner layout row ${rowIndex} must sum to 24 span, received ${totalSpan}`, 'INVALID_LAYOUT_SPAN');
  }

  row.columns.forEach((column, columnIndex) => {
    if (!Array.isArray(column.blocks) || column.blocks.length === 0) {
      throw new LLMError(`Planner returned empty layout column at row ${rowIndex}, column ${columnIndex}`, 'INVALID_LAYOUT_COLUMN');
    }
    for (const blockId of column.blocks) {
      if (!knownBlockIds.has(blockId)) {
        throw new LLMError(`Planner layout references unknown block id: ${blockId}`, 'UNKNOWN_LAYOUT_BLOCK');
      }
    }
  });
}

function collectLayoutBlockIds(layout: LayoutRow[]): string[] {
  return layout.flatMap((row) => (
    isBlocksRow(row)
      ? row.blocks
      : row.columns.flatMap((column) => column.blocks)
  ));
}

function summarizeModelOutput(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= 320) {
    return compact;
  }
  return `${compact.slice(0, 320)}...`;
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
    if (char === '{') {
      stack.push(char);
      continue;
    }
    if (char === '[') {
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
    let trimmed = base;
    while (trimmed.length > 0) {
      const next = trimmed.trimEnd().slice(0, -1);
      if (!next) {
        break;
      }
      const nextOpenCount = countOutsideStrings(next, '{');
      const nextCloseCount = countOutsideStrings(next, '}');
      trimmed = next;
      if (nextOpenCount === nextCloseCount) {
        return {
          candidate: trimmed.trim(),
          strategy: 'trimmed_extra_closing_braces',
        };
      }
      if (nextCloseCount < nextOpenCount) {
        break;
      }
    }
    return null;
  }
  return null;
}

function stripArrowFunctions(text: string): { text: string; stripped: boolean } {
  // LLMs sometimes emit JS arrow functions in JSON, e.g.:
  //   "render": (text) => `<Tag color='orange'>${text}</Tag>`
  //   "render": (text) => text > 0 ? `<Tag>...</Tag>` : `<Tag>0</Tag>`
  // These are not valid JSON. Replace the entire value with null.
  // Pattern: matches from an arrow function start "(..." through "=>" to the
  // next property boundary (a comma followed by a key, or a closing }).
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
      if (inBacktick) { if (ch === '`') inBacktick = false; pos++; continue; }
      if (ch === '`') { inBacktick = true; pos++; continue; }
      if (ch === ',' || ch === '}' || ch === ']') break;
      pos++;
    }
    chunks.push(text.slice(lastEnd, colonIdx), ': null');
    lastEnd = pos;
  }
  if (chunks.length === 0) return { text, stripped: false };
  chunks.push(text.slice(lastEnd));
  const result = chunks.join('');
  return { text: result, stripped: true };
}

function extractJson<T>(
  text: string,
  source: InvalidJsonSource,
  request: Pick<RunRequest, 'prompt' | 'plannerModel' | 'blockModel' | 'thinking' | 'context'>,
  model: string,
): T {
  let candidate = extractJsonCandidate(text);

  // Pre-process: strip JS arrow functions that LLMs sometimes inject
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

const clientCache = new Map<string, OpenAICompatibleClient>();

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

function requireModel(model: string | undefined, kind: 'planner' | 'block' | 'chat'): string {
  if (!model) {
    throw new LLMError(`Missing ${kind} model configuration`, 'MISSING_MODEL');
  }
  return model;
}

function isSupportedComponent(value: unknown): value is string {
  return typeof value === 'string' && supportedComponents.includes(value);
}

function isSupportedPageType(value: unknown): value is PageType {
  return typeof value === 'string' && supportedPageTypes.includes(value as PageType);
}

function sanitizeBlockId(rawId: unknown, index: number, seenBlockIds: Map<string, number>): string {
  const safeBaseId = String(rawId || `block-${index + 1}`)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || `block-${index + 1}`;
  const nextCount = (seenBlockIds.get(safeBaseId) ?? 0) + 1;
  seenBlockIds.set(safeBaseId, nextCount);
  return nextCount === 1 ? safeBaseId : `${safeBaseId}-${nextCount}`;
}

function normalizePlan(plan: PagePlan): PagePlan {
  if (!plan.pageTitle || !Array.isArray(plan.blocks) || plan.blocks.length === 0) {
    throw new LLMError('Planner returned an empty page plan', 'EMPTY_PAGE_PLAN');
  }
  if (!isSupportedPageType(plan.pageType)) {
    throw new LLMError(`Planner returned unsupported pageType: ${String(plan.pageType)}`, 'UNSUPPORTED_PAGE_TYPE');
  }

  const seenBlockIds = new Map<string, number>();
  const normalizedBlocks = plan.blocks.map((block, index) => {
    const components = Array.isArray(block.components) ? block.components.filter(isSupportedComponent) : [];
    if (components.length === 0) {
      throw new LLMError(
        `Planner returned no supported components for block: ${String(block.id || `block-${index + 1}`)}`,
        'UNSUPPORTED_BLOCK_COMPONENTS',
      );
    }

    const complexity: PagePlan['blocks'][number]['complexity'] =
      block.complexity === 'medium' || block.complexity === 'complex'
        ? block.complexity
        : 'simple';

    return {
      id: sanitizeBlockId(block.id, index, seenBlockIds),
      description: String(block.description || `Block ${index + 1}`).trim() || `Block ${index + 1}`,
      components,
      priority: Number.isFinite(block.priority) ? block.priority : index + 1,
      complexity,
    };
  });

  const knownBlockIds = new Set(normalizedBlocks.map((block) => block.id));
  const initialLayout = Array.isArray(plan.layout) && plan.layout.length > 0
    ? plan.layout
    : defaultLayoutFromBlocks(normalizedBlocks.map((block) => block.id));

  initialLayout.forEach((row, rowIndex) => validateLayoutRow(row, knownBlockIds, rowIndex));

  const referencedIds = collectLayoutBlockIds(initialLayout);
  const seenLayoutIds = new Set<string>();
  for (const blockId of referencedIds) {
    if (seenLayoutIds.has(blockId)) {
      throw new LLMError(`Planner layout references duplicate block id: ${blockId}`, 'DUPLICATE_LAYOUT_BLOCK');
    }
    seenLayoutIds.add(blockId);
  }

  const missingBlockIds = normalizedBlocks
    .map((block) => block.id)
    .filter((blockId) => !seenLayoutIds.has(blockId));

  return {
    pageTitle: plan.pageTitle.trim(),
    pageType: plan.pageType,
    blocks: normalizedBlocks,
    layout: [
      ...initialLayout,
      ...(missingBlockIds.length > 0 ? defaultLayoutFromBlocks(missingBlockIds) : []),
    ],
  };
}

function createPlacementSummary(plan: PagePlan, blockId: string): string {
  const layout = plan.layout ?? defaultLayoutFromBlocks(plan.blocks.map((block) => block.id));

  for (const [rowIndex, row] of layout.entries()) {
    if (isBlocksRow(row)) {
      const blockIndex = row.blocks.indexOf(blockId);
      if (blockIndex >= 0) {
        return row.blocks.length === 1
          ? `第 ${rowIndex + 1} 行，满宽区域`
          : `第 ${rowIndex + 1} 行，第 ${blockIndex + 1} 个纵向堆叠区域`;
      }
      continue;
    }

    for (const [columnIndex, column] of row.columns.entries()) {
      const blockIndex = column.blocks.indexOf(blockId);
      if (blockIndex >= 0) {
        return [
          `第 ${rowIndex + 1} 行`,
          `第 ${columnIndex + 1} 列`,
          `宽度 ${column.span}/24`,
          column.blocks.length > 1 ? `列内第 ${blockIndex + 1} 个区块` : '列内唯一区块',
        ].join('，');
      }
    }
  }

  return '默认纵向堆叠区域';
}

function wrapStandaloneRoot(node: GenerateBlockResult['node'], blockId: string): GenerateBlockResult['node'] {
  const wrappedComponents = new Set([
    'Table',
    'Statistic',
    'Timeline',
    'Descriptions',
    'Result',
    'Empty',
    'Steps',
    'Progress',
    'Breadcrumb',
    'Pagination',
  ]);

  if (!wrappedComponents.has(node.component)) {
    return node;
  }

  return {
    id: `${blockId}-card-shell`,
    component: 'Card',
    props: {},
    children: [node],
  };
}

function normalizeBlockRootChild(child: unknown, blockId: string, index: number): SchemaNode {
  if (isNodeLike(child)) {
    return normalizeGeneratedNode(child);
  }

  return {
    id: `${blockId}-text-${index + 1}`,
    component: 'Typography.Text',
    props: {},
    children: String(child ?? ''),
  };
}

export function validateGeneratedBlockNodeWithDiagnostics(
  node: GenerateBlockResult['node'] | SchemaNode[],
  blockId: string,
): { node: GenerateBlockResult['node']; diagnostics: SanitizationDiagnostic[] } {
  if (Array.isArray(node)) {
    const normalizedRoot: SchemaNode = {
      id: `${blockId}-block-root`,
      component: 'Container',
      props: {
        direction: 'column',
        gap: 16,
      },
      children: node.map((child, index) => normalizeBlockRootChild(child, blockId, index)),
    };

    return {
      node: wrapStandaloneRoot(normalizedRoot, blockId),
      diagnostics: [],
    };
  }

  const normalizedRoot = normalizeGeneratedNodeWithDiagnostics(node);

  return {
    node: wrapStandaloneRoot(normalizedRoot.node, blockId),
    diagnostics: normalizedRoot.diagnostics,
  };
}

export function validateGeneratedBlockNode(
  node: GenerateBlockResult['node'] | SchemaNode[],
  blockId: string,
): GenerateBlockResult['node'] {
  return validateGeneratedBlockNodeWithDiagnostics(node, blockId).node;
}

function validateNode(node: GenerateBlockResult['node'], blockId: string): GenerateBlockResult['node'] {
  return validateGeneratedBlockNode(node, blockId);
}

function getRequestedChatModel(request: unknown): string | undefined {
  if (!request || typeof request !== 'object') {
    return undefined;
  }
  const candidate = request as { plannerModel?: unknown; blockModel?: unknown };
  if (typeof candidate.plannerModel === 'string' && candidate.plannerModel) {
    return candidate.plannerModel;
  }
  if (typeof candidate.blockModel === 'string' && candidate.blockModel) {
    return candidate.blockModel;
  }
  return undefined;
}

function getThinking(request: RunRequest): OpenAICompatibleThinking | undefined {
  return request.thinking ? { type: request.thinking.type } : undefined;
}

function getThinkingFromUnknown(request: unknown): OpenAICompatibleThinking | undefined {
  if (!request || typeof request !== 'object' || !('thinking' in request)) {
    return undefined;
  }
  const thinking = (request as { thinking?: RunRequest['thinking'] }).thinking;
  return thinking ? { type: thinking.type } : undefined;
}

function createPlannerMessages(input: PlanPageInput): OpenAICompatibleMessage[] {
  const suggestedPageType = classifyPromptToPageType(input.request.prompt);
  const suggestedSkeletonSummary = getPageSkeletonSummary(suggestedPageType);
  const freeLayoutPatternSummary = getFreeLayoutPatternSummary(suggestedPageType);
  const skeleton = getPageSkeleton(suggestedPageType);
  const conversationHistory = formatConversationHistory(input.context.conversation.history, {
    ...(input.context.document.schemaDigest ? { schemaDigest: input.context.document.schemaDigest } : {}),
  });
  const documentTree = input.context.document.tree ?? '[schema tree unavailable]';
  const promptSpec = buildPagePlannerPromptSpec({
    prompt: input.request.prompt,
    schemaSummary: input.context.document.summary,
    schemaTree: documentTree,
    componentSummary: input.context.componentSummary,
    conversationHistory,
    ...(input.context.selectedNodeId ? { selectedNodeId: input.context.selectedNodeId } : {}),
    supportedComponentList,
    supportedPageTypes,
    plannerContractSummary,
    designPolicySummary,
    suggestedPageType,
    suggestedSkeletonSummary,
    freeLayoutPatternSummary,
    recommendedLayoutIntent: skeleton.intent,
    recommendedLayoutPattern: skeleton.layoutPattern,
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

function createBlockMessages(
  input: GenerateBlockInput,
  qualityFeedback: BlockQualityDiagnostic[] = [],
): OpenAICompatibleMessage[] {
  const expandedComponents = expandComponents(input.block.components);
  const componentSchemaContracts = getFullComponentContracts(expandedComponents);
  const isDashboardBlock = classifyPromptToPageType(input.request.prompt) === 'dashboard';
  const isMasterListRegion = isMasterListBlock(input) || isMasterDetailPrompt(input.request.prompt);
  const isHeaderBlock = /header|title|hero|banner|标题|页头/.test(`${input.block.id} ${input.block.description}`.toLowerCase());
  const conversationHistory = formatConversationHistory(input.context.conversation.history, {
    ...(input.context.document.schemaDigest ? { schemaDigest: input.context.document.schemaDigest } : {}),
  });
  const documentTree = input.context.document.tree ?? '[schema tree unavailable]';
  const qualityFeedbackSummary = qualityFeedback.length > 0
    ? [
      'Targeted quality corrections for this retry:',
      ...qualityFeedback.map((item) => `- ${item.rule}: ${item.message}`),
      '- Apply the corrections above while keeping the block semantic intent unchanged.',
    ].join('\n')
    : '';
  const promptSpec = buildPageBlockPromptSpec({
    blockDescription: input.block.description,
    ...(input.pageTitle ? { pageTitle: input.pageTitle } : {}),
    ...(input.blockIndex !== undefined ? { blockIndex: input.blockIndex } : {}),
    ...(input.placementSummary ? { placementSummary: input.placementSummary } : {}),
    suggestedComponents: input.block.components,
    schemaTree: documentTree,
    conversationHistory,
    ...(qualityFeedbackSummary ? { qualityFeedbackSummary } : {}),
    supportedComponentList,
    supportedComponentsJsonShape: `{"component":"${supportedComponents.join('|')}","id":"string","props":{},"children":[]}`,
    expandedComponents,
    designPolicySummary,
    componentSchemaContracts,
    isDashboardBlock,
    isMasterListRegion,
    isHeaderBlock,
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

async function generateBlock(input: GenerateBlockInput, trace?: RunTraceRecord): Promise<GenerateBlockResult> {
  const requestedBlockModel = input.request.blockModel ?? env.AI_BLOCK_MODEL;
  const blockModelRef = parseProviderModelRef(requestedBlockModel);
  const client = createClient(blockModelRef.provider);
  const model = requireModel(blockModelRef.model ?? requestedBlockModel, 'block');
  const messages = createBlockMessages(input);
  const thinking = getThinking(input.request);
  const requestSummary: ProviderRequestTraceSummary = {
    provider: blockModelRef.provider ?? env.AI_PROVIDER,
    ...client.buildRequestDebugSummary(model, messages, thinking, false),
  };
  const { content: text, tokensUsed, inputTokens: blockInput, outputTokens: blockOutput, durationMs: blockDuration } = await client.chat(model, messages, thinking);
  const rawNode = extractJson<GenerateBlockResult['node']>(text, 'block', input.request, model);
  const { node, diagnostics } = validateGeneratedBlockNodeWithDiagnostics(rawNode, input.block.id);
  const qualityDiagnostics = assessBlockQuality(node, input);

  let finalText = text;
  let finalNode = node;
  let finalDiagnostics = diagnostics;
  let finalQualityDiagnostics = qualityDiagnostics;
  let retryText: string | undefined;
  let retryNode: GenerateBlockResult['node'] | undefined;
  let retryDiagnostics: SanitizationDiagnostic[] | undefined;
  let retryRequestSummary: ProviderRequestTraceSummary | undefined;
  let retryTokensUsed: number | undefined;

  if (qualityDiagnostics.some((item) => item.severity === 'retry')) {
    try {
      const retryMessages = createBlockMessages(input, qualityDiagnostics);
      const retryThinking = getThinking(input.request);
      retryRequestSummary = {
        provider: blockModelRef.provider ?? env.AI_PROVIDER,
        ...client.buildRequestDebugSummary(model, retryMessages, retryThinking, false),
      };
      const retryResult = await client.chat(model, retryMessages, retryThinking);
      retryText = retryResult.content;
      retryTokensUsed = retryResult.tokensUsed;
      const retryRawNode = extractJson<GenerateBlockResult['node']>(retryText, 'block', input.request, model);
      const validatedRetry = validateGeneratedBlockNodeWithDiagnostics(retryRawNode, input.block.id);
      retryNode = validatedRetry.node;
      retryDiagnostics = validatedRetry.diagnostics;
      const retryQualityDiagnostics = assessBlockQuality(retryNode, input);
      if (shouldUseRetryResult(qualityDiagnostics, retryQualityDiagnostics)) {
        finalText = retryText;
        finalNode = retryNode;
        finalDiagnostics = retryDiagnostics;
        finalQualityDiagnostics = retryQualityDiagnostics;
      }
    } catch (error) {
      logger.warn(`Block quality retry failed; keeping original block output for ${input.block.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const totalTokens = (tokensUsed ?? 0) + (retryTokensUsed ?? 0) || undefined;
  trace?.blocks.push({
    blockId: input.block.id,
    description: input.block.description,
    suggestedComponents: input.block.components,
    requestSummary,
    model,
    rawOutput: finalText,
    normalizedNode: finalNode,
    sanitizationDiagnostics: finalDiagnostics,
    qualityDiagnostics: finalQualityDiagnostics,
    ...(retryRequestSummary ? { retryRequestSummary } : {}),
    ...(retryText ? { retryRawOutput: retryText } : {}),
    ...(retryNode ? { retryNormalizedNode: retryNode } : {}),
    ...(retryDiagnostics ? { retrySanitizationDiagnostics: retryDiagnostics } : {}),
  });
  return {
    blockId: input.block.id,
    node: finalNode,
    summary: `Generated ${input.block.description} via ${model}`,
    ...(totalTokens !== undefined ? { tokensUsed: totalTokens } : {}),
    ...(blockInput !== undefined ? { inputTokens: blockInput } : {}),
    ...(blockOutput !== undefined ? { outputTokens: blockOutput } : {}),
    ...(blockDuration !== undefined ? { durationMs: blockDuration } : {}),
  };
}

async function planWithModel(input: PlanPageInput, trace?: RunTraceRecord): Promise<PagePlan> {
  const requestedPlannerModel = input.request.plannerModel ?? env.AI_PLANNER_MODEL;
  const plannerModelRef = parseProviderModelRef(requestedPlannerModel);
  const client = createClient(plannerModelRef.provider);
  const model = requireModel(plannerModelRef.model ?? requestedPlannerModel, 'planner');
  const messages = createPlannerMessages(input);
  const thinking = getThinking(input.request);
  const { content: text, tokensUsed, inputTokens: planInput, outputTokens: planOutput, durationMs: planDuration } = await client.chat(model, messages, thinking);
  const plan = extractJson<PagePlan>(text, 'planner', input.request, model);
  const normalizedPlan = normalizePlan(plan);
  if (trace) {
    trace.planner = {
      requestSummary: {
        provider: plannerModelRef.provider ?? env.AI_PROVIDER,
        ...client.buildRequestDebugSummary(model, messages, thinking, false),
      },
      model,
      rawOutput: text,
      normalizedPlan,
      ...(tokensUsed !== undefined ? { tokensUsed } : {}),
    };
  }
  const plannerMetrics: { durationMs?: number; inputTokens?: number; outputTokens?: number; tokensUsed?: number } = {
    ...(planDuration !== undefined ? { durationMs: planDuration } : {}),
    ...(planInput !== undefined ? { inputTokens: planInput } : {}),
    ...(planOutput !== undefined ? { outputTokens: planOutput } : {}),
    ...(tokensUsed !== undefined ? { tokensUsed } : {}),
  };
  return Object.keys(plannerMetrics).length > 0
    ? { ...normalizedPlan, _plannerMetrics: plannerMetrics } as typeof normalizedPlan & { _plannerMetrics: typeof plannerMetrics }
    : normalizedPlan;
}

export function createLegacyRuntimeDeps(memory: AgentMemoryStore, trace?: RunTraceRecord): AgentRuntimeDeps {
  return {
    llm: {
      async chat(request: unknown) {
        const requestedChatModel = getRequestedChatModel(request) ?? env.AI_PLANNER_MODEL ?? env.AI_BLOCK_MODEL;
        const chatModelRef = parseProviderModelRef(requestedChatModel);
        const client = createClient(chatModelRef.provider);
        const model = requireModel(chatModelRef.model ?? requestedChatModel, 'chat');
        const prompt = typeof request === 'object' && request && 'prompt' in request
          ? String((request as { prompt: unknown }).prompt)
          : 'No prompt';
        const attachments = typeof request === 'object' && request && 'attachments' in request
          ? ((request as { attachments?: RunRequest['attachments'] }).attachments ?? undefined)
          : undefined;
        const thinking = getThinkingFromUnknown(request);
        const { content: text } = await client.chat(model, [
          { role: 'system', content: 'You are a helpful low-code assistant.' },
          { role: 'user', content: buildUserMessageContent(prompt, attachments) },
        ], thinking);
        return { text };
      },
      async *streamChat(request: unknown) {
        const prompt = typeof request === 'object' && request && 'prompt' in request
          ? String((request as { prompt: unknown }).prompt)
          : 'No prompt';
        const attachments = typeof request === 'object' && request && 'attachments' in request
          ? ((request as { attachments?: RunRequest['attachments'] }).attachments ?? undefined)
          : undefined;
        const requestedChatModel = getRequestedChatModel(request) ?? env.AI_PLANNER_MODEL ?? env.AI_BLOCK_MODEL;
        const chatModelRef = parseProviderModelRef(requestedChatModel);
        const client = createClient(chatModelRef.provider);
        const model = requireModel(chatModelRef.model ?? requestedChatModel, 'chat');
        const thinking = getThinkingFromUnknown(request);
        yield* client.streamChat(model, [
          { role: 'system', content: 'You are a helpful low-code assistant.' },
          { role: 'user', content: buildUserMessageContent(prompt, attachments) },
        ], thinking);
      },
    },
    tools: createToolRegistry([
      {
        name: 'classifyIntent',
        async execute(input: unknown) {
          return classifyIntentWithModel(
            input as ClassifyIntentInput,
            trace ? (trace.classifyIntent = { model: 'unknown', rawOutput: '' }) : undefined,
          ) as Promise<IntentClassification>;
        },
      },
      {
        name: 'modifySchema',
        async execute(input: unknown) {
          return executeModifySchema(input as import('@shenbi/ai-agents').ModifySchemaInput, trace);
        },
      },
      {
        name: 'planModify',
        async execute(input: unknown) {
          return planModify(input as import('@shenbi/ai-agents').ModifySchemaInput, trace);
        },
      },
      {
        name: 'executeComplexOp',
        async execute(input: unknown) {
          const typed = input as { skeleton: unknown; index: number; input: import('@shenbi/ai-agents').ModifySchemaInput };
          return executeComplexOpFn(typed.skeleton as Parameters<typeof executeComplexOpFn>[0], typed.index, typed.input, trace);
        },
      },
      {
        name: 'planPage',
        async execute(input: unknown) {
          return planWithModel(input as PlanPageInput, trace);
        },
      },
      {
        name: 'generateBlock',
        async execute(input: unknown) {
          return generateBlock(input as GenerateBlockInput, trace);
        },
      },
      {
        name: 'buildSkeletonSchema',
        async execute(input: unknown) {
          return buildSkeletonSchema((input as { plan: PagePlan }).plan);
        },
      },
      {
        name: 'assembleSchema',
        async execute(input: unknown) {
          const schema = assembleSchema(input as AssembleSchemaInput);
          if (trace) {
            trace.finalSchema = schema;
          }
          return schema;
        },
      },
    ]),
    memory,
    logger: {
      info() {
        // API host already handles request-level logging.
      },
      error() {
        // API host already handles request-level logging.
      },
    },
  };
}

function extractMetadata(events: AgentEvent[]): RunMetadata {
  const doneEvent = [...events].reverse().find((event): event is Extract<AgentEvent, { type: 'done' }> => event.type === 'done');
  if (!doneEvent) {
    throw new Error('Agent runtime completed without done metadata');
  }
  return doneEvent.data.metadata;
}

function createTrace(request: RunRequest): RunTraceRecord {
  return {
    request,
    suggestedPageType: classifyPromptToPageType(request.prompt),
    blocks: [],
  };
}

function finalizeTrace(
  trace: RunTraceRecord,
  status: 'success' | 'error',
  metadata?: RunMetadata,
  error?: unknown,
): string {
  if (error) {
    trace.error = {
      message: error instanceof Error ? error.message : String(error),
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    };
  }
  const debugFile = writeTraceDump({ status, trace });
  if (metadata) {
    metadata.debugFile = debugFile;
  }
  return debugFile;
}

function buildFailedAssistantText(existingText: string, error?: string): string {
  const prefix = '[修改失败]';
  const trimmed = existingText.trim();
  if (trimmed.startsWith(prefix)) {
    return trimmed;
  }
  const detail = error ? `${prefix} ${error}` : prefix;
  return trimmed ? `${detail}\n${trimmed}` : detail;
}

function findAssistantMessageBySessionId(
  conversation: AgentMemoryMessage[],
  sessionId: string,
): AgentMemoryMessage | undefined {
  return [...conversation]
    .reverse()
    .find((message) => message.role === 'assistant' && message.meta?.sessionId === sessionId);
}

async function captureMemoryDebugSnapshot(
  memory: AgentMemoryStore,
  conversationId: string,
  sessionId?: string,
): Promise<MemoryDebugSnapshot> {
  const [conversation, lastRunMetadata, lastBlockIds] = await Promise.all([
    memory.getConversation(conversationId),
    memory.getLastRunMetadata(conversationId),
    memory.getLastBlockIds(conversationId),
  ]);

  return {
    conversationId,
    ...(sessionId ? { sessionId } : {}),
    conversationSize: conversation.length,
    ...(() => {
      if (!sessionId) {
        return {};
      }
      const assistantMessage = findAssistantMessageBySessionId(conversation, sessionId);
      return assistantMessage ? { assistantMessage: cloneDebugValue(assistantMessage) } : {};
    })(),
    conversationTail: cloneDebugValue(conversation.slice(-6)),
    ...(lastRunMetadata ? { lastRunMetadata: cloneDebugValue(lastRunMetadata) } : {}),
    lastBlockIds: cloneDebugValue(lastBlockIds),
  };
}

export async function attachTraceMemory(
  trace: RunTraceRecord,
  memory: AgentMemoryStore,
  conversationId: string,
  sessionId: string,
): Promise<void> {
  const snapshot = await captureMemoryDebugSnapshot(memory, conversationId, sessionId);
  trace.memory = {
    ...(snapshot.assistantMessage ? { finalAssistantMessage: snapshot.assistantMessage } : {}),
    conversationTail: snapshot.conversationTail,
    ...(snapshot.lastRunMetadata ? { lastRunMetadata: snapshot.lastRunMetadata } : {}),
    lastBlockIds: snapshot.lastBlockIds,
  };
}

export async function attachTraceMemoryBestEffort(
  trace: RunTraceRecord,
  memory: AgentMemoryStore,
  conversationId: string,
  sessionId: string,
): Promise<void> {
  try {
    await attachTraceMemory(trace, memory, conversationId, sessionId);
  } catch (error) {
    logger.warn('ai.runtime.trace_memory_failed', {
      conversationId,
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function createAgentRuntime(memory: AgentMemoryStore = defaultMemory): AgentRuntime {
  return {
    async run(request) {
      const preparedRequest = await prepareRunRequest(request);
      const trace = createTrace(preparedRequest);
      try {
        const events = await runAgent(preparedRequest, createLegacyRuntimeDeps(memory, trace));
        const metadata = extractMetadata(events);
        if (metadata.conversationId) {
          await attachTraceMemoryBestEffort(trace, memory, metadata.conversationId, metadata.sessionId);
        }
        finalizeTrace(trace, 'success', metadata);
        return { events, metadata };
      } catch (error) {
        const debugFile = finalizeTrace(trace, 'error', undefined, error);
        throw new LLMError(
          `${error instanceof Error ? error.message : 'Runtime error'}. Trace file: ${debugFile}`,
          'RUNTIME_TRACE_ERROR',
        );
      }
    },

    async *runStream(request) {
      const preparedRequest = await prepareRunRequest(request);
      const trace = createTrace(preparedRequest);
      const generator = runAgentStream(preparedRequest, createLegacyRuntimeDeps(memory, trace));
      let terminalEvent: AgentEvent | undefined;

      try {
        for await (const event of generator) {
          if (event.type === 'done' || event.type === 'error') {
            terminalEvent = event;
            continue;
          }
          yield event;
        }

        if (terminalEvent?.type === 'done') {
          const metadata = terminalEvent.data.metadata;
          if (metadata.conversationId) {
            await attachTraceMemoryBestEffort(trace, memory, metadata.conversationId, metadata.sessionId);
          }
          finalizeTrace(trace, 'success', metadata);
          yield terminalEvent;
          return;
        }

        if (terminalEvent?.type === 'error') {
          const debugFile = finalizeTrace(trace, 'error', undefined, terminalEvent.data.message);
          yield {
            type: 'error',
            data: {
              ...terminalEvent.data,
              message: `${terminalEvent.data.message}. Trace file: ${debugFile}`,
            },
          };
        }
      } catch (error) {
        const debugFile = finalizeTrace(trace, 'error', undefined, error);
        throw new LLMError(
          `${error instanceof Error ? error.message : 'Runtime error'}. Trace file: ${debugFile}`,
          'RUNTIME_TRACE_ERROR',
        );
      }
    },

    async chat(request: ChatRequest): Promise<ChatResponse> {
      const chatModelRef = parseProviderModelRef(request.model);
      const client = createClient(chatModelRef.provider);
      const model = requireModel(chatModelRef.model ?? request.model, 'chat');
      const messages = request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      }));
      const result = await client.chat(model, messages, request.thinking);
      return {
        content: result.content,
        ...(result.durationMs !== undefined ? { durationMs: result.durationMs } : {}),
        ...(result.inputTokens !== undefined || result.outputTokens !== undefined || result.tokensUsed !== undefined
          ? {
              tokensUsed: {
                ...(result.inputTokens !== undefined ? { input: result.inputTokens } : {}),
                ...(result.outputTokens !== undefined ? { output: result.outputTokens } : {}),
                ...(result.tokensUsed !== undefined ? { total: result.tokensUsed } : {}),
              },
            }
          : {}),
      };
    },

    async *chatStream(request: ChatRequest): AsyncIterable<{ delta: string }> {
      const chatModelRef = parseProviderModelRef(request.model);
      const client = createClient(chatModelRef.provider);
      const model = requireModel(chatModelRef.model ?? request.model, 'chat');
      const messages = request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      }));
      for await (const chunk of client.streamChat(model, messages, request.thinking)) {
        yield { delta: chunk.text };
      }
    },

    async finalize(request: FinalizeRequest) {
      if (typeof memory.patchAssistantMessage !== 'function') {
        return {};
      }

      const before = await captureMemoryDebugSnapshot(
        memory,
        request.conversationId,
        request.sessionId,
      );
      let outcome: 'patched' | 'skipped_missing_schema_digest' = 'patched';

      if (request.success) {
        if (!request.schemaDigest) {
          outcome = 'skipped_missing_schema_digest';
        } else {
          await memory.patchAssistantMessage(request.conversationId, request.sessionId, {
            meta: {
              schemaDigest: request.schemaDigest,
            },
          });
        }
      } else {
        const nextText = buildFailedAssistantText(before.assistantMessage?.text ?? '', request.error);

        await memory.patchAssistantMessage(request.conversationId, request.sessionId, {
          text: nextText,
          meta: {
            failed: true,
            ...(request.schemaDigest ? { schemaDigest: request.schemaDigest } : {}),
          },
          clearOperations: true,
        });
      }

      const after = await captureMemoryDebugSnapshot(
        memory,
        request.conversationId,
        request.sessionId,
      );
      const debugFile = writeMemoryDump({
        category: 'finalize',
        memory: {
          request,
          outcome,
          before,
          after,
        },
      });
      logger.info('ai.runtime.memory_dump', {
        conversationId: request.conversationId,
        sessionId: request.sessionId,
        success: request.success,
        debugFile,
      });
      const result: FinalizeResult = {
        memoryDebugFile: debugFile,
      };
      return result;
    },
  };
}

export const agentRuntime = createAgentRuntime();
