import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentRuntime } from './types.ts';

function createFakeRuntime(): AgentRuntime {
  return {
    async run() {
      return {
        events: [],
        metadata: {
          sessionId: 'test-session',
        },
      };
    },
    async *runStream() {
      yield* [];
    },
    async chat() {
      return { content: 'ok' };
    },
    async *chatStream() {
      yield { delta: 'ok' };
    },
    async classifyRoute() {
      return { scope: 'single-page', intent: 'schema.create', confidence: 0.9 };
    },
    async finalize() {
      return {};
    },
  };
}

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('configuredRuntime', () => {
  it('returns the legacy runtime when AI_RUNTIME=legacy', async () => {
    const sharedMemory = { kind: 'memory' };
    const legacyRuntime = createFakeRuntime();
    const mastraRuntime = createFakeRuntime();
    const createInMemoryAgentMemoryStore = vi.fn(() => sharedMemory);
    const createAgentRuntime = vi.fn(() => legacyRuntime);
    const createLegacyRuntimeDeps = vi.fn(() => ({ deps: 'legacy' }));
    const createMastraAgentRuntime = vi.fn((_options: unknown) => mastraRuntime);
    const prepareRunRequest = vi.fn(async (request) => request);

    vi.doMock('@shenbi/ai-agents', () => ({
      createInMemoryAgentMemoryStore,
    }));
    vi.doMock('@shenbi/mastra-runtime', () => ({
      createMastraAgentRuntime,
    }));
    vi.doMock('../adapters/env.ts', () => ({
      loadEnv: () => ({
        AI_RUNTIME: 'legacy',
      }),
    }));
    vi.doMock('./agent-runtime.ts', () => ({
      createAgentRuntime,
      createLegacyRuntimeDeps,
    }));
    vi.doMock('./request-attachments.ts', () => ({
      prepareRunRequest,
    }));

    const runtimeModule = await import('./runtime-switch.ts');

    expect(runtimeModule.configuredRuntime).toBe(legacyRuntime);
    expect(createInMemoryAgentMemoryStore).toHaveBeenCalledOnce();
    expect(createAgentRuntime).toHaveBeenCalledWith(sharedMemory);
    expect(createMastraAgentRuntime).not.toHaveBeenCalled();
  });

  it('wraps the legacy runtime with mastra when AI_RUNTIME=mastra', async () => {
    const sharedMemory = { kind: 'memory' };
    const legacyRuntime = createFakeRuntime();
    const mastraRuntime = createFakeRuntime();
    const legacyDeps = { deps: 'legacy' };
    const createInMemoryAgentMemoryStore = vi.fn(() => sharedMemory);
    const createAgentRuntime = vi.fn(() => legacyRuntime);
    const createLegacyRuntimeDeps = vi.fn(() => legacyDeps);
    const createMastraAgentRuntime = vi.fn((_options: unknown) => mastraRuntime);
    const prepareRunRequest = vi.fn(async (request) => request);

    vi.doMock('@shenbi/ai-agents', () => ({
      createInMemoryAgentMemoryStore,
    }));
    vi.doMock('@shenbi/mastra-runtime', () => ({
      createMastraAgentRuntime,
    }));
    vi.doMock('../adapters/env.ts', () => ({
      loadEnv: () => ({
        AI_RUNTIME: 'mastra',
      }),
    }));
    vi.doMock('./agent-runtime.ts', () => ({
      createAgentRuntime,
      createLegacyRuntimeDeps,
    }));
    vi.doMock('./request-attachments.ts', () => ({
      prepareRunRequest,
    }));

    const runtimeModule = await import('./runtime-switch.ts');

    expect(runtimeModule.configuredRuntime).toBe(mastraRuntime);
    expect(createMastraAgentRuntime).toHaveBeenCalledOnce();
    const options = createMastraAgentRuntime.mock.calls[0]?.[0] as (
      | {
          legacyRuntime: AgentRuntime;
          prepareRunRequest: typeof prepareRunRequest;
          createDeps: () => unknown;
        }
      | undefined
    );
    expect(options).toBeDefined();
    if (!options) {
      throw new Error('Mastra runtime options were not captured');
    }
    expect(options.legacyRuntime).toBe(legacyRuntime);
    expect(options.prepareRunRequest).toBe(prepareRunRequest);
    expect(options.createDeps()).toBe(legacyDeps);
    expect(createLegacyRuntimeDeps).toHaveBeenCalledWith(sharedMemory);
  });
});
