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
      nonThinkingModels: ['gpt-4o-mini'],
    });

    await client.chat('gpt-4o-mini', [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ], { type: 'enabled' });

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

  it('builds a request summary that matches the serialized thinking behavior', () => {
    const client = new OpenAICompatibleClient({
      baseUrl: 'https://example.com/v1',
      apiKey: 'test-key',
      nonThinkingModels: ['gpt-4o-mini'],
    });

    const disabledSummary = client.buildRequestDebugSummary('gpt-4o-mini', [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ], { type: 'disabled' }, false);
    expect(disabledSummary).toMatchObject({
      model: 'gpt-4o-mini',
      stream: false,
      responseFormat: 'json_object',
      messageCount: 2,
      hasThinking: false,
    });
    expect(disabledSummary.thinking).toBeUndefined();

    const enabledSummary = client.buildRequestDebugSummary('GLM-4.7', [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ], { type: 'enabled' }, false);
    expect(enabledSummary).toMatchObject({
      model: 'GLM-4.7',
      hasThinking: true,
      thinking: { type: 'enabled' },
    });
  });
});
