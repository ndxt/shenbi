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

interface SkeletonSchemaInput {
  plan: PagePlan;
  request: RunRequest;
}

interface CompletedBlock {
  blockId: string;
  generated: GenerateBlockResult;
}

interface PendingBlockTask {
  blockId: string;
  task: Promise<CompletedBlock>;
}

function summarizePlacement(plan: PagePlan, blockId: string): string {
  const layout = plan.layout ?? [{ blocks: plan.blocks.map((block) => block.id) }];

  for (const [rowIndex, row] of layout.entries()) {
    if ('blocks' in row) {
      const blockIndex = row.blocks.indexOf(blockId);
      if (blockIndex >= 0) {
        return row.blocks.length === 1
          ? `第 ${rowIndex + 1} 行，满宽区域`
          : `第 ${rowIndex + 1} 行，第 ${blockIndex + 1} 个纵向堆叠区域`;
      }
      continue;
    }

    for (const [columnIndex, column] of row.columns.entries()) {
      const blockIndex = column.blocks.indexOf(blockId);
      if (blockIndex >= 0) {
        return [
          `第 ${rowIndex + 1} 行`,
          `第 ${columnIndex + 1} 列`,
          `宽度 ${column.span}/24`,
          column.blocks.length > 1 ? `列内第 ${blockIndex + 1} 个区块` : '列内唯一区块',
        ].join('，');
      }
    }
  }

  return '默认纵向堆叠区域';
}

function createSemaphore(limit: number) {
  let available = limit;
  const waiters: Array<() => void> = [];

  return {
    async acquire(): Promise<() => void> {
      if (available > 0) {
        available -= 1;
      } else {
        await new Promise<void>((resolve) => {
          waiters.push(() => {
            available -= 1;
            resolve();
          });
        });
      }

      return () => {
        available += 1;
        const next = waiters.shift();
        next?.();
      };
    },
  };
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
  const buildSkeletonSchema = getRequiredTool<SkeletonSchemaInput, PageSchema>(deps, 'buildSkeletonSchema');
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

  yield { type: 'tool:start', data: { tool: 'buildSkeletonSchema', label: 'Building page skeleton' } };
  const skeletonSchema = await buildSkeletonSchema.execute({ plan, request });
  yield {
    type: 'tool:result',
    data: { tool: 'buildSkeletonSchema', ok: true, summary: `Prepared ${plan.blocks.length} skeleton blocks.` },
  };
  yield { type: 'schema:skeleton', data: { schema: skeletonSchema } };

  const blocks = new Map<string, GenerateBlockResult>();
  const concurrency = Math.min(8, Math.max(1, request.blockConcurrency ?? 3));
  const semaphore = createSemaphore(concurrency);
  const pending = new Map<string, PendingBlockTask>();
  for (const [index, block] of plan.blocks.entries()) {
    yield { type: 'schema:block:start', data: { blockId: block.id, description: block.description } };
    yield {
      type: 'tool:start',
      data: { tool: 'generateBlock', label: `Generating ${block.description}` },
    };

    const task = (async (): Promise<CompletedBlock> => {
      const release = await semaphore.acquire();
      try {
        const generated = await generateBlock.execute({
          block,
          request,
          context,
          pageTitle: plan.pageTitle,
          blockIndex: index,
          placementSummary: summarizePlacement(plan, block.id),
        } as GenerateBlockInput);
        return { blockId: block.id, generated };
      } finally {
        release();
      }
    })();
    pending.set(block.id, { blockId: block.id, task });
  }

  while (pending.size > 0) {
    const completed = await Promise.race(
      [...pending.values()].map(async ({ blockId, task }) => ({
        blockId,
        result: await task,
      })),
    );
    pending.delete(completed.blockId);
    blocks.set(completed.blockId, completed.result.generated);
    yield {
      type: 'tool:result',
      data: { tool: 'generateBlock', ok: true, summary: completed.result.generated.summary ?? completed.result.blockId },
    };
    yield {
      type: 'schema:block',
      data: {
        blockId: completed.result.blockId,
        node: completed.result.generated.node,
        ...(completed.result.generated.tokensUsed !== undefined ? { tokensUsed: completed.result.generated.tokensUsed } : {}),
        ...(completed.result.generated.inputTokens !== undefined ? { inputTokens: completed.result.generated.inputTokens } : {}),
        ...(completed.result.generated.outputTokens !== undefined ? { outputTokens: completed.result.generated.outputTokens } : {}),
        ...(completed.result.generated.durationMs !== undefined ? { durationMs: completed.result.generated.durationMs } : {}),
      },
    };
  }

  yield { type: 'tool:start', data: { tool: 'assembleSchema', label: 'Assembling page schema' } };
  let finalSchema = await assembleSchema.execute({ plan, blocks: [...blocks.values()], request });
  yield {
    type: 'tool:result',
    data: { tool: 'assembleSchema', ok: true, summary: `Assembled ${blocks.size} blocks.` },
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
}
