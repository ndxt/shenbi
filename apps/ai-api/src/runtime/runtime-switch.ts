import { createInMemoryAgentMemoryStore } from '@shenbi/ai-agents';
import { createMastraAiService } from '@shenbi/mastra-runtime';
import { writeErrorDump, writeMemoryDump, writeTraceDump } from '../adapters/debug-dump.ts';
import { logger } from '../adapters/logger.ts';
import { loadEnv } from '../adapters/env.ts';
import { getAvailableModels } from '../adapters/providers.ts';
import { createMastraRuntimeDeps } from './agent-runtime.ts';
import { prepareRunRequest } from './request-attachments.ts';
import type { AiApiService } from './types.ts';

function createRetiredLegacyRuntime(): AiApiService {
  const unsupported = async () => {
    throw new Error('Legacy runtime has been retired');
  };

  return {
    run: unsupported,
    runStream: async function* () {
      throw new Error('Legacy runtime has been retired');
    },
    chat: unsupported,
    chatStream: async function* () {
      throw new Error('Legacy runtime has been retired');
    },
    classifyRoute: unsupported,
    finalize: unsupported,
    listModels: () => [],
    writeClientDebug: () => '.ai-debug/errors/legacy-runtime-retired.json',
    writeTraceDebug: () => '.ai-debug/traces/legacy-runtime-retired.json',
    projectStream: async function* () {
      throw new Error('Legacy runtime has been retired');
    },
    confirmProject: unsupported,
    reviseProject: unsupported,
    cancelProject: unsupported,
  };
}

export function createConfiguredRuntime(): AiApiService {
  const env = loadEnv();
  const sharedMemory = createInMemoryAgentMemoryStore();

  logger.info('ai.runtime.selected', {
    runtime: 'mastra',
    requestedRuntime: env.AI_RUNTIME,
  });
  return createMastraAiService({
    legacyRuntime: createRetiredLegacyRuntime(),
    createDeps: () => createMastraRuntimeDeps(sharedMemory),
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
