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
import { writeInvalidJsonDump, type InvalidJsonSource } from '../adapters/debug-dump.ts';
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
  getPlannerContractSummary,
  getZoneComponentCandidates,
  getZoneContractSummary,
  getZoneGoldenExample,
} from './component-catalog.ts';
import type { AgentRuntime } from './types.ts';

const memory = createInMemoryAgentMemoryStore();
const env = loadEnv();
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

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
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
      if (stack.at(-1) !== '{') {
        return null;
      }
      stack.pop();
      if (stack.length === 0) {
        return text.slice(start, index + 1);
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

function trySalvageJsonCandidate(text: string): string | null {
  const extracted = findBalancedJsonObject(text);
  if (extracted) {
    return extracted;
  }

  const trimmed = text.trim();
  for (let trimCount = 1; trimCount <= Math.min(24, trimmed.length); trimCount += 1) {
    const candidate = trimmed.slice(0, trimmed.length - trimCount).trimEnd();
    if (!candidate) {
      break;
    }
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // continue trimming
    }
  }

  const start = text.indexOf('{');
  if (start < 0) {
    return null;
  }

  const fullBase = text.slice(start).trim();
  const fullOpenCount = countOutsideStrings(fullBase, '{');
  const fullCloseCount = countOutsideStrings(fullBase, '}');
  if (fullOpenCount > fullCloseCount) {
    if (fullOpenCount - fullCloseCount > 8) {
      return null;
    }
    return `${fullBase}${'}'.repeat(fullOpenCount - fullCloseCount)}`;
  }

  const end = text.lastIndexOf('}');
  const base = text.slice(start, end >= start ? end + 1 : text.length).trim();
  const openCount = countOutsideStrings(base, '{');
  const closeCount = countOutsideStrings(base, '}');
  if (openCount === closeCount) {
    return base;
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
        return trimmed.trim();
      }
      if (nextCloseCount < nextOpenCount) {
        break;
      }
    }
    return null;
  }
  return null;
}

