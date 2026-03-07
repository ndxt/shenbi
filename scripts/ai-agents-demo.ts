import {
  createInMemoryAgentMemoryStore,
  createToolRegistry,
  runAgent,
  type AgentRuntimeDeps,
  type GenerateBlockInput,
  type PagePlan,
  type RunRequest,
} from '../packages/ai-agents/src/index.ts';

type DemoMode = 'page' | 'chat';

function getMode(): DemoMode {
  const arg = process.argv[2]?.trim().toLowerCase();
  return arg === 'chat' ? 'chat' : 'page';
}

function createBaseRequest(mode: DemoMode): RunRequest {
  return {
    prompt: mode === 'chat' ? 'How should I design an admin page?' : 'Generate an admin page',
    conversationId: `demo-${mode}`,
    plannerModel: 'planner-demo',
    blockModel: 'block-demo',
    selectedNodeId: 'body.0',
    context: {
      schemaSummary: 'Empty page with no blocks',
      componentSummary: 'Card, Table, Form, Button',
    },
  };
}

function createPagePlan(): PagePlan {
  return {
    pageTitle: 'Admin Dashboard',
    blocks: [
      {
        id: 'hero',
        type: 'Hero',
        description: 'Top summary area',
        components: ['Card'],
        priority: 1,
        complexity: 'simple',
      },
      {
        id: 'table',
        type: 'Table',
        description: 'User list',
        components: ['Table'],
        priority: 2,
        complexity: 'medium',
      },
    ],
  };
}

function createPageDeps(): AgentRuntimeDeps {
  return {
    llm: {
      async chat() {
        return { text: 'unused' };
      },
      async *streamChat() {
        yield { text: 'unused' };
      },
    },
    tools: createToolRegistry([
      {
        name: 'planPage',
        async execute() {
          return createPagePlan();
        },
      },
      {
        name: 'generateBlock',
        async execute(input: GenerateBlockInput) {
          return {
            blockId: input.block.id,
            node: {
              id: `${input.block.id}-node`,
              component: input.block.components[0] ?? input.block.type,
            },
            summary: `Generated ${input.block.type}`,
          };
        },
      },
      {
        name: 'assembleSchema',
        async execute(input: { plan: PagePlan; blocks: Array<{ node: unknown }> }) {
          return {
            id: 'page',
            name: input.plan.pageTitle,
            body: input.blocks.map((block) => block.node),
          };
        },
      },
    ]),
    memory: createInMemoryAgentMemoryStore(),
    logger: {
      info(message, payload) {
        console.log('[info]', message, payload ?? '');
      },
      error(message, payload) {
        console.error('[error]', message, payload ?? '');
      },
    },
  };
}

function createChatDeps(): AgentRuntimeDeps {
  return {
    llm: {
      async chat() {
        return { text: 'unused' };
      },
      async *streamChat() {
        yield { text: 'You can start with a KPI summary card. ' };
        yield { text: 'Then add a searchable user table and an action drawer.' };
      },
    },
    tools: createToolRegistry([]),
    memory: createInMemoryAgentMemoryStore(),
    logger: {
      info(message, payload) {
        console.log('[info]', message, payload ?? '');
      },
      error(message, payload) {
        console.error('[error]', message, payload ?? '');
      },
    },
  };
}

async function main(): Promise<void> {
  const mode = getMode();
  const request = createBaseRequest(mode);
  const deps = mode === 'chat' ? createChatDeps() : createPageDeps();
  const events = await runAgent(request, deps);

  console.log(`--- ai-agents demo (${mode}) ---`);
  console.log(JSON.stringify(events, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
