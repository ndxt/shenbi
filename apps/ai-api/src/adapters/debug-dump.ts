import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunRequest } from '@shenbi/ai-contracts';

export type InvalidJsonSource = 'planner' | 'block' | 'modify';

interface InvalidJsonDumpInput {
  source: InvalidJsonSource;
  rawOutput: string;
  summarizedOutput: string;
  request: Pick<RunRequest, 'prompt' | 'plannerModel' | 'blockModel' | 'thinking' | 'context'>;
  model: string;
}

interface ErrorDumpInput {
  category: 'http-error' | 'stream-error';
  error: unknown;
  requestId?: string;
  path?: string;
  method?: string;
  status?: number;
  code?: string | undefined;
  request?: unknown;
}

interface TraceDumpInput {
  status: 'success' | 'error';
  trace: unknown;
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

function toSerializable(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

export function writeErrorDump(input: ErrorDumpInput): string {
  const dumpDir = join(process.cwd(), '.ai-debug', 'errors');
  mkdirSync(dumpDir, { recursive: true });

  const filename = `${toSafeStamp(new Date())}-${input.category}.json`;
  const fullpath = join(dumpDir, filename);

  const error = input.error instanceof Error
    ? {
        name: input.error.name,
        message: input.error.message,
        stack: input.error.stack,
      }
    : {
        name: 'UnknownError',
        message: String(input.error),
      };

  writeFileSync(
    fullpath,
    JSON.stringify(
      {
        ts: new Date().toISOString(),
        category: input.category,
        requestId: input.requestId,
        method: input.method,
        path: input.path,
        status: input.status,
        code: input.code,
        error,
        request: toSerializable(input.request),
      },
      null,
      2,
    ),
    'utf8',
  );

  return join('.ai-debug', 'errors', filename);
}

export function writeTraceDump(input: TraceDumpInput): string {
  const dumpDir = join(process.cwd(), '.ai-debug', 'traces');
  mkdirSync(dumpDir, { recursive: true });

  const filename = `${toSafeStamp(new Date())}-${input.status}.json`;
  const fullpath = join(dumpDir, filename);

  writeFileSync(
    fullpath,
    JSON.stringify(
      {
        ts: new Date().toISOString(),
        status: input.status,
        trace: toSerializable(input.trace),
      },
      null,
      2,
    ),
    'utf8',
  );

  return join('.ai-debug', 'traces', filename);
}
