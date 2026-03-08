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
  type PlanPageInput,
  type RunMetadata,
  type RunRequest,
} from '@shenbi/ai-agents';
import type { AgentEvent } from '@shenbi/ai-contracts';
import type { PageSchema } from '@shenbi/schema';
import { LLMError } from '../adapters/errors.ts';
import { loadEnv } from '../adapters/env.ts';
import {
  OpenAICompatibleClient,
  type OpenAICompatibleMessage,
  type OpenAICompatibleThinking,
} from '../adapters/openai-compatible.ts';
import type { AgentRuntime } from './types.ts';

const memory = createInMemoryAgentMemoryStore();
const env = loadEnv();
const supportedComponents = ['Card', 'Container', 'Button', 'Table', 'Alert'] as const;
const supportedComponentList = supportedComponents.join(', ');

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  try {
    return JSON.parse(candidate.trim()) as T;
  } catch {
    throw new LLMError('Model returned invalid JSON', 'MODEL_INVALID_JSON');
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

function isSupportedComponent(value: unknown): value is (typeof supportedComponents)[number] {
  return typeof value === 'string' && supportedComponents.includes(value as (typeof supportedComponents)[number]);
}

function isNodeLike(value: unknown): value is GenerateBlockResult['node'] {
  return Boolean(value) && typeof value === 'object' && 'component' in (value as Record<string, unknown>);
}

function normalizePlan(plan: PagePlan): PagePlan {
  if (!plan.pageTitle || !Array.isArray(plan.blocks) || plan.blocks.length === 0) {
    throw new LLMError('Planner returned an empty page plan', 'EMPTY_PAGE_PLAN');
  }

  return {
    ...plan,
    blocks: plan.blocks.map((block, index) => {
      if (!isSupportedComponent(block.type)) {
        throw new LLMError(`Planner returned unsupported block type: ${String(block.type)}`, 'UNSUPPORTED_BLOCK_TYPE');
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
  if (!isSupportedComponent(node.component)) {
    throw new LLMError(`Block generator returned unsupported component: ${String(node.component)}`, 'UNSUPPORTED_COMPONENT');
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (isNodeLike(child)) {
        validateNode(child);
      }
    }
  }

  return node;
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
        'Hard rules:',
        '- pageTitle must be a concise human-readable title.',
        '- blocks must be a non-empty array.',
        '- block.id is a semantic identifier and may contain business meaning such as alert-summary, recent-records, attendance-table.',
        '- block.type is NOT a business label. block.type must be exactly one of: Card, Container, Button, Table, Alert.',
        '- block.components must be a non-empty array.',
        '- Every item in block.components must be exactly one of: Card, Container, Button, Table, Alert.',
        '- If the block is a summary, notice, warning, status, or announcement area, use type Alert and components ["Alert"] or type Card and components ["Card"].',
        '- If the block is a records, list, ranking, attendance, or detail table area, use type Table and components ["Table"].',
        '- Never put semantic aliases like hero, recent-records, summary-panel, alert-summary, dashboard-header, banner, widget into type or components.',
        '- Business meaning belongs only in id and description.',
        '- If unsure, choose Card with components ["Card"].',
        '- Return JSON only. No markdown, no explanation, no code fences.',
        'Valid example 1:',
        '{"pageTitle":"考勤首页","blocks":[{"id":"alert-summary","type":"Alert","description":"展示今日考勤提醒","components":["Alert"],"priority":1,"complexity":"simple"}]}',
        'Valid example 2:',
        '{"pageTitle":"考勤首页","blocks":[{"id":"recent-records","type":"Table","description":"展示最近考勤记录","components":["Table"],"priority":2,"complexity":"simple"}]}',
        'Invalid example:',
        '{"pageTitle":"考勤首页","blocks":[{"id":"recent-records","type":"recent-records","description":"...","components":["recent-records"],"priority":1,"complexity":"simple"}]}',
        'Return exactly this JSON shape:',
        '{"pageTitle":"string","blocks":[{"id":"string","type":"Card|Table|Container|Button|Alert","description":"string","components":["Card"],"priority":1,"complexity":"simple"}]}',
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
  return [
    {
      role: 'system',
      content: [
        'You generate one low-code block as valid JSON.',
        `Only use supported components: ${supportedComponentList}.`,
        'Rules:',
        '- The root node component must be one of the supported components.',
        '- Every child schema node must also use only supported components.',
        '- children may contain schema nodes or plain text only.',
        '- Do not output semantic aliases like hero, recent-records, summary-panel, header, footer.',
        '- For Table, include sample data in props.dataSource and props.columns.',
        '- Return JSON only. No markdown, no explanation, no code fences.',
        'Return exactly this JSON shape:',
        '{"component":"Card|Table|Container|Button|Alert","id":"string","props":{},"children":[]}',
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
  const node = validateNode(extractJson<GenerateBlockResult['node']>(text));
  return {
    blockId: input.block.id,
    node,
    summary: `Generated ${input.block.type} via ${model}`,
  };
}

async function assembleSchema(input: AssembleSchemaInput): Promise<PageSchema> {
  return {
    id: 'ai-generated-page',
    name: input.plan.pageTitle,
    body: input.blocks.map((block) => block.node),
  };
}

async function planWithModel(input: PlanPageInput): Promise<PagePlan> {
  const client = createClient();
  const model = requireModel(input.request.plannerModel ?? env.AI_PLANNER_MODEL, 'planner');
  const text = await client.chat(model, createPlannerMessages(input), getThinking(input.request));
  const plan = extractJson<PagePlan>(text);
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
