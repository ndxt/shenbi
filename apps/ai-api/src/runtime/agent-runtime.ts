/**
 * Default runtime assembly — API Host 通过 @shenbi/ai-agents 产出真实事件流，
 * 底层直接调用真实 provider；provider/模型异常时明确抛错。
 */
import {
  createInMemoryAgentMemoryStore,
  createToolRegistry,
  type AgentMemoryMessage,
  type AgentMemoryStore,
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
import type { AgentEvent } from '@shenbi/ai-contracts';
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
import {
  getDesignPolicySummary,
  getFreeLayoutPatternSummary,
  getPageSkeleton,
  getPageSkeletonSummary,
  getPlannerContractSummary,
  expandComponents,
  getFullComponentContracts,
} from './component-catalog.ts';
import { executeModifySchema, type ModifySchemaTraceEntry } from './modify-schema.ts';
import type { AgentRuntime } from './types.ts';

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

export interface BlockQualityDiagnostic {
  blockId: string;
  rule: string;
  message: string;
  severity: 'warn' | 'retry';
  componentType?: string;
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

function walkSchemaNodes(
  value: unknown,
  visitor: (node: SchemaNode) => void,
): void {
  if (!value) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      walkSchemaNodes(item, visitor);
    }
    return;
  }
  if (typeof value === 'string') {
    return;
  }
  if (!isNodeLike(value)) {
    return;
  }
  visitor(value);
  walkSchemaNodes(value.children, visitor);
}

function getNodeText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return value.map((item) => getNodeText(item)).filter(Boolean).join(' ').trim();
  }
  if (isNodeLike(value)) {
    return getNodeText(value.children);
  }
  return '';
}

function nodeHasComponent(node: SchemaNode, componentType: string): boolean {
  let found = false;
  walkSchemaNodes(node, (current) => {
    if (current.component === componentType) {
      found = true;
    }
  });
  return found;
}

function getChildNodes(value: unknown): SchemaNode[] {
  return Array.isArray(value)
    ? value.filter(isNodeLike)
    : [];
}

function countDescendantComponents(value: unknown, componentType: string): number {
  let count = 0;
  walkSchemaNodes(value, (node) => {
    if (node.component === componentType) {
      count += 1;
    }
  });
  return count;
}

function isKpiBlock(input: Pick<GenerateBlockInput, 'block'>): boolean {
  return input.block.id.includes('kpi')
    || /指标|kpi|概览|summary/.test(input.block.description)
    || input.block.components.some((component) => ['Statistic', 'Progress', 'Tag'].includes(component));
}

function isFilterBlock(input: Pick<GenerateBlockInput, 'block'>): boolean {
  return input.block.id.includes('filter')
    || /筛选|查询|搜索/.test(input.block.description)
    || input.block.components.some((component) => component.startsWith('Form') || component.includes('DatePicker'));
}

function isAdvancedFilterBlock(input: Pick<GenerateBlockInput, 'block'>): boolean {
  return /高级筛选|高级查询|高级搜索|折叠筛选|折叠查询|更多条件|多条件|advanced/i.test(input.block.description);
}

function isMasterListBlock(input: Pick<GenerateBlockInput, 'block'>): boolean {
  return input.block.id.includes('master')
    || /左侧主数据列表|主从|主列表|主数据列表|左侧树|左侧列表|选中状态/.test(input.block.description);
}

function isMasterDetailPrompt(prompt: string): boolean {
  return (/主从|master[-\s]?detail/i.test(prompt) || /左侧.*(树|列表)|右侧.*tabs?/i.test(prompt))
    && /详情|tabs?|树|列表/i.test(prompt);
}

function isTabsOrTrendBlock(input: Pick<GenerateBlockInput, 'block'>): boolean {
  return input.block.components.includes('Tabs')
    || /趋势|tab|tabs/.test(input.block.description.toLowerCase())
    || input.block.id.includes('tab');
}

function isActionFocusedBlock(input: Pick<GenerateBlockInput, 'block'>): boolean {
  return input.block.id.includes('header')
    || input.block.id.includes('action')
    || /操作|按钮|快捷入口|快捷操作|主操作/.test(input.block.description);
}

