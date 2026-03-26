import { createInMemoryAgentMemoryStore } from '@shenbi/ai-agents';
import { createMastraAiService } from '@shenbi/mastra-runtime';
import { writeErrorDump, writeMemoryDump, writeTraceDump } from '../adapters/debug-dump.ts';
import { logger } from '../adapters/logger.ts';
import { loadEnv } from '../adapters/env.ts';
import { getAvailableModels } from '../adapters/providers.ts';
import { createAgentRuntime, createLegacyRuntimeDeps } from './agent-runtime.ts';
import { prepareRunRequest } from './request-attachments.ts';
import type { AiApiService } from './types.ts';

export function createConfiguredRuntime(): AiApiService {
  const env = loadEnv();
  const sharedMemory = createInMemoryAgentMemoryStore();
  const legacyRuntime = createAgentRuntime(sharedMemory);

  if (env.AI_RUNTIME !== 'mastra') {
    logger.info('ai.runtime.selected', {
      runtime: 'legacy',
    });
    return legacyRuntime;
  }

  logger.info('ai.runtime.selected', {
    runtime: 'mastra',
  });
  return createMastraAiService({
    legacyRuntime,
    createDeps: () => createLegacyRuntimeDeps(sharedMemory),
    prepareRunRequest,
    writeMemoryDump,
    listModels: () => getAvailableModels(),
    writeClientDebug: (input) => writeErrorDump({
      category: 'client-debug',
      error: input.error,
      status: 200,
      code: 'CLIENT_DEBUG_DUMP',
      ...(input.requestId !== undefined ? { requestId: input.requestId } : {}),
      ...(input.method !== undefined ? { method: input.method } : {}),
      ...(input.path !== undefined ? { path: input.path } : {}),
      ...(input.request !== undefined ? { request: input.request } : {}),
    }),
    writeTraceDebug: (input) => writeTraceDump(input),
  });
}

export const configuredRuntime = createConfiguredRuntime();