function extractJson<T>(
  text: string,
  source: InvalidJsonSource,
  request: Pick<RunRequest, 'prompt' | 'plannerModel' | 'blockModel' | 'thinking' | 'context'>,
  model: string,
): T {
  const candidate = extractJsonCandidate(text);
  try {
    return JSON.parse(candidate.trim()) as T;
  } catch {
    const salvagedCandidate = trySalvageJsonCandidate(candidate);
    if (salvagedCandidate) {
      try {
        logger.warn('ai.model.invalid_json_salvaged', {
          source,
          model,
        });
        return JSON.parse(salvagedCandidate) as T;
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

function normalizePlan(plan: PagePlan): PagePlan {
  if (!plan.pageTitle || !Array.isArray(plan.blocks) || plan.blocks.length === 0) {
    throw new LLMError('Planner returned an empty page plan', 'EMPTY_PAGE_PLAN');
  }
  if (!isSupportedPageType(plan.pageType)) {
    throw new LLMError(`Planner returned unsupported pageType: ${String(plan.pageType)}`, 'UNSUPPORTED_PAGE_TYPE');
  }

  return {
    ...plan,
    blocks: plan.blocks.map((block, index) => {
      if (!isSupportedZoneType(block.type)) {
        throw new LLMError(`Planner returned unsupported zone type: ${String(block.type)}`, 'UNSUPPORTED_ZONE_TYPE');
      }

      const components = Array.isArray(block.components) ? block.components.filter(isSupportedComponent) : [];
      if (components.length === 0) {
        throw new LLMError(`Planner returned no supported components for block: ${block.id || `block-${index + 1}`}`, 'UNSUPPORTED_BLOCK_COMPONENTS');
      }

      return {
        ...block,
        id: block.id || `block-${index + 1}`,
        type: block.type,
        components,
        priority: Number.isFinite(block.priority) ? block.priority : index + 1,
        complexity: block.complexity === 'medium' || block.complexity === 'complex' ? block.complexity : 'simple',
      };
    }),
  };
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
        '- Favor clean B2B admin layouts: clear page title, concise helper text, grouped filters, summary cards, primary data area, moderate whitespace.',
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
      ].join('\n'),
    },
  ];
}

function createBlockMessages(input: GenerateBlockInput): OpenAICompatibleMessage[] {
  const zoneCandidates = getZoneComponentCandidates(input.block.type);
  const zoneContractSummary = getZoneContractSummary(input.block.type, input.block.components);
  const zoneGoldenExample = getZoneGoldenExample(input.block.type);
  return [
    {
      role: 'system',
      content: [
        'You generate one low-code block as valid JSON.',
        `Only use supported components: ${supportedComponentList}.`,
        `For this zone, prioritize these candidate components: ${zoneCandidates.join(', ')}.`,
        'Zone-specific contract summary:',
        zoneContractSummary,
        'Valid zone example:',
        zoneGoldenExample,
        'Rules:',
        '- The root node component must be one of the supported components.',
        '- Every child schema node must also use only supported components.',
        '- children may contain schema nodes or plain text only.',
        '- Build polished B2B admin blocks with clear hierarchy, balanced spacing, and concise business copy.',
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
        `Block Type: ${input.block.type}`,
        `Block Description: ${input.block.description}`,
        `Suggested Components: ${input.block.components.join(', ')}`,
      ].join('\n'),
    },
  ];
}

async function generateBlock(input: GenerateBlockInput): Promise<GenerateBlockResult> {
  const client = createClient();
  const model = requireModel(input.request.blockModel ?? env.AI_BLOCK_MODEL, 'block');
  const text = await client.chat(model, createBlockMessages(input), getThinking(input.request));
  const node = validateNode(
    extractJson<GenerateBlockResult['node']>(text, 'block', input.request, model),
  );
  return {
    blockId: input.block.id,
    node,
    summary: `Generated ${input.block.type} via ${model}`,
  };
}

async function assembleSchema(input: AssembleSchemaInput): Promise<PageSchema> {
  const headerBlock = input.blocks.find((block) => block.blockId === 'header' || input.plan.blocks.find((planBlock) => planBlock.id === block.blockId)?.type === 'page-header');
  const contentBlocks = input.blocks.filter((block) => block !== headerBlock);

  const contentGap = input.plan.pageType === 'dashboard' || input.plan.pageType === 'statistics' ? 24 : 16;

  const contentChildren = contentBlocks.map((block) => {
    const blockPlan = input.plan.blocks.find((planBlock) => planBlock.id === block.blockId);
    const zoneType = blockPlan?.type ?? 'custom';

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

    if (zoneType === 'filter') {
      return {
        id: `${block.blockId}-section`,
        component: 'Card',
        props: {
          bordered: true,
          size: 'small',
        },
        children: [block.node],
      };
    }

    if (zoneType === 'data-table') {
      return {
        id: `${block.blockId}-section`,
        component: 'Card',
        props: {
          title: blockPlan?.description ?? '数据区域',
          bordered: true,
        },
        children: [block.node],
      };
    }

    if (zoneType === 'detail-info' || zoneType === 'form-body' || zoneType === 'timeline-area' || zoneType === 'chart-area' || zoneType === 'side-info') {
      return {
        id: `${block.blockId}-section`,
        component: 'Card',
        props: {
          title: blockPlan?.description ?? '内容区域',
          bordered: true,
        },
        children: [block.node],
      };
    }

    return block.node;
  });

  return {
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
          {
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
            children: headerBlock
              ? [headerBlock.node]
              : [
                  {
                    id: 'page-title-fallback',
                    component: 'Container',
                    props: {
                      direction: 'column',
                      gap: 6,
                    },
                    children: [
                      {
                        id: 'page-title-fallback-title',
                        component: 'Typography.Title',
                        props: {
                          level: 2,
                        },
                        children: [input.plan.pageTitle],
                      },
                      {
                        id: 'page-title-fallback-desc',
                        component: 'Typography.Text',
                        props: {
                          type: 'secondary',
                        },
                        children: [`${input.plan.pageType} page`],
                      },
                    ],
                  },
                ],
          },
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
}

async function planWithModel(input: PlanPageInput): Promise<PagePlan> {
  const client = createClient();
  const model = requireModel(input.request.plannerModel ?? env.AI_PLANNER_MODEL, 'planner');
  const text = await client.chat(model, createPlannerMessages(input), getThinking(input.request));
  const plan = extractJson<PagePlan>(text, 'planner', input.request, model);
  return normalizePlan(plan);
}

function createRuntimeDeps(): AgentRuntimeDeps {
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
          return planWithModel(input as PlanPageInput);
        },
      },
      {
        name: 'generateBlock',
        async execute(input: unknown) {
          return generateBlock(input as GenerateBlockInput);
        },
      },
      {
        name: 'assembleSchema',
        async execute(input: unknown) {
          return assembleSchema(input as AssembleSchemaInput);
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

export const agentRuntime: AgentRuntime = {
  async run(request) {
    const events = await runAgent(request, createRuntimeDeps());
    return { events, metadata: extractMetadata(events) };
  },

  async *runStream(request) {
    yield* runAgentStream(request, createRuntimeDeps());
  },
};
