import { describe, expect, it } from 'vitest';
import type {
  AIClient,
  AgentEvent,
  ChatRequest,
  ChatResponse,
  FinalizeRequest,
  FinalizeResult,
  RunRequest,
  RunStreamOptions,
} from './api-types';
import { runPageExecution } from './page-execution';

class ScenarioAIClient implements AIClient {
  constructor(private readonly events: AgentEvent[]) {}

  async *runStream(_request: RunRequest, _options: RunStreamOptions = {}): AsyncIterable<AgentEvent> {
    for (const event of this.events) {
      yield event;
    }
  }

  async chat(_request: ChatRequest): Promise<ChatResponse> {
    return { content: '' };
  }

  async *chatStream(): AsyncIterable<{ delta: string }> {
    yield { delta: '' };
  }

  async finalize(_request: FinalizeRequest): Promise<FinalizeResult> {
    return {};
  }
}

describe('runPageExecution', () => {
  it('produces a normalized create snapshot for shared planner/block rendering', async () => {
    const client = new ScenarioAIClient([
      {
        type: 'plan',
        data: {
          pageTitle: '订单列表页',
          pageType: 'list',
          blocks: [
            {
              id: 'header',
              description: '页面标题和操作按钮区域',
              components: ['Typography.Title', 'Button'],
              priority: 1,
              complexity: 'simple',
            },
          ],
          _plannerMetrics: {
            durationMs: 1200,
            inputTokens: 111,
            outputTokens: 222,
          },
        },
      },
      {
        type: 'schema:block:start',
        data: {
          blockId: 'header',
          description: '页面标题和操作按钮区域',
        },
      },
      {
        type: 'schema:block',
        data: {
          blockId: 'header',
          node: {
            id: 'header',
            component: 'Container',
            children: [],
          },
          durationMs: 3200,
          inputTokens: 333,
          outputTokens: 444,
        },
      },
      {
        type: 'schema:done',
        data: {
          schema: {
            id: 'order-list',
            name: '订单列表页',
            body: [],
          },
        },
      },
      {
        type: 'done',
        data: {
          metadata: {
            sessionId: 'session-create',
            durationMs: 5200,
          },
        },
      },
    ]);

    const result = await runPageExecution({
      aiClient: client,
      request: {
        prompt: '生成订单列表页',
        intent: 'schema.create',
        context: {
          schemaSummary: 'pageId=empty',
          componentSummary: 'Container',
        },
      },
      initialMode: 'create',
    });

    expect(result.snapshot).toMatchObject({
      mode: 'create',
      plan: {
        pageTitle: '订单列表页',
      },
      plannerMetrics: {
        durationMs: 1200,
        inputTokens: 111,
        outputTokens: 222,
      },
      blockStatuses: {
        header: 'done',
      },
      blockInputTokens: {
        header: 333,
      },
      blockOutputTokens: {
        header: 444,
      },
      blockDurationMs: {
        header: 3200,
      },
      didApplySchema: true,
    });
  });

  it('produces a normalized modify snapshot for shared modify rendering', async () => {
    const client = new ScenarioAIClient([
      {
        type: 'modify:start',
        data: {
          operationCount: 2,
          explanation: '更新标题并追加说明',
          operations: [
            { op: 'schema.patchProps', label: '更新标题', nodeId: 'card-1' },
            { op: 'schema.insertNode', label: '追加说明', nodeId: 'container-1' },
          ],
        },
      },
      {
        type: 'modify:op:pending',
        data: {
          index: 0,
        },
      },
      {
        type: 'modify:op',
        data: {
          index: 0,
          operation: {
            op: 'schema.patchProps',
            nodeId: 'card-1',
            patch: { title: '新标题' },
          },
          metrics: {
            durationMs: 1800,
            inputTokens: 55,
            outputTokens: 66,
          },
        },
      },
      {
        type: 'modify:op',
        data: {
          index: 1,
          operation: {
            op: 'schema.insertNode',
            parentId: 'container-1',
            node: {
              id: 'text-1',
              component: 'Typography.Text',
              children: '说明',
            },
          },
          metrics: {
            durationMs: 2200,
            inputTokens: 77,
            outputTokens: 88,
          },
        },
      },
      {
        type: 'modify:done',
        data: {},
      },
      {
        type: 'done',
        data: {
          metadata: {
            sessionId: 'session-modify',
            durationMs: 4400,
          },
        },
      },
    ]);

    const result = await runPageExecution({
      aiClient: client,
      request: {
        prompt: '修改订单详情页',
        intent: 'schema.modify',
        context: {
          schemaSummary: 'pageId=order-detail',
          componentSummary: 'Container',
        },
      },
      initialMode: 'modify',
    });

    expect(result.snapshot).toMatchObject({
      mode: 'modify',
      modifyPlan: {
        operationCount: 2,
        operationLabels: ['更新标题', '追加说明'],
      },
      modifyStatuses: {
        0: 'done',
        1: 'done',
      },
      modifyOpMetrics: {
        0: {
          durationMs: 1800,
          inputTokens: 55,
          outputTokens: 66,
        },
        1: {
          durationMs: 2200,
          inputTokens: 77,
          outputTokens: 88,
        },
      },
      didApplySchema: true,
    });
    expect(result.modifyOperations).toHaveLength(2);
  });
});
