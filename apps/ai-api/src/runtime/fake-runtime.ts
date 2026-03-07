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
  const requestedType = input.context.componentSummary.includes('DataTable') ? 'DataTable' : 'HeroSection';
  return {
    pageTitle: 'Fake Page',
    blocks: [
      {
        id: 'block-1',
        type: requestedType,
        description: `根据提示生成首页区块: ${input.request.prompt}`,
        components: [requestedType],
        priority: 1,
        complexity: 'simple',
      },
    ],
  };
}

async function generateBlock(input: GenerateBlockInput): Promise<GenerateBlockResult> {
  return {
    blockId: input.block.id,
    node: {
      component: input.block.components[0] ?? input.block.type,
      props: {
        title: input.request.prompt,
        description: input.block.description,
        selectedNodeId: input.context.selectedNodeId,
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
