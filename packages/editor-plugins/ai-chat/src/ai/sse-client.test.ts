import { describe, expect, it, vi } from 'vitest';
import type { AgentEvent, RunRequest } from './api-types';
import { FetchAIClient, MockAIClient } from './sse-client';

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
});
