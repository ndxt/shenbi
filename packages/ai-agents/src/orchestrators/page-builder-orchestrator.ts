import type { PageSchema } from '@shenbi/schema';
import type {
  AgentEvent,
  AgentRuntimeContext,
  AgentRuntimeDeps,
  AgentTool,
  AssembleSchemaInput,
  GenerateBlockInput,
  GenerateBlockResult,
  PagePlan,
  PlanPageInput,
  RepairSchemaInput,
  RepairSchemaResult,
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

function isRepairSchemaResult(value: PageSchema | RepairSchemaResult): value is RepairSchemaResult {
  return Boolean(value) && typeof value === 'object' && 'schema' in value;
}

export async function* pageBuilderOrchestrator(
  request: RunRequest,
  context: AgentRuntimeContext,
  deps: AgentRuntimeDeps,
  metadata: RunMetadata,
): AsyncGenerator<AgentEvent> {
  const planPage = getRequiredTool<PlanPageInput, PagePlan>(deps, 'planPage');
  const generateBlock = getRequiredTool<GenerateBlockInput, GenerateBlockResult>(deps, 'generateBlock');
  const assembleSchema = getRequiredTool<AssembleSchemaInput, PageSchema>(deps, 'assembleSchema');
  const repairSchema = deps.tools.get('repairSchema') as
    | AgentTool<RepairSchemaInput, PageSchema | RepairSchemaResult>
    | undefined;

  yield { type: 'message:start', data: { role: 'assistant' } };
  yield { type: 'message:delta', data: { text: 'Planning page structure.' } };

  yield { type: 'tool:start', data: { tool: 'planPage', label: 'Planning page' } };
  const plan = await planPage.execute({ request, context });
  yield {
    type: 'tool:result',
    data: { tool: 'planPage', ok: true, summary: `Planned ${plan.blocks.length} blocks.` },
  };
  yield { type: 'plan', data: plan };

  const blocks: GenerateBlockResult[] = [];
  for (const block of plan.blocks) {
    yield { type: 'tool:start', data: { tool: 'generateBlock', label: `Generating ${block.type}` } };
    const generated = await generateBlock.execute({ block, request, context });
    blocks.push(generated);
    yield {
      type: 'tool:result',
      data: { tool: 'generateBlock', ok: true, summary: generated.summary ?? generated.blockId },
    };
    yield { type: 'schema:block', data: { blockId: generated.blockId, node: generated.node } };
  }

  yield { type: 'tool:start', data: { tool: 'assembleSchema', label: 'Assembling page schema' } };
  let finalSchema = await assembleSchema.execute({ plan, blocks, request });
  yield {
    type: 'tool:result',
    data: { tool: 'assembleSchema', ok: true, summary: `Assembled ${blocks.length} blocks.` },
  };

  if (repairSchema) {
    yield { type: 'tool:start', data: { tool: 'repairSchema', label: 'Repairing schema' } };
    const repaired = await repairSchema.execute({ schema: finalSchema, request });
    const repairResult = isRepairSchemaResult(repaired) ? repaired : { schema: repaired };
    finalSchema = repairResult.schema;
    if (repairResult.repairs?.length) {
      metadata.repairs = repairResult.repairs;
    }
    yield {
      type: 'tool:result',
      data: { tool: 'repairSchema', ok: true, summary: `Repairs: ${repairResult.repairs?.length ?? 0}` },
    };
  }

  yield { type: 'schema:done', data: { schema: finalSchema } };
  yield { type: 'done', data: { metadata } };
}
