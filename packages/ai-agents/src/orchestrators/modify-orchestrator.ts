import type {
  AgentEvent,
  AgentRuntimeContext,
  AgentRuntimeDeps,
  AgentTool,
  ModifyResult,
  ModifySchemaInput,
  RunMetadata,
  RunRequest,
} from '../types';

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

export async function* modifyOrchestrator(
  request: RunRequest,
  context: AgentRuntimeContext,
  deps: AgentRuntimeDeps,
  _metadata: RunMetadata,
): AsyncGenerator<AgentEvent> {
  const modifySchema = getRequiredTool<ModifySchemaInput, ModifyResult>(deps, 'modifySchema');

  yield { type: 'message:start', data: { role: 'assistant' } };
  yield { type: 'tool:start', data: { tool: 'modifySchema', label: 'Planning schema modifications' } };

  const result = await modifySchema.execute({ request, context });

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
      operations: result.operations.map((o) => ({
        op: o.op,
        ...('nodeId' in o && o.nodeId ? { nodeId: o.nodeId } : {}),
      })),
    },
  };

  for (const [index, operation] of result.operations.entries()) {
    yield {
      type: 'modify:op',
      data: {
        index,
        operation,
      },
    };
  }

  yield { type: 'modify:done', data: {} };
}
