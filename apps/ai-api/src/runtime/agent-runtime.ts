/**
 * Default runtime assembly — API Host 通过 @shenbi/ai-agents 产出真实事件流，
 * 底层直接调用真实 provider；provider/模型异常时明确抛错。
 */
import {
  createInMemoryAgentMemoryStore,
  createToolRegistry,
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
import type { AgentEvent } from '@shenbi/ai-contracts';
import type { PageSchema } from '@shenbi/schema';
import { LLMError } from '../adapters/errors.ts';
import {
  writeInvalidJsonDump,
  writeTraceDump,
  type InvalidJsonSource,
} from '../adapters/debug-dump.ts';
import { loadEnv } from '../adapters/env.ts';
import { logger } from '../adapters/logger.ts';
import {
  OpenAICompatibleClient,
  type OpenAICompatibleMessage,
  type OpenAICompatibleThinking,
} from '../adapters/openai-compatible.ts';
import {
  normalizeGeneratedNode,
  supportedComponents,
  supportedComponentList,
} from './normalize-schema.ts';
import {
  getDesignPolicySummary,
  getFreeLayoutPatternSummary,
  getPageSkeleton,
  getPageSkeletonSummary,
  getPlannerContractSummary,
  expandComponents,
  getFullComponentContracts,
} from './component-catalog.ts';
import type { AgentRuntime } from './types.ts';

const memory = createInMemoryAgentMemoryStore();
const env = loadEnv();
type JsonSalvageStrategy =
  | 'balanced_object'
  | 'trimmed_trailing_noise'
  | 'appended_missing_braces'
  | 'trimmed_extra_closing_braces';
const supportedPageTypes = ['dashboard', 'list', 'form', 'detail', 'statistics', 'custom'] as const;
const plannerContractSummary = getPlannerContractSummary();
const designPolicySummary = getDesignPolicySummary();

interface RunTraceRecord {
  request: RunRequest;
  suggestedPageType?: PageType;
  planner?: {
    model: string;
    rawOutput: string;
    normalizedPlan?: PagePlan;
  };
  blocks: Array<{
    blockId: string;
    description: string;
    suggestedComponents: string[];
    model: string;
    rawOutput: string;
    normalizedNode?: GenerateBlockResult['node'];
  }>;
  finalSchema?: PageSchema;
  error?: {
    message: string;
    stack?: string;
  };
}

function classifyPromptToPageType(prompt: string): PageType {
  const normalized = prompt.toLowerCase();
  if (/自定义|自由|创意|landing|marketing/.test(prompt)) {
    return 'custom';
  }
  if (/详情|detail|profile|信息页/.test(prompt)) {
    return 'detail';
  }
  if (/表单|新建|创建|编辑|录入|审批/.test(prompt)) {
    return 'form';
  }
  if (/列表|list|table|查询|管理/.test(prompt)) {
    return 'list';
  }
  if (/统计|分析|趋势|报表/.test(prompt)) {
    return 'statistics';
  }
  if (/首页|大屏|dashboard|概览|看板|考勤/.test(prompt) || normalized.includes('home')) {
    return 'dashboard';
  }
  return 'custom';
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

let _client: OpenAICompatibleClient | null = null;

function createClient(): OpenAICompatibleClient {
  if (_client) {
    return _client;
  }
  if (!env.AI_PROVIDER) {
    throw new LLMError('AI_PROVIDER is not configured. Set AI_PROVIDER in .env.local.', 'MISSING_PROVIDER');
  }
  if (env.AI_PROVIDER !== 'openai-compatible') {
    throw new LLMError(`Unsupported AI provider: ${env.AI_PROVIDER}`, 'UNSUPPORTED_PROVIDER');
  }
  if (!env.AI_OPENAI_COMPAT_BASE_URL) {
    throw new LLMError('Missing AI_OPENAI_COMPAT_BASE_URL', 'MISSING_PROVIDER_BASE_URL');
  }
  if (!env.AI_OPENAI_COMPAT_API_KEY) {
    throw new LLMError('Missing AI_OPENAI_COMPAT_API_KEY', 'MISSING_PROVIDER_API_KEY');
  }
  _client = new OpenAICompatibleClient({
    baseUrl: env.AI_OPENAI_COMPAT_BASE_URL,
    apiKey: env.AI_OPENAI_COMPAT_API_KEY,
  });
  return _client;
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

function createSkeletonBlock(blockId: string, description: string): GenerateBlockResult['node'] {
  return {
    id: `${blockId}-skeleton`,
    component: 'Card',
    props: {
      title: description,
      style: {
        minHeight: 160,
      },
    },
    children: [
      {
        id: `${blockId}-skeleton-body`,
        component: 'Container',
        props: {
          direction: 'column',
          gap: 12,
        },
        children: [
          {
            id: `${blockId}-skeleton-line-1`,
            component: 'Typography.Text',
            props: { type: 'secondary' },
            children: ['Loading block...'],
          },
          {
            id: `${blockId}-skeleton-line-2`,
            component: 'Typography.Text',
            props: { type: 'secondary' },
            children: ['Preparing layout and content'],
          },
        ],
      },
    ],
  };
}

function buildStackNode(id: string, nodes: GenerateBlockResult['node'][], gap: number): GenerateBlockResult['node'] {
  if (nodes.length === 1) {
    return nodes[0]!;
  }

  return {
    id,
    component: 'Container',
    props: {
      direction: 'column',
      gap,
    },
    children: nodes,
  };
}

function isGeneratedNode(value: GenerateBlockResult['node'] | undefined): value is GenerateBlockResult['node'] {
  return Boolean(value);
}

function assembleFromLayout(layout: LayoutRow[], blockNodes: Record<string, GenerateBlockResult['node']>, gap: number): GenerateBlockResult['node'][] {
  return layout.map((row, rowIndex) => {
    if (isBlocksRow(row)) {
      const nodes = row.blocks.map((blockId) => blockNodes[blockId]).filter(isGeneratedNode);
      return buildStackNode(`layout-row-${rowIndex + 1}`, nodes, gap);
    }

    return {
      id: `layout-row-${rowIndex + 1}`,
      component: 'Row',
      props: {
        gutter: [gap, gap],
      },
      children: row.columns.map((column, columnIndex) => {
        const nodes = column.blocks.map((blockId) => blockNodes[blockId]).filter(isGeneratedNode);
        return {
          id: `layout-row-${rowIndex + 1}-col-${columnIndex + 1}`,
          component: 'Col',
          props: {
            span: column.span,
          },
          children: [buildStackNode(`layout-row-${rowIndex + 1}-col-${columnIndex + 1}-stack`, nodes, gap)],
        };
      }),
    };
  });
}

function findHeaderBlockId(plan: PagePlan): string | undefined {
  const layout = plan.layout ?? [];
  const firstRow = layout[0];
  if (!firstRow) {
    return undefined;
  }

  const firstIds = isBlocksRow(firstRow)
    ? firstRow.blocks
    : firstRow.columns.flatMap((column) => column.blocks);

  return plan.blocks.find((block) => {
    if (!firstIds.includes(block.id)) {
      return false;
    }
    const lower = `${block.id} ${block.description}`.toLowerCase();
    return /header|title|hero|banner|overview|summary|标题|概览/.test(lower);
  })?.id;
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

function validateNode(node: GenerateBlockResult['node'], blockId: string): GenerateBlockResult['node'] {
  return wrapStandaloneRoot(normalizeGeneratedNode(node), blockId);
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
  return [
    {
      role: 'system',
      content: [
        'You are a low-code page planner.',
        'Only output valid JSON.',
        `Use only these supported components when planning: ${supportedComponentList}.`,
        `Use only these page types: ${supportedPageTypes.join(', ')}.`,
        'Available component groups and contract summaries:',
        plannerContractSummary,
        'Design policy:',
        designPolicySummary,
        'Reference page skeleton for this request:',
        suggestedSkeletonSummary,
        'Free-layout patterns you may borrow from when they improve clarity:',
        freeLayoutPatternSummary,
        `Recommended layout intent: ${skeleton.intent}`,
        `Recommended layout pattern: ${skeleton.layoutPattern}`,
        'Hard rules:',
        '- pageTitle must be a concise human-readable title.',
        '- pageType must be exactly one of: dashboard, list, form, detail, statistics, custom.',
        '- layout must be an array of rows.',
        '- Each row is either {"blocks":["block-id"]} for vertical stacking or {"columns":[{"span":12,"blocks":["a"]},{"span":12,"blocks":["b"]}]}.',
        '- For rows with columns, the sum of span must equal 24.',
        '- blocks must be a non-empty array.',
        '- block.id is a semantic identifier and may contain business meaning such as employee-overview, attendance-records, approval-timeline.',
        '- block.components must be a non-empty array.',
        `- Every item in block.components must be chosen from: ${supportedComponentList}.`,
        '- Planner components must describe functional content only. Avoid Row, Col, Space, Flex, Divider, Container as planner outputs unless a KPI/statistic region clearly requires them.',
        '- The same block id may appear in layout at most once.',
        '- Every block should describe one visual region only; do not repeat the same semantic content in multiple blocks.',
        '- When the user describes left/right, top/bottom, double-column, triple-column, or asymmetric layout, express that through layout rows/columns instead of duplicating blocks.',
        '- If unsure, choose a single clear business block, not repeated regions.',
        `- For this request, prefer pageType "${suggestedPageType}" unless the user clearly asks for a custom mixed layout.`,
        '- Favor clean B2B admin layouts: clear page title, concise helper text, grouped filters, summary cards, primary data area, moderate whitespace.',
        '- Use free-layout patterns when they create a stronger composition, especially for custom or mixed business pages.',
        '- Return JSON only. No markdown, no explanation, no code fences.',
        'Valid example 1:',
        '{"pageTitle":"考勤首页","pageType":"dashboard","layout":[{"blocks":["header-block"]},{"columns":[{"span":16,"blocks":["kpi-block","records-block"]},{"span":8,"blocks":["timeline-block"]}]}],"blocks":[{"id":"header-block","description":"页面标题、描述和主操作区","components":["Typography.Title","Typography.Text","Button"],"priority":1,"complexity":"simple"},{"id":"kpi-block","description":"考勤核心指标区域","components":["Statistic","Tag"],"priority":2,"complexity":"simple"},{"id":"records-block","description":"最近考勤记录表格","components":["Table","Tag","Pagination"],"priority":3,"complexity":"medium"},{"id":"timeline-block","description":"审批动态时间线","components":["Timeline","Typography.Text"],"priority":4,"complexity":"medium"}]}',
        'Valid example 2:',
        '{"pageTitle":"员工详情","pageType":"detail","layout":[{"blocks":["detail-header"]},{"columns":[{"span":10,"blocks":["profile-block","contact-block"]},{"span":14,"blocks":["attendance-block","approval-block"]}]}],"blocks":[{"id":"detail-header","description":"页面标题、说明和操作按钮","components":["Typography.Title","Typography.Text","Button","Breadcrumb"],"priority":1,"complexity":"simple"},{"id":"profile-block","description":"员工基本信息","components":["Descriptions","Tag","Avatar"],"priority":2,"complexity":"simple"},{"id":"contact-block","description":"联系方式","components":["Descriptions","Typography.Text"],"priority":3,"complexity":"simple"},{"id":"attendance-block","description":"最近考勤记录","components":["Table","Pagination","Tag"],"priority":4,"complexity":"medium"},{"id":"approval-block","description":"审批动态","components":["Timeline","Badge"],"priority":5,"complexity":"medium"}]}',
        'Invalid example:',
        '{"pageTitle":"考勤首页","pageType":"dashboard","layout":[{"columns":[{"span":16,"blocks":["records"]},{"span":8,"blocks":["records"]}]}],"blocks":[{"id":"records","description":"最近记录","components":["Table"],"priority":1,"complexity":"simple"}]}',
        'Return exactly this JSON shape:',
        '{"pageTitle":"string","pageType":"dashboard|list|form|detail|statistics|custom","layout":[{"blocks":["block-id"]},{"columns":[{"span":12,"blocks":["left-block"]},{"span":12,"blocks":["right-block"]}]}],"blocks":[{"id":"string","description":"string","components":["Table"],"priority":1,"complexity":"simple"}]}',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Prompt: ${input.request.prompt}`,
        `Schema Summary: ${input.context.schemaSummary}`,
        `Component Summary: ${input.context.componentSummary}`,
        `Selected Node: ${input.context.selectedNodeId ?? 'none'}`,
        'Your response must start with { and end with }. No other text.',
      ].join('\n'),
    },
  ];
}

function createBlockMessages(input: GenerateBlockInput): OpenAICompatibleMessage[] {
  const expandedComponents = expandComponents(input.block.components);
  const componentSchemaContracts = getFullComponentContracts(expandedComponents);
  return [
    {
      role: 'system',
      content: [
        'You generate one low-code block as valid JSON.',
        `Only use supported components: ${supportedComponentList}.`,
        `For this block, prioritize these components: ${expandedComponents.join(', ')}.`,
        'Design policy:',
        designPolicySummary,
        'Component schema contracts (MUST follow these exact structures):',
        componentSchemaContracts,
        'Rules:',
        '- STRICT CONTRACT COMPLIANCE: Only use props that appear in the "Component schema contracts" section above. Do NOT add extra props from memory, from antd v4, or from any other source.',
        '- STRICT ENUM VALUES: For any prop that has a defined enum, use ONLY the exact values listed in the contract. Do not invent or substitute alternative values.',
        '- The root node component must be one of the supported components.',
        '- Every child schema node must also use only supported components.',
        '- children may contain schema nodes or plain text only.',
        '- Build polished B2B admin blocks with clear hierarchy, balanced spacing, and concise business copy.',
        '- You are generating one visual region only, not a whole page.',
        '- Do NOT output page-level wrappers, page-level titles, page shell, or duplicated sibling regions.',
        '- Do NOT output page-level Row/Col or Tabs split layouts unless the current block description explicitly requires an internal split inside this one block.',
        '- Prefer Card as a self-contained wrapper for data, detail, timeline, result, empty-state, and status regions.',
        '- KPI regions may use Row > Col > Statistic inside a single block.',
        '- Never use raw HTML tags like div, span, section, header, footer. Use Container instead of div/section/header/footer.',
        '- For Table, include sample data in props.dataSource and props.columns.',
        '- For Statistic, include props.title and props.value.',
        '- For FormItem, include a label prop and exactly one input-like child when possible.',
        '- For Descriptions, include props.column and Descriptions.Item children with label props.',
        '- For Timeline, return Timeline.Item children with short text content.',
        '- Use realistic Chinese B-end copy such as 今日出勤率, 本周迟到人数, 最近考勤记录, 审批状态.',
        '- Keep braces and brackets balanced. Your answer must be parseable by JSON.parse without any cleanup.',
        '- Return JSON only. No markdown, no explanation, no code fences.',
        'Return exactly this JSON shape:',
        `{"component":"${supportedComponents.join('|')}","id":"string","props":{},"children":[]}`,
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Prompt: ${input.request.prompt}`,
        `Page Title: ${input.pageTitle ?? 'Untitled'}`,
        `Block Index: ${input.blockIndex ?? 0}`,
        `Placement: ${input.placementSummary ?? '默认纵向堆叠区域'}`,
        `Block Description: ${input.block.description}`,
        `Suggested Components: ${input.block.components.join(', ')}`,
        'Your response must start with { and end with }. No other text.',
      ].join('\n'),
    },
  ];
}

async function generateBlock(input: GenerateBlockInput, trace?: RunTraceRecord): Promise<GenerateBlockResult> {
  const client = createClient();
  const model = requireModel(input.request.blockModel ?? env.AI_BLOCK_MODEL, 'block');
  const text = await client.chat(model, createBlockMessages(input), getThinking(input.request));
  const rawNode = extractJson<GenerateBlockResult['node']>(text, 'block', input.request, model);
  const node = validateNode(rawNode, input.block.id);
  trace?.blocks.push({
    blockId: input.block.id,
    description: input.block.description,
    suggestedComponents: input.block.components,
    model,
    rawOutput: text,
    normalizedNode: node,
  });
  return {
    blockId: input.block.id,
    node,
    summary: `Generated ${input.block.description} via ${model}`,
  };
}

function buildSkeletonSchema(plan: PagePlan): PageSchema {
  const gap = plan.pageType === 'dashboard' || plan.pageType === 'statistics' ? 24 : 16;
  const layout = plan.layout ?? defaultLayoutFromBlocks(plan.blocks.map((block) => block.id));
  const headerBlockId = findHeaderBlockId(plan);
  const skeletonNodes = Object.fromEntries(
    plan.blocks.map((block) => [block.id, createSkeletonBlock(block.id, block.description)]),
  ) as Record<string, GenerateBlockResult['node']>;
  const assembledRows = assembleFromLayout(layout, skeletonNodes, gap);
  const contentRows = headerBlockId ? assembledRows.slice(1) : assembledRows;

  return {
    id: 'ai-generated-page',
    name: plan.pageTitle,
    body: [
      {
        id: 'page-root',
        component: 'Container',
        props: {
          direction: 'column',
          gap,
          style: {
            width: '100%',
            padding: 24,
            background: '#f5f7fa',
          },
        },
        children: [
          ...(headerBlockId
            ? [{
              id: 'page-header-shell',
              component: 'Container',
              props: {
                direction: 'column',
                gap: 10,
                style: {
                  padding: 20,
                  borderRadius: 16,
                  background: '#ffffff',
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
                },
              },
              children: [assembledRows[0]!],
            }]
            : []),
          {
            id: 'page-content-shell',
            component: 'Container',
            props: {
              direction: 'column',
              gap,
            },
            children: contentRows,
          },
        ],
      },
    ],
  };
}

async function assembleSchema(input: AssembleSchemaInput, trace?: RunTraceRecord): Promise<PageSchema> {
  const gap = input.plan.pageType === 'dashboard' || input.plan.pageType === 'statistics' ? 24 : 16;
  const layout = input.plan.layout ?? defaultLayoutFromBlocks(input.plan.blocks.map((block) => block.id));
  const headerBlockId = findHeaderBlockId(input.plan);
  const blockNodes = Object.fromEntries(input.blocks.map((block) => [block.blockId, block.node])) as Record<string, GenerateBlockResult['node']>;
  const assembledRows = assembleFromLayout(layout, blockNodes, gap);
  const contentRows = headerBlockId ? assembledRows.slice(1) : assembledRows;

  const schema: PageSchema = {
    id: 'ai-generated-page',
    name: input.plan.pageTitle,
    body: [
      {
        id: 'page-root',
        component: 'Container',
        props: {
          direction: 'column',
          gap,
          style: {
            width: '100%',
            padding: 24,
            background: '#f5f7fa',
          },
        },
        children: [
          ...(headerBlockId
            ? [{
              id: 'page-header-shell',
              component: 'Container',
              props: {
                direction: 'column',
                gap: 10,
                style: {
                  padding: 20,
                  borderRadius: 16,
                  background: '#ffffff',
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
                },
              },
              children: [assembledRows[0]!],
            }]
            : []),
          {
            id: 'page-content-shell',
            component: 'Container',
            props: {
              direction: 'column',
              gap,
            },
            children: contentRows,
          },
        ],
      },
    ],
  };
  if (trace) {
    trace.finalSchema = schema;
  }
  return schema;
}

async function planWithModel(input: PlanPageInput, trace?: RunTraceRecord): Promise<PagePlan> {
  const client = createClient();
  const model = requireModel(input.request.plannerModel ?? env.AI_PLANNER_MODEL, 'planner');
  const text = await client.chat(model, createPlannerMessages(input), getThinking(input.request));
  const plan = extractJson<PagePlan>(text, 'planner', input.request, model);
  const normalizedPlan = normalizePlan(plan);
  if (trace) {
    trace.planner = {
      model,
      rawOutput: text,
      normalizedPlan,
    };
  }
  return normalizedPlan;
}

function createRuntimeDeps(trace?: RunTraceRecord): AgentRuntimeDeps {
  return {
    llm: {
      async chat(request: unknown) {
        const client = createClient();
        const model = requireModel(getRequestedChatModel(request) ?? env.AI_PLANNER_MODEL ?? env.AI_BLOCK_MODEL, 'chat');
        const prompt = typeof request === 'object' && request && 'prompt' in request
          ? String((request as { prompt: unknown }).prompt)
          : 'No prompt';
        const thinking = getThinkingFromUnknown(request);
        const text = await client.chat(model, [
          { role: 'system', content: 'You are a helpful low-code assistant.' },
          { role: 'user', content: prompt },
        ], thinking);
        return { text };
      },
      async *streamChat(request: unknown) {
        const prompt = typeof request === 'object' && request && 'prompt' in request
          ? String((request as { prompt: unknown }).prompt)
          : 'No prompt';
        const client = createClient();
        const model = requireModel(getRequestedChatModel(request) ?? env.AI_PLANNER_MODEL ?? env.AI_BLOCK_MODEL, 'chat');
        const thinking = getThinkingFromUnknown(request);
        yield* client.streamChat(model, [
          { role: 'system', content: 'You are a helpful low-code assistant.' },
          { role: 'user', content: prompt },
        ], thinking);
      },
    },
    tools: createToolRegistry([
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
          return assembleSchema(input as AssembleSchemaInput, trace);
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

export const agentRuntime: AgentRuntime = {
  async run(request) {
    const trace = createTrace(request);
    try {
      const events = await runAgent(request, createRuntimeDeps(trace));
      const metadata = extractMetadata(events);
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
    const trace = createTrace(request);
    const generator = runAgentStream(request, createRuntimeDeps(trace));
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
};
