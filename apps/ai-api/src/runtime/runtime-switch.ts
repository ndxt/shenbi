import { createInMemoryAgentMemoryStore } from '@shenbi/ai-agents';
import { createMastraAgentRuntime } from '@shenbi/mastra-runtime';
import { logger } from '../adapters/logger.ts';
import { loadEnv } from '../adapters/env.ts';
import { createAgentRuntime, createLegacyRuntimeDeps } from './agent-runtime.ts';
import { prepareRunRequest } from './request-attachments.ts';
import type { AgentRuntime } from './types.ts';

export function createConfiguredRuntime(): AgentRuntime {
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
  return createMastraAgentRuntime({
    legacyRuntime,
    createDeps: () => createLegacyRuntimeDeps(sharedMemory),
    prepareRunRequest,
  });
}

export const configuredRuntime = createConfiguredRuntime();
