import { describe, expect, it, vi } from 'vitest';
import type { PageSchema } from '@shenbi/schema';
import type { PagePlan, RunRequest, AgentRuntimeDeps, GenerateBlockResult } from '../types';
import { runAgent } from './run-agent';
import { createInMemoryAgentMemoryStore } from '../memory/memory-store';
import { createToolRegistry } from '../tools/registry';

function createRequest(overrides: Partial<RunRequest> = {}): RunRequest {
  return {
    prompt: 'Generate an admin page',
    plannerModel: 'planner-test',
    blockModel: 'block-test',
    conversationId: 'conv-1',
    selectedNodeId: 'body.0',
    context: {
      schemaSummary: 'Empty page with no blocks',
      componentSummary: 'Card, Table, Form, Button',
    },
    ...overrides,
  };
}

function createPagePlan(): PagePlan {
  return {
    pageTitle: 'Admin Dashboard',
    pageType: 'dashboard',
    layout: [
      { blocks: ['hero'] },
      { columns: [{ span: 24, blocks: ['table'] }] },
    ],
    blocks: [
      {
        id: 'hero',
        description: 'Top summary area',
        components: ['Card'],
        priority: 1,
        complexity: 'simple',
      },
      {
        id: 'table',
        description: 'User list',
        components: ['Table'],
        priority: 2,
        complexity: 'medium',
      },
    ],
  };
}

function createGeneratedBlock(blockId: string, component: string): GenerateBlockResult {
  return {
    blockId,
    node: {
      id: `${blockId}-node`,
      component,
    },
    summary: `Generated ${component}`,
  };
}

function createSchema(): PageSchema {
  return {
    id: 'page',
    name: 'Admin Dashboard',
    body: [
      {
        id: 'hero-node',
        component: 'Card',
      },
      {
        id: 'table-node',
        component: 'Table',
      },
    ],
  };
}

function createDeps() {
  const planPage = vi.fn(async () => createPagePlan());
  const buildSkeletonSchema = vi.fn(async () => ({
    id: 'page-skeleton',
    name: 'Admin Dashboard',
    body: [{ id: 'hero-skeleton', component: 'Card' }],
  }));
  const generateBlock = vi
    .fn()
    .mockImplementationOnce(async () => createGeneratedBlock('hero', 'Card'))
    .mockImplementationOnce(async () => createGeneratedBlock('table', 'Table'));
  const assembleSchema = vi.fn(async () => createSchema());

  const deps: AgentRuntimeDeps = {
    llm: {
      chat: vi.fn(async () => ({ text: 'unused' })),
      streamChat: vi.fn(async function* () {
        yield { text: 'unused' };
      }),
    },
    tools: createToolRegistry([
      { name: 'planPage', execute: planPage },
      { name: 'buildSkeletonSchema', execute: buildSkeletonSchema },
      { name: 'generateBlock', execute: generateBlock },
      { name: 'assembleSchema', execute: assembleSchema },
    ]),
    memory: createInMemoryAgentMemoryStore(),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
    },
  };

    return {
      deps,
      planPage,
      buildSkeletonSchema,
      generateBlock,
      assembleSchema,
    };
}

describe('runAgent', () => {
  it('emits stable page-builder happy-path events and writes memory', async () => {
    const { deps, planPage, buildSkeletonSchema, generateBlock, assembleSchema } = createDeps();

    const events = await runAgent(createRequest(), deps);
    expect(events.map((event) => event.type)).toEqual([
      'run:start',
      'intent',
      'message:start',
      'message:delta',
      'tool:start',
      'tool:result',
      'plan',
      'tool:start',
      'tool:result',
      'schema:skeleton',
      'schema:block:start',
      'tool:start',
      'schema:block:start',
      'tool:start',
      'tool:result',
      'schema:block',
      'tool:result',
      'schema:block',
      'tool:start',
      'tool:result',
      'schema:done',
      'done',
    ]);

    expect(planPage).toHaveBeenCalledOnce();
    expect(buildSkeletonSchema).toHaveBeenCalledOnce();
    expect(generateBlock).toHaveBeenCalledTimes(2);
    expect(assembleSchema).toHaveBeenCalledOnce();

    const metadataEvent = events.at(-1);
    expect(metadataEvent?.type).toBe('done');
    if (metadataEvent?.type === 'done') {
      expect(metadataEvent.data.metadata.conversationId).toBe('conv-1');
      expect(metadataEvent.data.metadata.durationMs).toEqual(expect.any(Number));
    }

    const storedConversation = await deps.memory.getConversation('conv-1');
    expect(storedConversation).toEqual([
      { role: 'user', text: 'Generate an admin page' },
      {
        role: 'assistant',
        text: 'Planning page structure.',
        meta: expect.objectContaining({
          sessionId: expect.any(String),
          intent: 'schema.create',
        }),
      },
    ]);
    expect(await deps.memory.getLastBlockIds('conv-1')).toEqual(['hero', 'table']);
  });

  it('returns error event when a tool fails', async () => {
    const { deps } = createDeps();
    deps.tools = createToolRegistry([
      {
        name: 'planPage',
        execute: async () => {
          throw new Error('plan failed');
        },
      },
      { name: 'buildSkeletonSchema', execute: async () => createSchema() },
      { name: 'generateBlock', execute: async () => createGeneratedBlock('hero', 'Card') },
      { name: 'assembleSchema', execute: async () => createSchema() },
    ]);

    const events = await runAgent(createRequest(), deps);
    expect(events.map((event) => event.type)).toEqual([
      'run:start',
      'intent',
      'message:start',
      'message:delta',
      'tool:start',
      'error',
    ]);
    const last = events.at(-1);
    expect(last).toEqual({
      type: 'error',
      data: { message: 'plan failed' },
    });
  });

  it('documents that API host validates missing context before runtime', async () => {
    const { deps } = createDeps();

    const events = await runAgent(
      createRequest({
        context: {
          schemaSummary: '',
          componentSummary: '',
        },
      }),
      deps,
    );

    expect(events[0]?.type).toBe('run:start');
    expect(events.at(-1)?.type).toBe('done');
  });
});
