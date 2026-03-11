import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleClient } from './openai-compatible.ts';

describe('OpenAICompatibleClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends json_object response format for blocking chat calls', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: '{"ok":true}',
          },
        },
      ],
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new OpenAICompatibleClient({
      baseUrl: 'https://example.com/v1',
      apiKey: 'test-key',
    });

    await client.chat('glm-4.7', [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      response_format?: { type?: string };
      stream?: boolean;
      temperature?: number;
    };
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.stream).toBe(false);
    expect(body.temperature).toBe(0.6);
  });

  it('omits thinking for models explicitly marked as non-thinking', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: '{"ok":true}',
          },
        },
      ],
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new OpenAICompatibleClient({
      baseUrl: 'https://example.com/v1',
      apiKey: 'test-key',
      nonThinkingModels: ['gpt*'],
    });

    await client.chat('gpt-5-codex', [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ], { type: 'enabled' });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      thinking?: { type?: string };
    };
    expect(body.thinking).toBeUndefined();
  });

  it('omits thinking for provider-prefixed models that match a non-thinking rule', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '{"ok":true}' } }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new OpenAICompatibleClient({
      baseUrl: 'https://example.com/v1',
      apiKey: 'test-key',
      nonThinkingModels: ['gpt*'],
    });

    // "openai/gpt-4o-mini" should match the "gpt*" rule via its bare name
    await client.chat('openai/gpt-4o-mini', [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ], { type: 'disabled' });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      thinking?: { type?: string };
    };
    expect(body.thinking).toBeUndefined();
  });

  it('includes thinking by default for models that are not in the denylist', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: '{"ok":true}',
          },
        },
      ],
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new OpenAICompatibleClient({
      baseUrl: 'https://example.com/v1',
      apiKey: 'test-key',
    });

    await client.chat('GLM-4.7', [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ], { type: 'enabled' });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      thinking?: { type?: string };
    };
    expect(body.thinking).toEqual({ type: 'enabled' });
  });

  it('sends only enable_thinking bool for qwen* models, not the thinking object', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '{"ok":true}' } }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new OpenAICompatibleClient({
      baseUrl: 'https://example.com/v1',
      apiKey: 'test-key',
      enableThinkingModels: ['qwen*'],
    });

    // enabled
    await client.chat('qwen3.5-plus', [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ], { type: 'enabled' });

    const [, initEnabled] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const bodyEnabled = JSON.parse(String(initEnabled.body)) as {
      enable_thinking?: boolean;
      thinking?: unknown;
    };
    expect(bodyEnabled.enable_thinking).toBe(true);
    expect(bodyEnabled.thinking).toBeUndefined();

    // disabled
    await client.chat('qwen3.5-plus', [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ], { type: 'disabled' });

    const [, initDisabled] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    const bodyDisabled = JSON.parse(String(initDisabled.body)) as {
      enable_thinking?: boolean;
      thinking?: unknown;
    };
    expect(bodyDisabled.enable_thinking).toBe(false);
    expect(bodyDisabled.thinking).toBeUndefined();
  });

  it('does not use enable_thinking for non-qwen models even when enableThinkingModels is set', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '{"ok":true}' } }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new OpenAICompatibleClient({
      baseUrl: 'https://example.com/v1',
      apiKey: 'test-key',
      enableThinkingModels: ['qwen*'],
    });

    // glm-4.7 is not a qwen* model — should get Format B (thinking object)
    await client.chat('glm-4.7', [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ], { type: 'enabled' });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      enable_thinking?: boolean;
      thinking?: { type?: string };
    };
    expect(body.enable_thinking).toBeUndefined();
    expect(body.thinking).toEqual({ type: 'enabled' });
  });

  it('builds a request summary that matches the resolved thinking format', () => {
    const client = new OpenAICompatibleClient({
      baseUrl: 'https://example.com/v1',
      apiKey: 'test-key',
      nonThinkingModels: ['gpt*', 'gemini*'],
      enableThinkingModels: ['qwen*'],
    });

    // Format A: gpt model
    const gptSummary = client.buildRequestDebugSummary('gpt-4o-mini', [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ], { type: 'disabled' }, false);
    expect(gptSummary).toMatchObject({ model: 'gpt-4o-mini', hasThinking: false });
    expect(gptSummary.thinking).toBeUndefined();
    expect(gptSummary.enableThinking).toBeUndefined();

    // Format B: GLM model
    const glmSummary = client.buildRequestDebugSummary('GLM-4.7', [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ], { type: 'enabled' }, false);
    expect(glmSummary).toMatchObject({ model: 'GLM-4.7', hasThinking: true, thinking: { type: 'enabled' } });
    expect(glmSummary.enableThinking).toBeUndefined();

    // Format C: qwen model
    const qwenSummary = client.buildRequestDebugSummary('qwen3.5-plus', [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ], { type: 'enabled' }, false);
    expect(qwenSummary).toMatchObject({ model: 'qwen3.5-plus', hasThinking: true, enableThinking: true });
    expect(qwenSummary.thinking).toBeUndefined();
  });
});
