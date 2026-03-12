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

function getRequiredTool<TInput, TOutput>(
  deps: AgentRuntimeDeps,
  name: string,
): AgentTool<TInput, TOutput> {
  const tool = deps.tools.get(name);
  if (!tool) {
    throw new Error(`Missing required tool: ${name}`);
  }
  return tool as AgentTool<TInput, TOutput>;
}

interface PlanModifyResult {
  explanation: string;
  plannerMetrics: AgentOperationMetrics;
  simpleOps: Array<{ index: number; operation: AgentOperation }>;
  complexOps: Array<{ index: number; skeleton: unknown; label?: string }>;
  operationCount: number;
  operationSummaries: Array<{ op: string; label?: string; nodeId?: string }>;
}

interface ComplexOpResult {
  index: number;
  operation: AgentOperation;
  metrics: AgentOperationMetrics;
}

export async function* modifyOrchestrator(
  request: RunRequest,
  context: AgentRuntimeContext,
  deps: AgentRuntimeDeps,
  _metadata: RunMetadata,
): AsyncGenerator<AgentEvent> {
  const planModify = getRequiredTool<ModifySchemaInput, PlanModifyResult>(deps, 'planModify');
  const executeComplexOp = getRequiredTool<
    { skeleton: unknown; index: number; input: ModifySchemaInput },
    ComplexOpResult
  >(deps, 'executeComplexOp');

  yield { type: 'message:start', data: { role: 'assistant' } };
  yield { type: 'tool:start', data: { tool: 'modifySchema', label: 'Planning schema modifications' } };

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
