/**
 * Default runtime assembly — API Host 通过 @shenbi/ai-agents 产出真实事件流，
 * 底层暂时仍使用 fake llm/tools，后续替换为 ai-service/provider 装配即可。
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
import { loadEnv } from '../adapters/env.ts';
import { OpenAICompatibleClient, type OpenAICompatibleMessage } from '../adapters/openai-compatible.ts';
import type { AgentRuntime } from './types.ts';

const memory = createInMemoryAgentMemoryStore();
const env = loadEnv();
const supportedComponents = ['Card', 'Container', 'Button', 'Table', 'Alert'] as const;

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  return JSON.parse(candidate.trim()) as T;
}

function createClient(): OpenAICompatibleClient | undefined {
  if (
    env.AI_PROVIDER !== 'openai-compatible'
    || !env.AI_OPENAI_COMPAT_BASE_URL
    || !env.AI_OPENAI_COMPAT_API_KEY
  ) {
    return undefined;
  }
  return new OpenAICompatibleClient({
    baseUrl: env.AI_OPENAI_COMPAT_BASE_URL,
    apiKey: env.AI_OPENAI_COMPAT_API_KEY,
  });
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

function createPagePlan(input: PlanPageInput): PagePlan {
  const prompt = input.request.prompt;
  return {
    pageTitle: `${prompt}页面`,
    blocks: [
      {
        id: 'summary-card',
        type: 'Card',
        description: `根据提示生成摘要卡片: ${prompt}`,
        components: ['Card', 'Button'],
        priority: 1,
        complexity: 'simple',
      },
      {
        id: 'attendance-table',
        type: 'Table',
        description: `根据提示生成数据表格: ${prompt}`,
        components: ['Table'],
        priority: 2,
        complexity: 'simple',
      },
    ],
  };
}

async function generateBlock(input: GenerateBlockInput): Promise<GenerateBlockResult> {
  const client = createClient();
  const model = input.request.blockModel ?? env.AI_BLOCK_MODEL;

  if (client && model) {
    try {
      const text = await client.chat(model, createBlockMessages(input));
      const node = extractJson<GenerateBlockResult['node']>(text);
      return {
        blockId: input.block.id,
        node,
        summary: `Generated ${input.block.type} via ${model}`,
      };
    } catch {
      // Fall through to deterministic fallback.
    }
  }

  if (input.block.type === 'Card') {
    return {
      blockId: input.block.id,
      node: {
        id: 'attendance-summary-card',
        component: 'Card',
        props: {
          title: input.request.prompt,
          bordered: true,
        },
        children: [
          {
            id: 'attendance-summary-container',
            component: 'Container',
            props: {
              direction: 'column',
              gap: 12,
            },
            children: [
              {
                id: 'attendance-summary-action',
                component: 'Button',
                props: {
                  type: 'primary',
                },
                children: '开始查看',
              },
            ],
          },
        ],
      },
      summary: 'Generated Card',
    };
  }

  if (input.block.type === 'Table') {
    return {
      blockId: input.block.id,
      node: {
        id: 'attendance-table',
        component: 'Table',
        props: {
          rowKey: 'id',
          bordered: true,
          pagination: false,
          dataSource: [
            { id: 1, name: '张三', department: '研发', status: '正常', checkIn: '09:01' },
            { id: 2, name: '李四', department: '运营', status: '迟到', checkIn: '09:23' },
          ],
          columns: [
            { title: '姓名', dataIndex: 'name', key: 'name' },
            { title: '部门', dataIndex: 'department', key: 'department' },
            { title: '状态', dataIndex: 'status', key: 'status' },
            { title: '签到时间', dataIndex: 'checkIn', key: 'checkIn' },
          ],
        },
      },
      summary: 'Generated Table',
    };
  }

  return {
    blockId: input.block.id,
    node: {
      component: 'Container',
      props: {
        direction: 'column',
        gap: 8,
      },
    },
    summary: `Generated ${input.block.type}`,
  };
}

async function assembleSchema(input: AssembleSchemaInput): Promise<PageSchema> {
  return {
    id: 'fake-page',
    name: input.plan.pageTitle,
    body: input.blocks.map((block) => block.node),
  };
}

async function planWithModel(input: PlanPageInput): Promise<PagePlan> {
  const client = createClient();
  const model = input.request.plannerModel ?? env.AI_PLANNER_MODEL;
  if (!client || !model) {
    return createPagePlan(input);
  }

  try {
    const text = await client.chat(model, createPlannerMessages(input));
    const plan = extractJson<PagePlan>(text);
    if (!plan.pageTitle || !Array.isArray(plan.blocks) || plan.blocks.length === 0) {
      return createPagePlan(input);
    }
    return {
      ...plan,
      blocks: plan.blocks.map((block, index) => ({
        ...block,
        id: block.id || `block-${index + 1}`,
        type: supportedComponents.includes(block.type as (typeof supportedComponents)[number]) ? block.type : 'Card',
        components: Array.isArray(block.components) && block.components.length > 0
          ? block.components.filter((component): component is string => supportedComponents.includes(component as (typeof supportedComponents)[number]))
          : ['Card'],
        priority: Number.isFinite(block.priority) ? block.priority : index + 1,
        complexity: block.complexity === 'medium' || block.complexity === 'complex' ? block.complexity : 'simple',
      })),
    };
  } catch {
    return createPagePlan(input);
  }
}

function createRuntimeDeps(): AgentRuntimeDeps {
  return {
    llm: {
      async chat(request: unknown) {
        const client = createClient();
        const model = env.AI_PLANNER_MODEL ?? env.AI_BLOCK_MODEL;
        const prompt = typeof request === 'object' && request && 'prompt' in request
          ? String((request as { prompt: unknown }).prompt)
          : 'No prompt';
        if (client && model) {
          const text = await client.chat(model, [
            { role: 'system', content: 'You are a helpful low-code assistant.' },
            { role: 'user', content: prompt },
          ]);
          return { text };
        }
        return { text: 'Fake chat response' };
      },
      async *streamChat(request: unknown) {
        const prompt = typeof request === 'object' && request && 'prompt' in request
          ? String((request as { prompt: unknown }).prompt)
          : 'No prompt';
        const client = createClient();
        const model = env.AI_PLANNER_MODEL ?? env.AI_BLOCK_MODEL;
        if (client && model) {
          yield* client.streamChat(model, [
            { role: 'system', content: 'You are a helpful low-code assistant.' },
            { role: 'user', content: prompt },
          ]);
          return;
        }
        yield { text: `[Fake] ${prompt}` };
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

export const fakeRuntime: AgentRuntime = {
  async run(request) {
    const events = await runAgent(request, createRuntimeDeps());
    return { events, metadata: extractMetadata(events) };
  },

  async *runStream(request) {
    yield* runAgentStream(request, createRuntimeDeps());
  },
};
