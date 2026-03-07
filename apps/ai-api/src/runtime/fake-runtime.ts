/**
 * Fake Runtime — 首版用于 SSE 契约验证，不调用真实 LLM
 * 二期：packages/ai-agents 实现 AgentRuntime 接口后在 app.ts 替换
 */
import type { AgentEvent, RunMetadata, RunRequest } from '@shenbi/ai-contracts';
import type { AgentRuntime } from './types.ts';

function makeMeta(sessionId: string, req: RunRequest, durationMs: number): RunMetadata {
  const meta: RunMetadata = {
    sessionId,
    plannerModel: req.plannerModel ?? 'fake-planner',
    blockModel: req.blockModel ?? 'fake-block',
    tokensUsed: 42,
    durationMs,
  };
  if (req.conversationId !== undefined) {
    meta.conversationId = req.conversationId;
  }
  return meta;
}

function makeEvents(sessionId: string, req: RunRequest): AgentEvent[] {
  return [
    { type: 'run:start', data: { sessionId, ...(req.conversationId ? { conversationId: req.conversationId } : {}) } },
    { type: 'message:start', data: { role: 'assistant' } },
    { type: 'message:delta', data: { text: `[Fake] 正在根据提示生成页面：${req.prompt}` } },
    {
      type: 'plan',
      data: {
        pageTitle: 'Fake Page',
        blocks: [
          {
            id: 'block-1',
            type: 'HeroSection',
            description: '主标题区块（fake）',
            components: ['HeroSection'],
            priority: 1,
            complexity: 'simple',
          },
        ],
      },
    },
    {
      type: 'schema:block',
      data: {
        blockId: 'block-1',
        node: { component: 'HeroSection', props: { title: 'Fake Title' } },
      },
    },
    {
      type: 'schema:done',
      data: {
        schema: {
          id: 'fake-page',
          body: [{ component: 'HeroSection', props: { title: 'Fake Title' } }],
        },
      },
    },
  ];
}

async function* streamEvents(events: AgentEvent[], metadata: RunMetadata): AsyncIterable<AgentEvent> {
  for (const event of events) {
    yield event;
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
  }
  yield { type: 'done', data: { metadata } };
}

export const fakeRuntime: AgentRuntime = {
  async run(request) {
    const sessionId = `fake-${Date.now()}`;
    const start = Date.now();
    const events = makeEvents(sessionId, request);
    const metadata = makeMeta(sessionId, request, Date.now() - start);
    const allEvents: AgentEvent[] = [...events, { type: 'done', data: { metadata } }];
    return { events: allEvents, metadata };
  },

  async *runStream(request) {
    const sessionId = `fake-${Date.now()}`;
    const start = Date.now();
    const events = makeEvents(sessionId, request);
    const metadata = makeMeta(sessionId, request, Date.now() - start);
    yield* streamEvents(events, metadata);
  },
};
