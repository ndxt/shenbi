import { describe, expect, it } from 'vitest';
import type { AgentOperation } from '@shenbi/ai-contracts';
import {
  buildSimpleOperationMetrics,
  createModifyResult,
  isPlanResult,
  mergePlannedOperations,
  needsPhase2,
  splitPlannedOperations,
  type PlanResult,
} from './modify-planning';

describe('modify-planning', () => {
  it('recognizes plan results and detects complex insert-node skeletons', () => {
    const plan: PlanResult = {
      explanation: '修改标题并插入按钮',
      operations: [
        {
          op: 'schema.patchProps',
          nodeId: 'card-1',
          patch: { title: '新标题' },
        },
        {
          op: 'schema.insertNode',
          parentId: 'card-1',
          description: '插入一个主要操作按钮',
          components: ['Button'],
        },
      ],
    };

    expect(isPlanResult(plan)).toBe(true);
    expect(needsPhase2(plan.operations[1]!)).toBe(true);
  });

  it('splits planned operations into simple and complex groups with distributed planner metrics', () => {
    const plan: PlanResult = {
      explanation: '修改标题并插入按钮',
      operations: [
        {
          op: 'schema.patchProps',
          nodeId: 'card-1',
          patch: { title: '新标题' },
        },
        {
          op: 'schema.insertNode',
          parentId: 'card-1',
          description: '插入一个主要操作按钮',
          components: ['Button'],
        },
      ],
    };

    const result = splitPlannedOperations(plan, {
      durationMs: 120,
      inputTokens: 60,
      outputTokens: 30,
      tokensUsed: 90,
    });

    expect(result.operationCount).toBe(2);
    expect(result.simpleOps).toHaveLength(1);
    expect(result.complexOps).toHaveLength(1);
    expect(result.simpleOps[0]?.operation).toMatchObject({
      op: 'schema.patchProps',
      nodeId: 'card-1',
      _metrics: {
        durationMs: 120,
        inputTokens: 60,
        outputTokens: 30,
        tokensUsed: 90,
      },
    });
  });

  it('merges executed complex operations back into original planner order', () => {
    const planned: PlanResult['operations'] = [
      {
        op: 'schema.patchProps',
        nodeId: 'card-1',
        patch: { title: '新标题' },
      },
      {
        op: 'schema.insertNode',
        parentId: 'card-1',
        description: '插入一个主要操作按钮',
        components: ['Button'],
      },
      {
        op: 'schema.removeNode',
        nodeId: 'old-card',
      },
    ];

    const simpleOps: Array<{ index: number; operation: AgentOperation }> = [
      {
        index: 0,
        operation: {
          op: 'schema.patchProps',
          nodeId: 'card-1',
          patch: { title: '新标题' },
        },
      },
      {
        index: 2,
        operation: {
          op: 'schema.removeNode',
          nodeId: 'old-card',
        },
      },
    ];
    const executedOps: Array<{ index: number; operation: AgentOperation }> = [
      {
        index: 1,
        operation: {
          op: 'schema.insertNode',
          parentId: 'card-1',
          node: {
            id: 'add-btn',
            component: 'Button',
            children: ['新增'],
          },
        },
      },
    ];

    expect(mergePlannedOperations(planned, simpleOps, executedOps).map((item) => item.op)).toEqual([
      'schema.patchProps',
      'schema.insertNode',
      'schema.removeNode',
    ]);
  });

  it('creates modify results and evenly distributes metrics when no simple ops exist', () => {
    expect(buildSimpleOperationMetrics({
      durationMs: 90,
      inputTokens: 30,
      outputTokens: 15,
      tokensUsed: 45,
    }, 0)).toEqual({
      durationMs: 90,
      inputTokens: 30,
      outputTokens: 15,
      tokensUsed: 45,
    });

    expect(createModifyResult('done', [])).toEqual({
      explanation: 'done',
      operations: [],
    });
  });
});
