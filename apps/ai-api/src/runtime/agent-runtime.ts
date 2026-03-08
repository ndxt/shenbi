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
import { OpenAICompatibleClient, type OpenAICompatibleMessage } from '../adapters/openai-compatible.ts';
import type { AgentRuntime } from './types.ts';

const memory = createInMemoryAgentMemoryStore();
const env = loadEnv();
const supportedComponents = ['Card', 'Container', 'Button', 'Table', 'Alert'] as const;

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

function createPlannerMessages(input: PlanPageInput): OpenAICompatibleMessage[] {
  return [
    {
      role: 'system',
      content: [
        'You are a low-code page planner.',
        'Only output valid JSON.',
        'Use only these supported components when planning:',
        supportedComponents.join(', '),
        'Return JSON shape:',
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
        'Only use supported components:',
        supportedComponents.join(', '),
        'Return JSON shape:',
        '{"component":"Card|Table|Container|Button|Alert","id":"string","props":{},"children":[]}',
        'For children, use schema nodes or plain text only.',
        'For Table, put sample data in props.dataSource and props.columns.',
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
  const text = await client.chat(model, createBlockMessages(input));
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
  const text = await client.chat(model, createPlannerMessages(input));
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
        const text = await client.chat(model, [
          { role: 'system', content: 'You are a helpful low-code assistant.' },
          { role: 'user', content: prompt },
        ]);
        return { text };
      },
      async *streamChat(request: unknown) {
        const prompt = typeof request === 'object' && request && 'prompt' in request
          ? String((request as { prompt: unknown }).prompt)
          : 'No prompt';
        const client = createClient();
        const model = requireModel(getRequestedChatModel(request) ?? env.AI_PLANNER_MODEL ?? env.AI_BLOCK_MODEL, 'chat');
        yield* client.streamChat(model, [
          { role: 'system', content: 'You are a helpful low-code assistant.' },
          { role: 'user', content: prompt },
        ]);
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