function getKpiCardKind(card: SchemaNode): string {
  const childNodes = Array.isArray(card.children)
    ? card.children.filter(isNodeLike)
    : [];
  const hasStatistic = childNodes.some((child) => child.component === 'Statistic');
  const hasProgress = childNodes.some((child) => child.component === 'Progress');
  const hasTag = nodeHasComponent(card, 'Tag');
  const hasText = nodeHasComponent(card, 'Typography.Text');
  if (hasTag && !hasStatistic && !hasProgress && !hasText) {
    return 'tag-only';
  }
  if (hasProgress && !hasStatistic) {
    return 'progress';
  }
  if (hasStatistic && !hasProgress && !hasTag) {
    return 'statistic';
  }
  return 'mixed';
}

export function assessBlockQuality(
  node: GenerateBlockResult['node'],
  input: Pick<GenerateBlockInput, 'block'>,
): BlockQualityDiagnostic[] {
  const diagnostics: BlockQualityDiagnostic[] = [];

  walkSchemaNodes(node, (current) => {
    if (current.component === 'Alert') {
      const message = getNodeText(current.props?.message);
      const description = getNodeText(current.props?.description);
      if (!message && !description) {
        diagnostics.push({
          blockId: input.block.id,
          componentType: 'Alert',
          rule: 'alert-missing-copy',
          message: 'Alert must provide message or description; empty alerts create a blank highlighted box.',
          severity: 'retry',
        });
      }
      return;
    }

    if (current.component === 'Button') {
      const text = getNodeText(current.children);
      if (!text) {
        diagnostics.push({
          blockId: input.block.id,
          componentType: 'Button',
          rule: 'button-missing-text',
          message: isFilterBlock(input) || isActionFocusedBlock(input)
            ? 'Buttons in filter or action regions must include visible text in top-level children.'
            : 'Button has no visible text. Use top-level children for the label unless this is an intentional icon-only button.',
          severity: isFilterBlock(input) || isActionFocusedBlock(input) ? 'retry' : 'warn',
        });
      }
    }
  });

  if (isFilterBlock(input)) {
    walkSchemaNodes(node, (current) => {
      if (current.component !== 'Form') {
        return;
      }
      const children = Array.isArray(current.children)
        ? current.children.filter(isNodeLike)
        : [];
      const formItems = children.filter((child) => child.component === 'Form.Item');
      const inlineLayout = current.props?.layout === 'inline';
      const hasRangePicker = nodeHasComponent(current, 'DatePicker.RangePicker');
      if (inlineLayout && (formItems.length > 3 || hasRangePicker)) {
        diagnostics.push({
          blockId: input.block.id,
          componentType: 'Form',
          rule: 'filter-inline-overflow',
          message: 'Filter blocks with RangePicker or more than 3 fields should use a Row/Col-based horizontal search bar or a controlled second row, not a single cramped inline row.',
          severity: 'retry',
        });
      }
      if (formItems.some((item) => !getNodeText(item.props?.label))) {
        diagnostics.push({
          blockId: input.block.id,
          componentType: 'Form.Item',
          rule: 'filter-actions-mixed-with-fields',
          message: 'Filter action buttons should be separated into a tail action area instead of an empty-label Form.Item.',
          severity: 'retry',
        });
      }
      if (!isAdvancedFilterBlock(input) && current.props?.layout === 'vertical') {
        const directChildren = getChildNodes(current.children);
        const directRows = directChildren.filter((child) => child.component === 'Row');
        const rowColumns = directRows.flatMap((row) =>
          getChildNodes(row.children).filter((child) => child.component === 'Col'));
        const totalFormItems = countDescendantComponents(current.children, 'Form.Item');
        const directFieldCount = directChildren.filter((child) => child.component === 'Form.Item').length;
        const fieldColumns = rowColumns.filter((column) => countDescendantComponents(column.children, 'Form.Item') > 0);
        const actionColumns = rowColumns.filter((column) =>
          countDescendantComponents(column.children, 'Button') > 0
          && countDescendantComponents(column.children, 'Form.Item') === 0);
        const stackedFieldColumn = fieldColumns.some((column) =>
          countDescendantComponents(column.children, 'Form.Item') >= 2);
        const separateActionArea = actionColumns.length > 0
          || directChildren.some((child) =>
            child.component === 'Container'
            && countDescendantComponents(child.children, 'Button') > 0
            && countDescendantComponents(child.children, 'Form.Item') === 0);
        if (
          totalFormItems >= 2
          && totalFormItems <= 3
          && separateActionArea
          && (stackedFieldColumn || directFieldCount >= 2)
        ) {
          diagnostics.push({
            blockId: input.block.id,
            componentType: 'Form',
            rule: 'filter-vertical-stacked-layout',
            message: 'Dashboard/list filters with 2-3 fields should stay in one horizontal search bar. Keep fields and action buttons in the same row, and use a wider date column instead of a left stacked field column.',
            severity: 'retry',
          });
        }
      }
    });
  }

  if (isKpiBlock(input)) {
    walkSchemaNodes(node, (current) => {
      if (current.component !== 'Row') {
        return;
      }
      const columns = Array.isArray(current.children)
        ? current.children.filter((child): child is SchemaNode => isNodeLike(child) && child.component === 'Col')
        : [];
      if (columns.length > 4) {
        diagnostics.push({
          blockId: input.block.id,
          componentType: 'Row',
          rule: 'kpi-too-many-cards',
          message: 'A KPI row should contain at most 4 cards to preserve even rhythm and visual weight.',
          severity: 'retry',
        });
      }
      const kinds = new Set<string>();
      for (const column of columns) {
        const card = Array.isArray(column.children)
          ? column.children.find((child): child is SchemaNode => isNodeLike(child) && child.component === 'Card')
          : undefined;
        if (!card) {
          continue;
        }
        kinds.add(getKpiCardKind(card));
      }
      if (kinds.has('tag-only')) {
        diagnostics.push({
          blockId: input.block.id,
          componentType: 'Card',
          rule: 'kpi-tag-only-card',
          message: 'A KPI card should not be tag-only; it must include a main value and one secondary line.',
          severity: 'retry',
        });
      }
      if (kinds.size > 1) {
        diagnostics.push({
          blockId: input.block.id,
          componentType: 'Row',
          rule: 'kpi-mixed-card-structures',
          message: 'KPI cards in one row should share a consistent structure instead of mixing progress-only, text-heavy, and mixed-detail cards.',
          severity: 'retry',
        });
      }
    });
  }

  if (isTabsOrTrendBlock(input)) {
    walkSchemaNodes(node, (current) => {
      if (current.component !== 'Tabs.TabPane') {
        return;
      }
      let alertCount = 0;
      let cardCount = 0;
      walkSchemaNodes(current.children, (child) => {
        if (child.component === 'Alert') {
          alertCount += 1;
        }
        if (child.component === 'Card') {
          cardCount += 1;
        }
      });
      if (alertCount > 1 || cardCount > 4) {
        diagnostics.push({
          blockId: input.block.id,
          componentType: 'Tabs.TabPane',
          rule: 'tab-pane-fragmented-layout',
          message: 'Each tab pane should stay focused: one alert, one short description, and one main data area instead of many tiny cards.',
          severity: 'retry',
        });
      }
    });
  }

  if (isMasterListBlock(input)) {
    let multilineButtonCardCount = 0;
    let overdenseItemFound = false;
    walkSchemaNodes(node, (current) => {
      if (current.component !== 'Button' || current.props?.type !== 'text' || current.props?.block !== true) {
        return;
      }
      const tagCount = countDescendantComponents(current.children, 'Tag');
      const typographyCount = countDescendantComponents(current.children, 'Typography.Text');
      const nestedTextLength = getNodeText(current.children).length;
      if (tagCount > 0 && typographyCount >= 2) {
        multilineButtonCardCount += 1;
      }
      if (tagCount >= 2 || nestedTextLength > 32) {
        overdenseItemFound = true;
      }
    });
    if (multilineButtonCardCount > 0) {
      diagnostics.push({
        blockId: input.block.id,
        componentType: 'Button',
        rule: 'master-list-button-card-layout',
        message: 'Left-side master lists should not use Button type="text" as a multi-line card wrapper. Use compact Container/Card list items with one title line, one status line, and one short description.',
        severity: 'retry',
      });
    }
    if (overdenseItemFound) {
      diagnostics.push({
        blockId: input.block.id,
        componentType: 'Container',
        rule: 'side-list-overdense',
        message: 'Items in a narrow master list column are too dense. Keep each item compact: short title, one meta line, and one short truncated description.',
        severity: 'retry',
      });
    }
  }

  return diagnostics;
}

