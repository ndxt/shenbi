import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('configuredRuntime', () => {
  it('always creates the mastra runtime, even when AI_RUNTIME=legacy', async () => {
    const sharedMemory = { kind: 'memory' };
    const mastraRuntime = { kind: 'mastra-runtime' };
    const createInMemoryAgentMemoryStore = vi.fn(() => sharedMemory);
    const createMastraRuntimeDeps = vi.fn(() => ({ deps: 'mastra' }));
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
        AI_RUNTIME: 'legacy',
      }),
    }));
    vi.doMock('./agent-runtime.ts', () => ({
      createMastraRuntimeDeps,
    }));
    vi.doMock('./request-attachments.ts', () => ({
      prepareRunRequest,
    }));

    const runtimeModule = await import('./runtime-switch.ts');

    expect(runtimeModule.configuredRuntime).toBe(mastraRuntime);
    expect(createMastraAiService).toHaveBeenCalledOnce();
    const options = createMastraAiService.mock.calls[0]?.[0] as {
      legacyRuntime: {
        run: () => Promise<unknown>;
        runStream: () => AsyncIterable<unknown>;
        chat: () => Promise<unknown>;
      };
      createDeps: () => unknown;
      prepareRunRequest: typeof prepareRunRequest;
      writeMemoryDump: typeof writeMemoryDump;
      listModels: () => unknown;
      writeClientDebug: (input: { error: unknown; requestId?: string }) => string;
      writeTraceDebug: (input: { status: 'success' | 'error'; trace: unknown }) => string;
    };

    expect(options.createDeps()).toEqual({ deps: 'mastra' });
    expect(options.prepareRunRequest).toBe(prepareRunRequest);
    expect(options.writeMemoryDump).toBe(writeMemoryDump);
    expect(options.listModels()).toEqual([]);
    expect(getAvailableModels).toHaveBeenCalledOnce();
    expect(options.writeClientDebug({ error: 'boom', requestId: 'req-1' })).toBe('.ai-debug/errors/client-debug.json');
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
    await expect(options.legacyRuntime.chat()).rejects.toThrow(/retired/i);
  });

  it('keeps mastra selected when AI_RUNTIME=mastra', async () => {
    const sharedMemory = { kind: 'memory' };
    const mastraRuntime = { kind: 'mastra-runtime' };
    const createInMemoryAgentMemoryStore = vi.fn(() => sharedMemory);
    const createMastraRuntimeDeps = vi.fn(() => ({ deps: 'mastra' }));
    const createMastraAiService = vi.fn((_options: unknown) => mastraRuntime);

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
        AI_RUNTIME: 'mastra',
      }),
    }));
    vi.doMock('./agent-runtime.ts', () => ({
      createMastraRuntimeDeps,
    }));
    vi.doMock('./request-attachments.ts', () => ({
      prepareRunRequest: vi.fn(async (request) => request),
    }));

    const runtimeModule = await import('./runtime-switch.ts');

    expect(runtimeModule.configuredRuntime).toBe(mastraRuntime);
    expect(createMastraAiService).toHaveBeenCalledOnce();
  });
});
