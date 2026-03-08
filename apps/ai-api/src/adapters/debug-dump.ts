import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunRequest } from '@shenbi/ai-contracts';

export type InvalidJsonSource = 'planner' | 'block';

interface InvalidJsonDumpInput {
  source: InvalidJsonSource;
  rawOutput: string;
  summarizedOutput: string;
  request: Pick<RunRequest, 'prompt' | 'plannerModel' | 'blockModel' | 'thinking' | 'context'>;
  model: string;
}

function toSafeStamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

export function writeInvalidJsonDump(input: InvalidJsonDumpInput): string {
  const dumpDir = join(process.cwd(), '.ai-debug', 'invalid-json');
  mkdirSync(dumpDir, { recursive: true });

  const filename = `${toSafeStamp(new Date())}-${input.source}.json`;
  const fullpath = join(dumpDir, filename);

  writeFileSync(
    fullpath,
    JSON.stringify(
      {
        ts: new Date().toISOString(),
        source: input.source,
        model: input.model,
        prompt: input.request.prompt,
        plannerModel: input.request.plannerModel,
        blockModel: input.request.blockModel,
        thinking: input.request.thinking,
        context: input.request.context,
        summarizedOutput: input.summarizedOutput,
        rawOutput: input.rawOutput,
      },
      null,
      2,
    ),
    'utf8',
  );

  return join('.ai-debug', 'invalid-json', filename);
}
