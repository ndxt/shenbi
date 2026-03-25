import type { AgentOperation, AgentOperationMetrics } from '@shenbi/ai-contracts';
import type { ModifyResult } from '../types';

export interface PlanInsertNodeSkeleton {
  op: 'schema.insertNode';
  parentId?: string;
  container?: 'body' | 'dialogs';
  index?: number;
  description?: string;
  components?: string[];
  node?: unknown;
  label?: string;
}

export type PlanOperation = AgentOperation | PlanInsertNodeSkeleton;

export interface PlanResult {
  explanation: string;
  operations: PlanOperation[];
}

export interface PlanModifyResult {
  explanation: string;
  plannerMetrics: AgentOperationMetrics;
  simpleOps: Array<{ index: number; operation: AgentOperation }>;
  complexOps: Array<{ index: number; skeleton: PlanInsertNodeSkeleton; label?: string }>;
  operationCount: number;
  operationSummaries: Array<{ op: string; label?: string; nodeId?: string }>;
}

export interface ComplexOpResult {
  index: number;
  operation: AgentOperation;
  metrics: AgentOperationMetrics;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isPlanResult(value: unknown): value is PlanResult {
  if (!isRecord(value) || typeof value.explanation !== 'string' || !Array.isArray(value.operations)) {
    return false;
  }
  return value.operations.every((operation) => isRecord(operation) && typeof operation.op === 'string');
}

export function needsPhase2(op: PlanOperation): op is PlanInsertNodeSkeleton {
  if (op.op !== 'schema.insertNode') {
    return false;
  }
  const insert = op as PlanInsertNodeSkeleton;
  if (insert.description && Array.isArray(insert.components) && insert.components.length > 0) {
    return true;
  }
  if (!insert.node) {
    return true;
  }
  return false;
}

export function summarizePlannedOperation(operation: {
  op: string;
  label?: string;
  nodeId?: string;
}): {
  op: string;
  label?: string;
  nodeId?: string;
} {
  return {
    op: operation.op,
    ...(typeof operation.label === 'string' && operation.label ? { label: operation.label } : {}),
    ...(typeof operation.nodeId === 'string' && operation.nodeId ? { nodeId: operation.nodeId } : {}),
  };
}

export function buildSimpleOperationMetrics(
  plannerMetrics: AgentOperationMetrics,
  simpleCount: number,
): AgentOperationMetrics {
  const divisor = Math.max(simpleCount, 1);
  return {
    ...(plannerMetrics.durationMs !== undefined ? { durationMs: Math.round(plannerMetrics.durationMs / divisor) } : {}),
    ...(plannerMetrics.inputTokens !== undefined ? { inputTokens: Math.round(plannerMetrics.inputTokens / divisor) } : {}),
    ...(plannerMetrics.outputTokens !== undefined ? { outputTokens: Math.round(plannerMetrics.outputTokens / divisor) } : {}),
    ...(plannerMetrics.tokensUsed !== undefined ? { tokensUsed: Math.round(plannerMetrics.tokensUsed / divisor) } : {}),
  };
}

export function splitPlannedOperations(
  plan: PlanResult,
  plannerMetrics: AgentOperationMetrics,
): PlanModifyResult {
  const simpleCount = plan.operations.filter((operation) => !needsPhase2(operation)).length;
  const simpleMetrics = buildSimpleOperationMetrics(plannerMetrics, simpleCount);
  const simpleOps: Array<{ index: number; operation: AgentOperation }> = [];
  const complexOps: Array<{ index: number; skeleton: PlanInsertNodeSkeleton; label?: string }> = [];

  for (const [index, operation] of plan.operations.entries()) {
    if (needsPhase2(operation)) {
      complexOps.push({
        index,
        skeleton: operation,
        ...(operation.label ? { label: operation.label } : {}),
      });
      continue;
    }

    simpleOps.push({
      index,
      operation: { ...operation, _metrics: simpleMetrics } as AgentOperation,
    });
  }

  return {
    explanation: plan.explanation,
    plannerMetrics,
    simpleOps,
    complexOps,
    operationCount: plan.operations.length,
    operationSummaries: plan.operations.map((operation) => summarizePlannedOperation(operation)),
  };
}

export function mergePlannedOperations(
  plannedOperations: PlanOperation[],
  simpleOps: Array<{ index: number; operation: AgentOperation }>,
  executedOps: Array<{ index: number; operation: AgentOperation }>,
): AgentOperation[] {
  const simpleByIndex = new Map(simpleOps.map((entry) => [entry.index, entry.operation]));
  const executedByIndex = new Map(executedOps.map((entry) => [entry.index, entry.operation]));
  const merged: AgentOperation[] = [];

  for (const [index] of plannedOperations.entries()) {
    const executed = executedByIndex.get(index);
    if (executed) {
      merged.push(executed);
      continue;
    }
    const simple = simpleByIndex.get(index);
    if (simple) {
      merged.push(simple);
    }
  }

  return merged;
}

export function createModifyResult(
  explanation: string,
  operations: AgentOperation[],
): ModifyResult {
  return {
    explanation,
    operations,
  };
}
