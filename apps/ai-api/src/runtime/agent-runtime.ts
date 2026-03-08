/**
 * Default runtime assembly — API Host 通过 @shenbi/ai-agents 产出真实事件流，
 * 底层直接调用真实 provider；provider/模型异常时明确抛错。
 */
import {
  createInMemoryAgentMemoryStore,
  createToolRegistry,
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
  type ZoneType,
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
  getZoneComponentCandidates,
  getZoneGoldenExample,
  getZoneGenerationParameters,
  getZoneTemplate,
  getZoneTemplateSummary,
  getPlannerZoneTemplateSummary,
  getComponentSchemaContracts,
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
const supportedZoneTypes = [
  'page-header',
  'filter',
  'kpi-row',
  'data-table',
  'detail-info',
  'form-body',
  'form-actions',
  'chart-area',
  'timeline-area',
  'side-info',
  'empty-state',
  'custom',
] as const;
const plannerContractSummary = getPlannerContractSummary();
const plannerZoneTemplateSummary = getPlannerZoneTemplateSummary();
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
    zoneType: ZoneType;
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

function orderBlocksBySkeleton(plan: PagePlan): PagePlan {
  const skeleton = getPageSkeleton(plan.pageType);
  const rank = new Map<ZoneType, number>();
  skeleton.recommendedZones.forEach((zone, index) => {
    rank.set(zone, index);
  });
  skeleton.optionalZones.forEach((zone, index) => {
    if (!rank.has(zone)) {
      rank.set(zone, skeleton.recommendedZones.length + index);
    }
  });

  return {
    ...plan,
    blocks: [...plan.blocks].sort((left, right) => {
      const leftRank = rank.get(left.type) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = rank.get(right.type) ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return left.priority - right.priority;
    }),
  };
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

function isSupportedZoneType(value: unknown): value is ZoneType {
  return typeof value === 'string' && supportedZoneTypes.includes(value as ZoneType);
}

/** Leaf zone types that should not coexist with a custom layout block covering the same content. */
const leafZoneTypes: ReadonlySet<ZoneType> = new Set<ZoneType>([
  'detail-info', 'data-table', 'timeline-area', 'chart-area', 'side-info',
  'kpi-row', 'filter', 'form-body', 'form-actions', 'empty-state',
]);

/**
 * Detect and resolve conflicts where the planner produced both a "custom" layout
 * block (containing Row/Col/Tabs — i.e. it already owns the full page layout)
 * AND separate leaf zones for the same content.
 *
 * Resolution: keep page-header + custom layout blocks, drop redundant leaf zones.
 */
function resolvePlanConflicts(blocks: PagePlan['blocks']): PagePlan['blocks'] {
  const customLayoutBlocks = blocks.filter((block) =>
    block.type === 'custom'
    && (block.components.includes('Row') || block.components.includes('Col') || block.components.includes('Tabs')),
  );

  if (customLayoutBlocks.length === 0) {
    return blocks;
  }

  const hasLeafZones = blocks.some((block) => leafZoneTypes.has(block.type));
  if (!hasLeafZones) {
    return blocks;
  }

  // Conflict detected: custom layout + leaf zones coexist.
  // Keep page-header and custom, drop leaf zones.
  logger.warn('ai.plan.conflict_resolved', {
    customBlocks: customLayoutBlocks.map((b) => b.id),
    droppedLeafZones: blocks.filter((b) => leafZoneTypes.has(b.type)).map((b) => `${b.id}(${b.type})`),
  });

  return blocks.filter((block) =>
    block.type === 'page-header' || block.type === 'custom',
  );
}

function normalizePlan(plan: PagePlan): PagePlan {
  if (!plan.pageTitle || !Array.isArray(plan.blocks) || plan.blocks.length === 0) {
    throw new LLMError('Planner returned an empty page plan', 'EMPTY_PAGE_PLAN');
  }
  if (!isSupportedPageType(plan.pageType)) {
    throw new LLMError(`Planner returned unsupported pageType: ${String(plan.pageType)}`, 'UNSUPPORTED_PAGE_TYPE');
  }

  const seenBlockIds = new Map<string, number>();
  const normalizedBlocks: PagePlan['blocks'] = plan.blocks.map((block, index) => {
    if (!isSupportedZoneType(block.type)) {
      throw new LLMError(`Planner returned unsupported zone type: ${String(block.type)}`, 'UNSUPPORTED_ZONE_TYPE');
    }

    const components = Array.isArray(block.components) ? block.components.filter(isSupportedComponent) : [];
    if (components.length === 0) {
      throw new LLMError(`Planner returned no supported components for block: ${block.id || `block-${index + 1}`}`, 'UNSUPPORTED_BLOCK_COMPONENTS');
    }

    const rawId = String(block.id || `block-${index + 1}`);
    const safeBaseId = rawId
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || `block-${index + 1}`;
    const nextCount = (seenBlockIds.get(safeBaseId) ?? 0) + 1;
    seenBlockIds.set(safeBaseId, nextCount);

    const complexity: PagePlan['blocks'][number]['complexity'] =
      block.complexity === 'medium' || block.complexity === 'complex'
        ? block.complexity
        : 'simple';

    return {
      ...block,
      id: nextCount === 1 ? safeBaseId : `${safeBaseId}-${nextCount}`,
      type: block.type,
      components,
      priority: Number.isFinite(block.priority) ? block.priority : index + 1,
      complexity,
    };
  });

  const dedupedBlocks = resolvePlanConflicts(normalizedBlocks);

  return orderBlocksBySkeleton({
    ...plan,
    blocks: dedupedBlocks,
  });
}

function validateNode(node: GenerateBlockResult['node']): GenerateBlockResult['node'] {
  return normalizeGeneratedNode(node);
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
  return [
    {
      role: 'system',
      content: [
        'You are a low-code page planner.',
        'Only output valid JSON.',
        `Use only these supported components when planning: ${supportedComponentList}.`,
        `Use only these page types: ${supportedPageTypes.join(', ')}.`,
        `Use only these zone types: ${supportedZoneTypes.join(', ')}.`,
        'Available component groups and contract summaries:',
        plannerContractSummary,
        'Design policy:',
        designPolicySummary,
        'Zone templates:',
        plannerZoneTemplateSummary,
        'Reference page skeleton for this request:',
        suggestedSkeletonSummary,
        'Free-layout patterns you may borrow from when they improve clarity:',
        freeLayoutPatternSummary,
        'Hard rules:',
        '- pageTitle must be a concise human-readable title.',
        '- pageType must be exactly one of: dashboard, list, form, detail, statistics, custom.',
        '- blocks must be a non-empty array.',
        '- block.id is a semantic identifier and may contain business meaning such as alert-summary, recent-records, attendance-table.',
        '- block.type is a zone type, not a component name.',
        '- block.type must be exactly one of: page-header, filter, kpi-row, data-table, detail-info, form-body, form-actions, chart-area, timeline-area, side-info, empty-state, custom.',
        '- block.components must be a non-empty array.',
        `- Every item in block.components must be chosen from: ${supportedComponentList}.`,
        '- If the page is a dashboard, use pageType "dashboard" and prefer zones page-header, kpi-row, chart-area, data-table, timeline-area.',
        '- If the page is a list page, use pageType "list" and prefer zones page-header, filter, data-table.',
        '- If the page is a form page, use pageType "form" and prefer zones page-header, form-body, form-actions, side-info.',
        '- If the page is a detail page, use pageType "detail" and prefer zones page-header, detail-info, data-table or timeline-area.',
        '- If the page is a statistics page, use pageType "statistics" and prefer zones page-header, kpi-row, chart-area, data-table.',
        '- For page-header, use layout-shell + typography + actions groups.',
        '- For filter, use data-display + filters-form + layout-shell + actions groups.',
        '- For kpi-row, use layout-shell + data-display + feedback-status groups.',
        '- For data-table, use data-display + actions + feedback-status groups.',
        '- For detail-info, use data-display + typography + feedback-status groups.',
        '- For form-body, use data-display + filters-form groups.',
        '- For form-actions, use layout-shell + actions groups.',
        '- For timeline-area, use data-display + typography groups.',
        '- For chart-area, if no chart component is available, use data-display + typography + feedback-status groups.',
        '- Never put semantic aliases like hero, recent-records, summary-panel, alert-summary, dashboard-header, banner, widget into type or components.',
        '- Business meaning belongs only in id and description.',
        '- If unsure, choose Card with components ["Card"].',
        `- For this request, prefer pageType "${suggestedPageType}" unless the user clearly asks for a custom mixed layout.`,
        '- IMPORTANT: If you include a "custom" layout block that already provides the full page layout (e.g. left-right split with Row/Col), do NOT also include leaf zones like detail-info, data-table, timeline-area for the same content. Either plan ONE custom layout block that contains everything, OR plan individual leaf zones that the assembler will stack vertically — never both.',
        '- CRITICAL: When the user describes spatial/positional layout (e.g. 左/右, 上/下, 左上/左下/右侧, 双栏, 三栏, 左边...右边...), you MUST use a SINGLE block with type "custom" containing ALL described areas. Do NOT split spatially-related areas into separate blocks (kpi-row, data-table, timeline-area) — that destroys the intended layout by stacking them vertically. The custom block generator will use Row/Col to implement the spatial arrangement.',
        '- Only use separate leaf zones (kpi-row, data-table, etc.) when the user does NOT describe spatial positioning and content should simply flow top-to-bottom.',
        '- Favor clean B2B admin layouts: clear page title, concise helper text, grouped filters, summary cards, primary data area, moderate whitespace.',
        '- Page skeletons and zone templates are references, not prison rules. You may adapt order or composition when it improves clarity and aesthetics.',
        '- Use free-layout patterns when they create a stronger composition, especially for custom or mixed business pages.',
        '- Return JSON only. No markdown, no explanation, no code fences.',
        'Valid example 1:',
        '{"pageTitle":"考勤首页","pageType":"dashboard","blocks":[{"id":"header","type":"page-header","description":"页面标题、描述和主要操作","components":["Container","Typography.Title","Typography.Text","Space","Button"],"priority":1,"complexity":"simple"},{"id":"attendance-kpis","type":"kpi-row","description":"展示今日出勤、迟到、请假等关键指标","components":["Row","Col","Card","Statistic","Tag"],"priority":2,"complexity":"simple"},{"id":"attendance-table","type":"data-table","description":"展示最近考勤记录","components":["Card","Table","Tag"],"priority":3,"complexity":"medium"}]}',
        'Valid example 2:',
        '{"pageTitle":"用户列表","pageType":"list","blocks":[{"id":"header","type":"page-header","description":"页面标题、统计和新建按钮","components":["Container","Typography.Title","Typography.Text","Button"],"priority":1,"complexity":"simple"},{"id":"filters","type":"filter","description":"搜索、角色筛选和日期筛选","components":["Card","Form","FormItem","Input","Select","DatePicker","Space","Button"],"priority":2,"complexity":"medium"},{"id":"recent-records","type":"data-table","description":"展示最近用户数据和状态标签","components":["Card","Table","Tag","Button"],"priority":3,"complexity":"medium"}]}',
        'Invalid example:',
        '{"pageTitle":"考勤首页","pageType":"dashboard","blocks":[{"id":"recent-records","type":"recent-records","description":"...","components":["recent-records"],"priority":1,"complexity":"simple"}]}',
        'Return exactly this JSON shape:',
        '{"pageTitle":"string","pageType":"dashboard|list|form|detail|statistics|custom","blocks":[{"id":"string","type":"page-header|filter|kpi-row|data-table|detail-info|form-body|form-actions|chart-area|timeline-area|side-info|empty-state|custom","description":"string","components":["Card"],"priority":1,"complexity":"simple"}]}',
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
  const zoneCandidates = getZoneComponentCandidates(input.block.type);
  const componentSchemaContracts = getComponentSchemaContracts(input.block.components);
  const zoneGenerationParameters = getZoneGenerationParameters(input.block.type);
  const zoneGoldenExample = getZoneGoldenExample(input.block.type);
  const zoneTemplateSummary = getZoneTemplateSummary(input.block.type);
  const freeLayoutPatternSummary = getFreeLayoutPatternSummary(classifyPromptToPageType(input.request.prompt));
  return [
    {
      role: 'system',
      content: [
        'You generate one low-code block as valid JSON.',
        `Only use supported components: ${supportedComponentList}.`,
        `For this zone, prioritize these candidate components: ${zoneCandidates.join(', ')}.`,
        'Zone template:',
        zoneTemplateSummary,
        'Zone generation parameters:',
        zoneGenerationParameters,
        'Design policy:',
        designPolicySummary,
        'Component schema contracts (MUST follow these exact structures):',
        componentSchemaContracts,
        'Valid zone example:',
        zoneGoldenExample,
        'Free-layout composition references:',
        freeLayoutPatternSummary,
        'Rules:',
        '- The root node component must be one of the supported components.',
        '- Every child schema node must also use only supported components.',
        '- children may contain schema nodes or plain text only.',
        '- Use the zone template skeleton as a starting point, but adapt composition when a cleaner free layout improves readability.',
        '- Stay within the declared maxDepth and maxChildrenPerArray.',
        '- Build polished B2B admin blocks with clear hierarchy, balanced spacing, and concise business copy.',
        '- Prefer layout primitives such as Row, Col, Space, Flex, and Divider to create rhythm, spacing, and asymmetric but balanced compositions.',
        '- page-header zones should usually use layout-shell + typography + actions components.',
        '- filter zones should usually use Card containing Form, FormItem, Input, Select, DatePicker, Space, and Button.',
        '- kpi-row zones should usually use Row + Col + Card + Statistic + Tag. Four concise KPI cards are better than one oversized block.',
        '- data-table zones should use Card wrapping Table and optional action buttons or tags.',
        '- detail-info zones should prefer Card + Descriptions + Descriptions.Item + Tag.',
        '- form-body zones should prefer Card + Form + FormItem + Input/Select/DatePicker.',
        '- form-actions zones should prefer Space and Button.',
        '- timeline-area zones should prefer Card + Timeline + Timeline.Item.',
        '- chart-area zones should prefer Card with Typography.Title, Typography.Paragraph, Statistic, Tag or supporting summary content when no chart component exists.',
        '- side-info zones should prefer Card + Typography.Text or Descriptions.',
        '- A non-custom zone must generate only its own zone content, not a full page layout.',
        '- For detail-info, data-table, timeline-area, filter, side-info, and chart-area, do not return a top-level Row/Col page layout, Tabs container, page header, or repeated copies of other zones.',
        '- If the zone is data-table, return table-focused content only. Do not include basic info, contact info, approval timeline, or page-level split layouts.',
        '- If the zone is timeline-area, return timeline-focused content only. Do not include tables, descriptions, or page-level split layouts.',
        '- If the zone is detail-info, return detail-focused content only. Do not include tabs, tables, timelines, or page-level split layouts.',
        '- Only custom zones may own a full mixed layout such as left/right split content.',
        '- Never use raw HTML tags like div, span, section, header, footer. Use Container instead of div/section/header/footer.',
        '- When a Col has multiple children stacked vertically, wrap them in a Container with direction="column" and gap=16 for proper spacing.',
        '- For Table, include sample data in props.dataSource and props.columns.',
        '- For Statistic, include props.title and props.value.',
        '- For FormItem, include a label prop and exactly one input-like child when possible.',
        '- For Descriptions, include props.column and Descriptions.Item children with label props.',
        '- For Timeline, return Timeline.Item children with short text content.',
        '- Use realistic Chinese B-end copy such as 今日出勤率, 本周迟到人数, 最近考勤记录, 审批状态.',
        '- For custom, dashboard, or detail prompts, prefer stronger composition patterns like main-content-plus-side-info, summary-then-detail, or split-context-and-data when appropriate.',
        '- Keep braces and brackets balanced. Your answer must be parseable by JSON.parse without any cleanup.',
        '- Return JSON only. No markdown, no explanation, no code fences.',
        'Return exactly this JSON shape:',
        `{"component":"${supportedComponents.join('|')}","id":"string","props":{},"children":[]}`,
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        // Custom zones need the full prompt to understand whole-page layout intent.
        // Non-custom zones only see their own scoped description to prevent
        // the model from re-generating full-page layouts triggered by keywords
        // like "双栏", "左边...右边..." in the original prompt.
        // But include the page title for context so headers aren't generic.
        input.block.type === 'custom'
          ? `Prompt: ${input.request.prompt}`
          : `Prompt: Generate the "${input.block.description}" section for a page titled "${input.pageTitle ?? 'Untitled'}".`,
        `Block Type: ${input.block.type}`,
        `Block Description: ${input.block.description}`,
        `Suggested Components: ${input.block.components.join(', ')}`,
        'Your response must start with { and end with }. No other text.',
      ].join('\n'),
    },
  ];
}

/**
 * Zone types that accept Row as a legitimate root.
 * kpi-row genuinely needs Row>Col layout; custom zones may have any layout;
 * form-actions is too small to need checking.
 */
const rowAllowedZones: ReadonlySet<ZoneType> = new Set<ZoneType>(['custom', 'kpi-row', 'form-actions']);

/**
 * Components that each non-custom zone "wants" — the first match in a deep tree
 * is extracted when the block generator violated its zone ownership.
 */
const zoneSignatureComponents: Partial<Record<ZoneType, ReadonlySet<string>>> = {
  'data-table': new Set(['Table']),
  'timeline-area': new Set(['Timeline']),
  'detail-info': new Set(['Descriptions']),
  'chart-area': new Set(['Statistic']),
  filter: new Set(['Form']),
  'side-info': new Set(['Descriptions', 'Typography.Text']),
};

interface SchemaNodeLike {
  component: string;
  id?: string;
  props?: Record<string, unknown>;
  children?: unknown;
  columns?: unknown;
  [key: string]: unknown;
}

function isSchemaNodeLike(value: unknown): value is SchemaNodeLike {
  return Boolean(value) && typeof value === 'object' && 'component' in (value as Record<string, unknown>);
}

/**
 * Walk a node tree depth-first and return the first Card/Container that contains
 * a signature component matching the target zone type.
 */
function findZoneSubtree(
  node: SchemaNodeLike,
  signatureComponents: ReadonlySet<string>,
): SchemaNodeLike | null {
  // If the node itself IS a signature component, return its parent wrapper.
  // But we need the Card wrapper — check children first.
  const children = Array.isArray(node.children) ? node.children.filter(isSchemaNodeLike) : [];

  // Check if any immediate child is a signature component
  if (children.some((child) => signatureComponents.has(child.component))) {
    return node;
  }

  // Recurse into children
  for (const child of children) {
    const found = findZoneSubtree(child, signatureComponents);
    if (found) {
      return found;
    }
  }
  return null;
}

/**
 * Enforce zone ownership on a block's generated output.
 *
 * If a non-custom zone generated a top-level Row/Col page layout (violation),
 * attempt to extract the subtree that actually matches this zone's purpose.
 * Falls back to the original node if extraction fails.
 */
function validateBlockOutput(
  node: SchemaNodeLike,
  zoneType: ZoneType,
  blockId: string,
): SchemaNodeLike {
  // Custom zones and zones that legitimately use Row are exempt.
  if (rowAllowedZones.has(zoneType)) {
    return node;
  }

  // Detect violation: top-level Row with multiple Col children.
  const isTopLevelRowLayout =
    node.component === 'Row'
    && Array.isArray(node.children)
    && node.children.filter(isSchemaNodeLike).filter((c) => c.component === 'Col').length > 1;

  // Detect violation: top-level Tabs in a non-custom zone.
  const isTopLevelTabs = node.component === 'Tabs';

  if (!isTopLevelRowLayout && !isTopLevelTabs) {
    return node;
  }

  // Zone boundary violated. Try to extract the matching subtree.
  const signature = zoneSignatureComponents[zoneType];
  if (signature) {
    const subtree = findZoneSubtree(node, signature);
    if (subtree && subtree !== node) {
      logger.warn('ai.block.zone_violation_corrected', {
        blockId,
        zoneType,
        originalRoot: node.component,
        extractedRoot: subtree.component,
      });
      return subtree;
    }
  }

  // Fallback: if the row layout has Col children, try to return the first Col's
  // children as a Container — this at least removes the split-layout.
  if (isTopLevelRowLayout && Array.isArray(node.children)) {
    const cols = node.children.filter(isSchemaNodeLike).filter((c) => c.component === 'Col');
    if (cols.length > 0) {
      const firstCol = cols[0]!;
      const colChildren = Array.isArray(firstCol.children)
        ? firstCol.children.filter(isSchemaNodeLike)
        : [];
      if (colChildren.length === 1) {
        logger.warn('ai.block.zone_violation_fallback', {
          blockId,
          zoneType,
          fallback: 'first_col_single_child',
        });
        return colChildren[0]!;
      }
      if (colChildren.length > 1) {
        logger.warn('ai.block.zone_violation_fallback', {
          blockId,
          zoneType,
          fallback: 'first_col_container',
        });
        return {
          component: 'Container',
          id: `${blockId}-corrected`,
          props: { direction: 'column', gap: 16 },
          children: colChildren,
        };
      }
    }
  }

  // No extraction possible — keep original and log warning.
  logger.warn('ai.block.zone_violation_unresolved', {
    blockId,
    zoneType,
    rootComponent: node.component,
  });
  return node;
}

async function generateBlock(input: GenerateBlockInput, trace?: RunTraceRecord): Promise<GenerateBlockResult> {
  const client = createClient();
  const model = requireModel(input.request.blockModel ?? env.AI_BLOCK_MODEL, 'block');
  const text = await client.chat(model, createBlockMessages(input), getThinking(input.request));
  const rawNode = extractJson<GenerateBlockResult['node']>(text, 'block', input.request, model);
  const correctedNode = validateBlockOutput(rawNode, input.block.type, input.block.id);
  const node = validateNode(correctedNode as GenerateBlockResult['node']);
  trace?.blocks.push({
    blockId: input.block.id,
    zoneType: input.block.type,
    description: input.block.description,
    suggestedComponents: input.block.components,
    model,
    rawOutput: text,
    normalizedNode: node,
  });
  return {
    blockId: input.block.id,
    node,
    summary: `Generated ${input.block.type} via ${model}`,
  };
}

async function assembleSchema(input: AssembleSchemaInput, trace?: RunTraceRecord): Promise<PageSchema> {
  const headerBlock = input.blocks.find((block) => block.blockId === 'header' || input.plan.blocks.find((planBlock) => planBlock.id === block.blockId)?.type === 'page-header');
  const contentBlocks = input.blocks.filter((block) => block !== headerBlock);

  const contentGap = input.plan.pageType === 'dashboard' || input.plan.pageType === 'statistics' ? 24 : 16;

  const contentChildren = contentBlocks.map((block) => {
    const blockPlan = input.plan.blocks.find((planBlock) => planBlock.id === block.blockId);
    const zoneType = blockPlan?.type ?? 'custom';
    const zoneTemplate = getZoneTemplate(zoneType);
    const wrapperTitle = zoneTemplate.wrapper?.useDescriptionAsTitle ? blockPlan?.description : undefined;

    if (zoneType === 'kpi-row') {
      return {
        id: `${block.blockId}-section`,
        component: 'Row',
        props: {
          gutter: [16, 16],
        },
        children: [
          {
            id: `${block.blockId}-col`,
            component: 'Col',
            props: {
              span: 24,
            },
            children: [block.node],
          },
        ],
      };
    }

    if (zoneTemplate.wrapper && zoneType === 'filter') {
      return {
        id: `${block.blockId}-section`,
        component: zoneTemplate.wrapper.component,
        props: {
          ...(zoneTemplate.wrapper.props ?? {}),
          ...(wrapperTitle ? { title: wrapperTitle } : {}),
        },
        children: [block.node],
      };
    }

    if (zoneTemplate.wrapper && (
      zoneType === 'data-table'
      || zoneType === 'detail-info'
      || zoneType === 'form-body'
      || zoneType === 'timeline-area'
      || zoneType === 'chart-area'
      || zoneType === 'side-info'
      || zoneType === 'empty-state'
    )) {
      return {
        id: `${block.blockId}-section`,
        component: zoneTemplate.wrapper.component,
        props: {
          ...(zoneTemplate.wrapper.props ?? {}),
          ...(wrapperTitle ? { title: wrapperTitle } : {}),
        },
        children: [block.node],
      };
    }

    return block.node;
  });

  const schema: PageSchema = {
    id: 'ai-generated-page',
    name: input.plan.pageTitle,
    body: [
      {
        id: 'page-root',
        component: 'Container',
        props: {
          direction: 'column',
          gap: contentGap,
          style: {
            width: '100%',
            padding: 24,
            background: '#f5f7fa',
          },
        },
        children: [
          ...(headerBlock
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
              children: [headerBlock.node],
            }]
            : []),
          {
            id: 'page-content-shell',
            component: 'Container',
            props: {
              direction: 'column',
              gap: contentGap,
            },
            children: contentChildren,
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
