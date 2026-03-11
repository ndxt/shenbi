import { describe, expect, it, vi } from 'vitest';
import type { AgentEvent, RunRequest } from './api-types';
import { FetchAIClient } from './sse-client';
import { MockAIClient } from './mock-ai-client';

function createStreamResponse(events: AgentEvent[]): Response {
  const payload = events
    .map((event) => `data: ${JSON.stringify(event)}\n\n`)
    .join('');

  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(payload));
        controller.close();
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
      },
    },
  );
}

function createRequest(): RunRequest {
  return {
    prompt: 'Generate an admin page',
    intent: 'schema.create',
    plannerModel: 'planner-demo',
    blockModel: 'block-demo',
    conversationId: 'conv-1',
    selectedNodeId: 'body.0',
    context: {
      schemaSummary: 'pageId=page-1; nodeCount=0',
      componentSummary: 'Button(props:2,slots:0)',
    },
  };
}

describe('FetchAIClient', () => {
  it('binds the global fetch implementation for browser-safe invocation', async () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn(async () => createStreamResponse([]));

    try {
      globalThis.fetch = fetchSpy as typeof fetch;
      const client = new FetchAIClient();

      await Array.fromAsync(client.runStream(createRequest()));

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('posts RunRequest to the stream endpoint and parses AgentEvent payloads', async () => {
    const fetchImplementation = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      });

      const request = JSON.parse(String(init?.body)) as RunRequest;
      expect(request.context.schemaSummary).toContain('pageId=');

      return createStreamResponse([
        { type: 'run:start', data: { sessionId: 'session-1', conversationId: 'conv-1' } },
        { type: 'message:start', data: { role: 'assistant' } },
        { type: 'message:delta', data: { text: 'hello' } },
        { type: 'done', data: { metadata: { sessionId: 'session-1', conversationId: 'conv-1' } } },
      ]);
    });

    const client = new FetchAIClient({
      endpoint: '/api/ai/run/stream',
      fetchImplementation: fetchImplementation as typeof fetch,
    });

    const events: AgentEvent[] = [];
    for await (const event of client.runStream(createRequest())) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'run:start', data: { sessionId: 'session-1', conversationId: 'conv-1' } },
      { type: 'message:start', data: { role: 'assistant' } },
      { type: 'message:delta', data: { text: 'hello' } },
      { type: 'done', data: { metadata: { sessionId: 'session-1', conversationId: 'conv-1' } } },
    ]);
  });

  it('reads error responses without consuming the response body twice', async () => {
    const fetchImplementation = vi.fn(async () => new Response(
      JSON.stringify({ error: 'bad request' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    ));

    const client = new FetchAIClient({
      fetchImplementation: fetchImplementation as typeof fetch,
    });

    await expect(Array.fromAsync(client.runStream(createRequest()))).rejects.toThrow('bad request');
  });

  it('posts finalize payloads to the finalize endpoint', async () => {
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('/api/ai/run/finalize');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({
        conversationId: 'conv-1',
        sessionId: 'session-1',
        success: false,
        failedOpIndex: 0,
        error: 'node not found',
      });
      return new Response(JSON.stringify({
        success: true,
        data: {
          memoryDebugFile: '.ai-debug/memory/finalize.json',
        },
      }), { status: 200 });
    });

    const client = new FetchAIClient({
      finalizeEndpoint: '/api/ai/run/finalize',
      fetchImplementation: fetchImplementation as typeof fetch,
    });

    await expect(client.finalize({
      conversationId: 'conv-1',
      sessionId: 'session-1',
      success: false,
      failedOpIndex: 0,
      error: 'node not found',
    })).resolves.toEqual({
      memoryDebugFile: '.ai-debug/memory/finalize.json',
    });

    expect(fetchImplementation).toHaveBeenCalledOnce();
  });
});

describe('MockAIClient', () => {
  it('emits the frozen baseline event shapes', async () => {
    const client = new MockAIClient();
    const events: AgentEvent[] = [];

    for await (const event of client.runStream(createRequest())) {
      events.push(event);
    }

    expect(events[0]).toEqual({
      type: 'run:start',
      data: { sessionId: 'mock-session', conversationId: 'conv-1' },
    });
    expect(events.some((event) => event.type === 'schema:done' && 'schema' in event.data)).toBe(true);
    expect(events.at(-1)).toEqual({
      type: 'done',
      data: {
        metadata: {
          sessionId: 'mock-session',
          conversationId: 'conv-1',
          plannerModel: 'planner-demo',
          blockModel: 'block-demo',
          durationMs: 2500,
          tokensUsed: 1024,
        },
      },
    });
  });

  it('emits modify events for local demo flows', async () => {
    const client = new MockAIClient();
    const events: AgentEvent[] = [];

    for await (const event of client.runStream({
      ...createRequest(),
      prompt: '把当前卡片标题改成本月营收',
      intent: 'schema.modify',
      selectedNodeId: 'card-1',
      context: {
        ...createRequest().context,
        schemaJson: {
          id: 'page-1',
          body: [{ id: 'card-1', component: 'Card', children: [] }],
        },
      },
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual([
      'run:start',
      'intent',
      'message:start',
      'message:delta',
      'message:delta',
      'tool:start',
      'tool:result',
      'message:delta',
      'modify:start',
      'modify:op',
      'modify:done',
      'message:delta',
      'done',
    ]);
  });
});
