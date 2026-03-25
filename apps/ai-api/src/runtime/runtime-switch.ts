import { createInMemoryAgentMemoryStore } from '@shenbi/ai-agents';
import { createMastraAgentRuntime } from '@shenbi/mastra-runtime';
import { loadEnv } from '../adapters/env.ts';
import { createAgentRuntime, createLegacyRuntimeDeps } from './agent-runtime.ts';
import { prepareRunRequest } from './request-attachments.ts';
import type { AgentRuntime } from './types.ts';

export function createConfiguredRuntime(): AgentRuntime {
  const env = loadEnv();
  const sharedMemory = createInMemoryAgentMemoryStore();
  const legacyRuntime = createAgentRuntime(sharedMemory);

  if (env.AI_RUNTIME !== 'mastra') {
    return legacyRuntime;
  }

  return createMastraAgentRuntime({
    legacyRuntime,
    createDeps: () => createLegacyRuntimeDeps(sharedMemory),
    prepareRunRequest,
  });
}

export const configuredRuntime = createConfiguredRuntime();
