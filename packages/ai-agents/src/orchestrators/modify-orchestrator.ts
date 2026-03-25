import type {
  AgentEvent,
  AgentOperation,
  AgentRuntimeContext,
  AgentRuntimeDeps,
  AgentTool,
  ModifySchemaInput,
  RunMetadata,
  RunRequest,
} from '../types';
import type { AgentOperationMetrics } from '@shenbi/ai-contracts';
import {
  summarizePlannedOperation,
  type ComplexOpResult,
  type PlanModifyResult,
} from './modify-planning';

interface LegacyModifySchemaResult {
  explanation: string;
  operations: AgentOperation[];
}

export async function* modifyOrchestrator(
  request: RunRequest,
  context: AgentRuntimeContext,
  deps: AgentRuntimeDeps,
  _metadata: RunMetadata,
): AsyncGenerator<AgentEvent> {
  const legacyModifySchema = deps.tools.get('modifySchema') as AgentTool<ModifySchemaInput, LegacyModifySchemaResult> | undefined;
  const planModify = deps.tools.get('planModify') as AgentTool<ModifySchemaInput, PlanModifyResult> | undefined;
  const executeComplexOp = deps.tools.get('executeComplexOp') as AgentTool<
    { skeleton: unknown; index: number; input: ModifySchemaInput },
    ComplexOpResult
  > | undefined;

  yield { type: 'message:start', data: { role: 'assistant' } };
  yield { type: 'tool:start', data: { tool: 'modifySchema', label: 'Planning schema modifications' } };

  if (!planModify || !executeComplexOp) {
    if (!legacyModifySchema) {
      throw new Error('Missing required tool: modifySchema');
    }

    const result = await legacyModifySchema.execute({ request, context });
    const operationSummaries = result.operations.map((operation) => summarizePlannedOperation(operation));

    yield {
      type: 'tool:result',
      data: {
        tool: 'modifySchema',
        ok: true,
        summary: `Prepared ${result.operations.length} schema operations.`,
      },
    };
    yield { type: 'message:delta', data: { text: result.explanation } };
    yield {
      type: 'modify:start',
      data: {
        operationCount: result.operations.length,
        explanation: result.explanation,
        operations: operationSummaries,
      },
    };
    for (const [index, operation] of result.operations.entries()) {
      yield {
        type: 'modify:op',
        data: {
          index,
          operation,
          ...('_metrics' in operation && operation._metrics ? { metrics: operation._metrics as AgentOperationMetrics } : {}),
        },
      };
    }
    yield { type: 'modify:done', data: {} };
    return;
  }

  // ---- Phase 1 ----
  const plan = await planModify.execute({ request, context });

  yield {
    type: 'tool:result',
    data: {
      tool: 'modifySchema',
      ok: true,
      summary: `Planned ${plan.operationCount} schema operations.`,
    },
  };
  yield { type: 'message:delta', data: { text: plan.explanation } };

  // ---- Show all op labels to the user immediately ----
  yield {
    type: 'modify:start',
    data: {
      operationCount: plan.operationCount,
      explanation: plan.explanation,
      operations: plan.operationSummaries,
    },
  };

  // ---- Index simple ops for in-order emission ----
  const simpleByIndex = new Map<number, AgentOperation>(
    plan.simpleOps.map((s) => [s.index, s.operation]),
  );

  // ---- Kick off Phase 2 calls concurrently; mark each as pending first ----
  const complexTasks = new Map<number, Promise<ComplexOpResult>>();
  for (const complex of plan.complexOps) {
    // Signal to frontend: this op is loading (Phase 2 running)
    yield {
      type: 'modify:op:pending',
      data: { index: complex.index, ...(complex.label ? { label: complex.label } : {}) },
    };
    complexTasks.set(
      complex.index,
      executeComplexOp.execute({ skeleton: complex.skeleton, index: complex.index, input: { request, context } }),
    );
  }

  // ---- Emit ops in original plan order ----
  for (let i = 0; i < plan.operationCount; i++) {
    const simpleOp = simpleByIndex.get(i);
    if (simpleOp !== undefined) {
      // Simple op: already done (executed via Phase 1 plan)
      yield {
        type: 'modify:op',
        data: {
          index: i,
          operation: simpleOp,
          ...('_metrics' in simpleOp && simpleOp._metrics ? { metrics: simpleOp._metrics as AgentOperationMetrics } : {}),
        },
      };
    } else {
      // Complex op: wait for Phase 2 LLM result
      const task = complexTasks.get(i);
      if (task !== undefined) {
        const result = await task;
        yield {
          type: 'modify:op',
          data: {
            index: result.index,
            operation: result.operation,
            ...(Object.keys(result.metrics).length > 0 ? { metrics: result.metrics } : {}),
          },
        };
      }
    }
  }

  yield { type: 'modify:done', data: {} };
}
