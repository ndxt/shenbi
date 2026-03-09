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
});
