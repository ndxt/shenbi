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
import type { AgentRuntime } from './types.ts';

const memory = createInMemoryAgentMemoryStore();

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

function createRuntimeDeps(): AgentRuntimeDeps {
  return {
    llm: {
      async chat() {
        return { text: 'Fake chat response' };
      },
      async *streamChat(request: unknown) {
        const prompt = typeof request === 'object' && request && 'prompt' in request
          ? String((request as { prompt: unknown }).prompt)
          : 'No prompt';
        yield { text: `[Fake] ${prompt}` };
      },
    },
    tools: createToolRegistry([
      {
        name: 'planPage',
        async execute(input: unknown) {
          return createPagePlan(input as PlanPageInput);
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