function qualityScore(diagnostics: BlockQualityDiagnostic[]): number {
  return diagnostics.reduce((score, item) => score + (item.severity === 'retry' ? 2 : 1), 0);
}

function shouldUseRetryResult(
  currentDiagnostics: BlockQualityDiagnostic[],
  retryDiagnostics: BlockQualityDiagnostic[],
): boolean {
  return qualityScore(retryDiagnostics) < qualityScore(currentDiagnostics);
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
        '- If the prompt explicitly mentions drawer/抽屉 and Drawer is supported, include a dedicated Drawer block instead of replacing it with a generic side-info card.',
        '- If the prompt mentions chart/趋势图 but no real chart component exists in the supported set, plan a dedicated trend-summary block using Card/Statistic/Typography instead of inventing an unsupported chart component.',
        `- For this request, prefer pageType "${suggestedPageType}" unless the user clearly asks for a custom mixed layout.`,
        '- Favor clean B2B admin layouts: clear page title, concise helper text, grouped filters, summary cards, primary data area, moderate whitespace.',
        '- Prompts describing master-detail, left tree/list + right detail Tabs, or 主从详情 should use a detail-oriented or custom split layout, not a generic list page.',
        '- For master-detail pages, prefer a 7/17 or 8/16 split. The left block should be a compact master navigation/list panel; the right block should hold detail tabs/body.',
        '- For dashboard pages, prefer this rhythm: header full-width -> filter full-width -> KPI full-width -> main-content + side-info.',
        '- Dashboard filters should not be squeezed into one inline row when they include a RangePicker or more than 3 fields.',
        '- Dashboard KPI rows should contain at most 4 cards and should avoid mixing unrelated card structures in the same row.',
        '- Put primary actions near the title first. Add a side quick-action card only when the prompt clearly requires a separate side region.',
        '- Use free-layout patterns when they create a stronger composition, especially for custom or mixed business pages.',
        '- Return JSON only. No markdown, no explanation, no code fences.',
        'Valid example 1:',
        '{"pageTitle":"经营工作台","pageType":"dashboard","layout":[{"blocks":["header-block"]},{"blocks":["filter-block"]},{"blocks":["kpi-block"]},{"columns":[{"span":18,"blocks":["trend-tabs-block","records-block"]},{"span":6,"blocks":["side-info-block"]}]}],"blocks":[{"id":"header-block","description":"页面标题、说明和顶部主操作","components":["Typography.Title","Typography.Text","Button","Breadcrumb"],"priority":1,"complexity":"simple"},{"id":"filter-block","description":"全宽筛选查询区，包含日期范围、状态和关键词","components":["Form","Form.Item","DatePicker.RangePicker","Select","Input","Button"],"priority":2,"complexity":"medium"},{"id":"kpi-block","description":"核心业务指标卡片，单行 3 到 4 张统一结构的指标卡","components":["Row","Col","Card","Statistic","Typography.Text"],"priority":3,"complexity":"medium"},{"id":"trend-tabs-block","description":"趋势分析 Tabs 区域，每个 tab 保持一个主数据区","components":["Tabs","Alert","Typography.Paragraph","Card"],"priority":4,"complexity":"medium"},{"id":"records-block","description":"主数据表格列表","components":["Table","Tag","Pagination"],"priority":5,"complexity":"medium"},{"id":"side-info-block","description":"紧凑侧边补充说明或快捷入口","components":["Card","Typography.Text","Button"],"priority":6,"complexity":"simple"}]}',
        'Valid example 2:',
        '{"pageTitle":"员工详情","pageType":"detail","layout":[{"blocks":["detail-header"]},{"columns":[{"span":10,"blocks":["profile-block","contact-block"]},{"span":14,"blocks":["attendance-block","approval-block"]}]}],"blocks":[{"id":"detail-header","description":"页面标题、说明和操作按钮","components":["Typography.Title","Typography.Text","Button","Breadcrumb"],"priority":1,"complexity":"simple"},{"id":"profile-block","description":"员工基本信息","components":["Descriptions","Tag","Avatar"],"priority":2,"complexity":"simple"},{"id":"contact-block","description":"联系方式","components":["Descriptions","Typography.Text"],"priority":3,"complexity":"simple"},{"id":"attendance-block","description":"最近考勤记录","components":["Table","Pagination","Tag"],"priority":4,"complexity":"medium"},{"id":"approval-block","description":"审批动态","components":["Timeline","Badge"],"priority":5,"complexity":"medium"}]}',
        'Valid example 3:',
        '{"pageTitle":"主从详情管理页","pageType":"detail","layout":[{"blocks":["header-block"]},{"columns":[{"span":8,"blocks":["master-list-block"]},{"span":16,"blocks":["detail-tabs-block","timeline-block"]}]}],"blocks":[{"id":"header-block","description":"页面标题、面包屑及顶部操作区","components":["Typography.Title","Typography.Text","Breadcrumb","Button"],"priority":1,"complexity":"simple"},{"id":"master-list-block","description":"左侧主数据列表或树导航，项结构紧凑，支持搜索和选中状态","components":["Card","Form","Form.Item","Input","Tag","Typography.Text","Container"],"priority":2,"complexity":"medium"},{"id":"detail-tabs-block","description":"右侧详情 Tabs 区域，包含基本信息、记录和编辑入口","components":["Tabs","Descriptions","Tag","Button","Form","Form.Item","Input","Select"],"priority":3,"complexity":"medium"},{"id":"timeline-block","description":"底部时间线或操作记录","components":["Timeline","Timeline.Item","Card"],"priority":4,"complexity":"simple"}]}',
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
        `Schema Summary: ${input.context.document.summary}`,
        'Schema Tree:',
        documentTree,
        `Component Summary: ${input.context.componentSummary}`,
        'Conversation History:',
        conversationHistory,
        `Selected Node: ${input.context.selectedNodeId ?? 'none'}`,
        'Your response must start with { and end with }. No other text.',
      ].join('\n'),
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
        '- STRICT FUNCTION PROPS: Any prop whose contract type is function MUST be encoded as JSON-safe {"type":"JSFunction","params":[...],"body":"..."} objects. Never emit raw functions or strings like "(x)=>x".',
        '- The root node component must be one of the supported components.',
        '- Every child schema node must also use only supported components.',
        '- children may contain schema nodes or plain text only.',
        '- Build polished B2B admin blocks with clear hierarchy, balanced spacing, and concise business copy.',
        '- You are generating one visual region only, not a whole page.',
        '- Do NOT output page-level wrappers, page-level titles, page shell, or duplicated sibling regions.',
        '- Do NOT output page-level Row/Col or Tabs split layouts unless the current block description explicitly requires an internal split inside this one block.',
        '- Prefer Card as a self-contained wrapper for data, detail, timeline, result, empty-state, and status regions.',
        '- KPI regions may use Row > Col > Statistic inside a single block.',
        '- For dashboard and list filter regions, prefer one horizontal search bar with at most 3 fields in the same row.',
        '- Use Row + Col for filters. Date range may use a wider column, but should stay in the same horizontal row when possible.',
        '- Only use vertical/two-row filter layouts for advanced search, more than 3 fields, or clearly narrow widths.',
        '- Filter action buttons should be placed in a separate tail action area aligned to the right and kept in the same horizontal band as the fields, not in an empty-label Form.Item mixed with fields.',
        '- Do not generate a left stacked field column plus a far-right isolated button group for normal dashboard/list filters.',
        '- For KPI rows, use at most 4 cards and keep a consistent card structure: title + main value + one secondary line.',
        '- In Tabs trend regions, keep at most one Alert, one short description, and one main data area per tab pane.',
        '- Never use raw HTML tags like div, span, section, header, footer. Use Container instead of div/section/header/footer.',
        '- For Table, include sample data in props.dataSource and props.columns.',
        '- For Statistic, include props.title and props.value.',
        '- For Form.Item, include a label prop and exactly one input-like child when possible.',
        '- For Button, put button text in top-level children. Never put button text inside props.children.',
        '- For filter/action regions, query/reset/export buttons must be normal text buttons with visible children.',
        '- For Alert, use props.message for the main copy and props.description for secondary copy. Do not use props.title for Alert.',
        '- For Descriptions, include props.column and Descriptions.Item children with label props.',
        '- For Timeline, return Timeline.Item children with short text content.',
        '- Use realistic Chinese B-end copy such as 今日出勤率, 本周迟到人数, 最近考勤记录, 审批状态.',
        '- Avoid high-risk callback props unless the block explicitly needs them. If a function prop is unnecessary, omit it.',
        ...(isDashboardBlock
          ? [
            '- This request is dashboard-like. Favor clean business workbench rhythm over maximal density.',
            '- Prefer compact side info; do not create a large side card that competes with the main KPI rhythm unless explicitly required.',
          ]
          : []),
        ...(isMasterListRegion
          ? [
            '- This request includes a master-detail layout. Keep the left master list region compact and the right detail region visually dominant.',
            '- If tree semantics are supported for this block, prefer a tree-like structure. Otherwise, use compact Container/Card master items instead of multiline text Buttons.',
            '- Do NOT use Button type="text" as a multi-line card wrapper for master list items.',
            '- Each master item should contain at most one title line, one status/meta line, and one short description line.',
          ]
          : []),
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
        'Schema Tree:',
        documentTree,
        'Conversation History:',
        conversationHistory,
        ...(qualityFeedbackSummary ? [qualityFeedbackSummary] : []),
        'Your response must start with { and end with }. No other text.',
      ].join('\n'),
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
  const text = await client.chat(model, messages, thinking);
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

  if (qualityDiagnostics.some((item) => item.severity === 'retry')) {
    try {
      const retryMessages = createBlockMessages(input, qualityDiagnostics);
      const retryThinking = getThinking(input.request);
      retryRequestSummary = {
        provider: blockModelRef.provider ?? env.AI_PROVIDER,
        ...client.buildRequestDebugSummary(model, retryMessages, retryThinking, false),
      };
      retryText = await client.chat(model, retryMessages, retryThinking);
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
  const requestedPlannerModel = input.request.plannerModel ?? env.AI_PLANNER_MODEL;
  const plannerModelRef = parseProviderModelRef(requestedPlannerModel);
  const client = createClient(plannerModelRef.provider);
  const model = requireModel(plannerModelRef.model ?? requestedPlannerModel, 'planner');
  const messages = createPlannerMessages(input);
  const thinking = getThinking(input.request);
  const text = await client.chat(model, messages, thinking);
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
    };
  }
  return normalizedPlan;
}

function createRuntimeDeps(memory: AgentMemoryStore, trace?: RunTraceRecord): AgentRuntimeDeps {
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
        const requestedChatModel = getRequestedChatModel(request) ?? env.AI_PLANNER_MODEL ?? env.AI_BLOCK_MODEL;
        const chatModelRef = parseProviderModelRef(requestedChatModel);
        const client = createClient(chatModelRef.provider);
        const model = requireModel(chatModelRef.model ?? requestedChatModel, 'chat');
        const thinking = getThinkingFromUnknown(request);
        yield* client.streamChat(model, [
          { role: 'system', content: 'You are a helpful low-code assistant.' },
          { role: 'user', content: prompt },
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
      const trace = createTrace(request);
      try {
        const events = await runAgent(request, createRuntimeDeps(memory, trace));
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
      const trace = createTrace(request);
      const generator = runAgentStream(request, createRuntimeDeps(memory, trace));
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
