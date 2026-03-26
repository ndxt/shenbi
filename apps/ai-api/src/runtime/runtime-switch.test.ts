import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiApiService } from './types.ts';

function createFakeRuntime(): AiApiService {
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
    listModels() {
      return [];
    },
    writeClientDebug() {
      return '.ai-debug/errors/client-debug.json';
    },
    writeTraceDebug() {
      return '.ai-debug/traces/trace.json';
    },
    async *projectStream() {
      yield {
        type: 'project:start',
        data: {
          sessionId: 'project-session',
          conversationId: 'project-conversation',
          prompt: 'build project',
        },
      };
    },
    async confirmProject() {
      return { sessionId: 'project-session', status: 'executing' };
    },
    async reviseProject() {
      return { sessionId: 'project-session', status: 'awaiting_confirmation' };
    },
    async cancelProject() {
      return { sessionId: 'project-session', status: 'cancelled' };
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
    const createMastraAiService = vi.fn((_options: unknown) => mastraRuntime);
    const prepareRunRequest = vi.fn(async (request) => request);

    vi.doMock('@shenbi/ai-agents', () => ({
      createInMemoryAgentMemoryStore,
    }));
    vi.doMock('@shenbi/mastra-runtime', () => ({
      createMastraAiService,
    }));
    vi.doMock('../adapters/debug-dump.ts', () => ({
      writeErrorDump: vi.fn(() => '.ai-debug/errors/client-debug.json'),
      writeMemoryDump: vi.fn(() => '.ai-debug/memory/test-finalize.json'),
      writeTraceDump: vi.fn(() => '.ai-debug/traces/trace.json'),
    }));
    vi.doMock('../adapters/providers.ts', () => ({
      getAvailableModels: vi.fn(() => []),
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
    expect(createMastraAiService).not.toHaveBeenCalled();
  });

  it('wraps the legacy runtime with mastra when AI_RUNTIME=mastra', async () => {
    const sharedMemory = { kind: 'memory' };
    const legacyRuntime = createFakeRuntime();
    const mastraRuntime = createFakeRuntime();
    const legacyDeps = { deps: 'legacy' };
    const createInMemoryAgentMemoryStore = vi.fn(() => sharedMemory);
    const createAgentRuntime = vi.fn(() => legacyRuntime);
    const createLegacyRuntimeDeps = vi.fn(() => legacyDeps);
    const createMastraAiService = vi.fn((_options: unknown) => mastraRuntime);
    const prepareRunRequest = vi.fn(async (request) => request);

    vi.doMock('@shenbi/ai-agents', () => ({
      createInMemoryAgentMemoryStore,
    }));
    vi.doMock('@shenbi/mastra-runtime', () => ({
      createMastraAiService,
    }));
    const writeMemoryDump = vi.fn(() => '.ai-debug/memory/test-finalize.json');
    const writeErrorDump = vi.fn(() => '.ai-debug/errors/client-debug.json');
    const writeTraceDump = vi.fn(() => '.ai-debug/traces/trace.json');
    vi.doMock('../adapters/debug-dump.ts', () => ({
      writeErrorDump,
      writeMemoryDump,
      writeTraceDump,
    }));
    const getAvailableModels = vi.fn(() => []);
    vi.doMock('../adapters/providers.ts', () => ({
      getAvailableModels,
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
    expect(createMastraAiService).toHaveBeenCalledOnce();
    const options = createMastraAiService.mock.calls[0]?.[0] as (
        | {
          legacyRuntime: AiApiService;
          prepareRunRequest: typeof prepareRunRequest;
          createDeps: () => unknown;
          writeMemoryDump: typeof writeMemoryDump;
          listModels: () => unknown;
          writeClientDebug: (input: { error: unknown; requestId?: string }) => string;
          writeTraceDebug: (input: { status: 'success' | 'error'; trace: unknown }) => string;
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
    expect(options.writeMemoryDump).toBe(writeMemoryDump);
    expect(options.listModels()).toEqual([]);
    expect(getAvailableModels).toHaveBeenCalledOnce();
    expect(options.writeClientDebug({
      error: 'boom',
      requestId: 'req-1',
    })).toBe('.ai-debug/errors/client-debug.json');
    expect(writeErrorDump).toHaveBeenCalledWith(expect.objectContaining({
      category: 'client-debug',
      requestId: 'req-1',
    }));
    expect(options.writeTraceDebug({
      status: 'success',
      trace: { step: 1 },
    })).toBe('.ai-debug/traces/trace.json');
    expect(writeTraceDump).toHaveBeenCalledWith({
      status: 'success',
      trace: { step: 1 },
    });
    expect(createLegacyRuntimeDeps).toHaveBeenCalledWith(sharedMemory);
  });
});
