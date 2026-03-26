import type {
  AIClient,
  AgentEvent,
  ChatRequest,
  ChatResponse,
  ClassifyRouteRequest,
  ClassifyRouteResponse,
  FinalizeRequest,
  FinalizeResult,
  ProjectAgentEvent,
  ProjectCancelRequest,
  ProjectConfirmRequest,
  ProjectReviseRequest,
  ProjectRunRequest,
  ProjectSessionMutationResult,
  RunRequest,
  RunStreamOptions,
} from './api-types';
import { isProductionEnvironment } from '../utils/env';

const AI_API_BASE = isProductionEnvironment() ? '/locode/shenbi/api/ai' : '/api/ai';
const DEFAULT_STREAM_ENDPOINT = `${AI_API_BASE}/run/stream`;
const DEFAULT_FINALIZE_ENDPOINT = `${AI_API_BASE}/run/finalize`;
const DEFAULT_CHAT_ENDPOINT = `${AI_API_BASE}/chat`;
const DEFAULT_CLASSIFY_ROUTE_ENDPOINT = `${AI_API_BASE}/classify-route`;
const DEFAULT_PROJECT_STREAM_ENDPOINT = `${AI_API_BASE}/project/stream`;
const DEFAULT_PROJECT_CONFIRM_ENDPOINT = `${AI_API_BASE}/project/confirm`;
const DEFAULT_PROJECT_REVISE_ENDPOINT = `${AI_API_BASE}/project/revise`;
const DEFAULT_PROJECT_CANCEL_ENDPOINT = `${AI_API_BASE}/project/cancel`;
const TEXT_DECODER = new TextDecoder();

function createRequestInit(request: RunRequest, signal?: AbortSignal): RequestInit {
    return {
        method: 'POST',
        headers: {
            Accept: 'text/event-stream',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        ...(signal ? { signal } : {}),
    };
}

async function readResponseError(response: Response): Promise<string> {
    const text = await response.text();
    if (!text) {
        return `${response.status} ${response.statusText}`.trim();
    }

    try {
        const payload = JSON.parse(text) as unknown;
        if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
            return payload.error;
        }
    } catch {
        // Ignore parse failures and fall back to plain text.
    }

    return text;
}

function parseEventChunk<TEvent>(chunk: string): TEvent | null {
    let eventName = '';
    const dataLines: string[] = [];

    for (const rawLine of chunk.split(/\r?\n/)) {
        if (!rawLine || rawLine.startsWith(':')) {
            continue;
        }
        if (rawLine.startsWith('event:')) {
            eventName = rawLine.slice('event:'.length).trim();
            continue;
        }
        if (rawLine.startsWith('data:')) {
            dataLines.push(rawLine.slice('data:'.length).trimStart());
        }
    }

    if (eventName === 'heartbeat' || dataLines.length === 0) {
        return null;
    }

    return JSON.parse(dataLines.join('\n')) as TEvent;
}

async function* parseEventStream<TEvent>(body: ReadableStream<Uint8Array>): AsyncIterable<TEvent> {
    const reader = body.getReader();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            buffer += TEXT_DECODER.decode(value, { stream: true });
            buffer = buffer.replace(/\r\n/g, '\n');

            let boundaryIndex = buffer.indexOf('\n\n');
            while (boundaryIndex !== -1) {
                const chunk = buffer.slice(0, boundaryIndex);
                buffer = buffer.slice(boundaryIndex + 2);
                const event = parseEventChunk<TEvent>(chunk);
                if (event) {
                    yield event;
                }
                boundaryIndex = buffer.indexOf('\n\n');
            }
        }

        buffer += TEXT_DECODER.decode();
        if (buffer.trim()) {
            const event = parseEventChunk<TEvent>(buffer);
            if (event) {
                yield event;
            }
        }
    } finally {
        reader.releaseLock();
    }
}

export interface FetchAIClientOptions {
  endpoint?: string;
  finalizeEndpoint?: string;
  chatEndpoint?: string;
  classifyRouteEndpoint?: string;
  projectStreamEndpoint?: string;
  projectConfirmEndpoint?: string;
  projectReviseEndpoint?: string;
  projectCancelEndpoint?: string;
  fetchImplementation?: typeof fetch;
}

export class FetchAIClient implements AIClient {
  private readonly endpoint: string;
  private readonly finalizeEndpoint: string;
  private readonly chatEndpoint: string;
  private readonly classifyRouteEndpoint: string;
  private readonly projectStreamEndpoint: string;
  private readonly projectConfirmEndpoint: string;
  private readonly projectReviseEndpoint: string;
  private readonly projectCancelEndpoint: string;
  private readonly fetchImplementation: typeof fetch;

    constructor(options: FetchAIClientOptions = {}) {
    this.endpoint = options.endpoint ?? DEFAULT_STREAM_ENDPOINT;
    this.finalizeEndpoint = options.finalizeEndpoint ?? DEFAULT_FINALIZE_ENDPOINT;
    this.chatEndpoint = options.chatEndpoint ?? DEFAULT_CHAT_ENDPOINT;
    this.classifyRouteEndpoint = options.classifyRouteEndpoint ?? DEFAULT_CLASSIFY_ROUTE_ENDPOINT;
    this.projectStreamEndpoint = options.projectStreamEndpoint ?? DEFAULT_PROJECT_STREAM_ENDPOINT;
    this.projectConfirmEndpoint = options.projectConfirmEndpoint ?? DEFAULT_PROJECT_CONFIRM_ENDPOINT;
    this.projectReviseEndpoint = options.projectReviseEndpoint ?? DEFAULT_PROJECT_REVISE_ENDPOINT;
    this.projectCancelEndpoint = options.projectCancelEndpoint ?? DEFAULT_PROJECT_CANCEL_ENDPOINT;
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch.bind(globalThis);
  }

    async *runStream(request: RunRequest, options: RunStreamOptions = {}): AsyncIterable<AgentEvent> {
        const response = await this.fetchImplementation(
            this.endpoint,
            createRequestInit(request, options.signal),
        );

        if (!response.ok) {
            throw new Error(await readResponseError(response));
        }
        if (!response.body) {
            throw new Error('AI stream response body is missing');
        }

        yield* parseEventStream<AgentEvent>(response.body);
    }

  async *projectStream(request: ProjectRunRequest, options: RunStreamOptions = {}): AsyncIterable<ProjectAgentEvent> {
    const response = await this.fetchImplementation(this.projectStreamEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      ...(options.signal ? { signal: options.signal } : {}),
    });

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }
    if (!response.body) {
      throw new Error('AI project stream response body is missing');
    }

    yield* parseEventStream<ProjectAgentEvent>(response.body);
  }

  async finalize(request: FinalizeRequest): Promise<FinalizeResult> {
        const response = await this.fetchImplementation(this.finalizeEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            throw new Error(await readResponseError(response));
        }
    const payload = await response.json() as { success?: boolean; data?: FinalizeResult };
    return payload.data ?? {};
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.fetchImplementation(this.chatEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...request,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }
    const payload = await response.json() as { success?: boolean; data?: ChatResponse };
    return payload.data ?? { content: '' };
  }

  async *chatStream(request: ChatRequest, options: RunStreamOptions = {}): AsyncIterable<{ delta: string }> {
    const response = await this.fetchImplementation(this.chatEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...request,
        stream: true,
      }),
      ...(options.signal ? { signal: options.signal } : {}),
    });

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }
    if (!response.body) {
      throw new Error('AI chat stream response body is missing');
    }

    const reader = response.body.getReader();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += TEXT_DECODER.decode(value, { stream: true }).replace(/\r\n/g, '\n');

        let boundaryIndex = buffer.indexOf('\n\n');
        while (boundaryIndex !== -1) {
          const chunk = buffer.slice(0, boundaryIndex);
          buffer = buffer.slice(boundaryIndex + 2);
          const dataLines = chunk
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice('data:'.length).trimStart());
          if (dataLines.length > 0) {
            const parsed = JSON.parse(dataLines.join('\n')) as { delta?: string; error?: string };
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.delta) {
              yield { delta: parsed.delta };
            }
          }
          boundaryIndex = buffer.indexOf('\n\n');
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async classifyRoute(request: ClassifyRouteRequest): Promise<ClassifyRouteResponse> {
    const response = await this.fetchImplementation(this.classifyRouteEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }
    const payload = await response.json() as { success?: boolean; data?: ClassifyRouteResponse };
    return payload.data ?? { scope: 'single-page', intent: 'schema.create', confidence: 0 };
  }

  async projectConfirm(request: ProjectConfirmRequest): Promise<ProjectSessionMutationResult> {
    const response = await this.fetchImplementation(this.projectConfirmEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }
    const payload = await response.json() as { success?: boolean; data?: ProjectSessionMutationResult };
    return payload.data ?? { sessionId: request.sessionId, status: 'executing' };
  }

  async projectRevise(request: ProjectReviseRequest): Promise<ProjectSessionMutationResult> {
    const response = await this.fetchImplementation(this.projectReviseEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }
    const payload = await response.json() as { success?: boolean; data?: ProjectSessionMutationResult };
    return payload.data ?? { sessionId: request.sessionId, status: 'awaiting_confirmation' };
  }

  async projectCancel(request: ProjectCancelRequest): Promise<ProjectSessionMutationResult> {
    const response = await this.fetchImplementation(this.projectCancelEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }
    const payload = await response.json() as { success?: boolean; data?: ProjectSessionMutationResult };
    return payload.data ?? { sessionId: request.sessionId, status: 'cancelled' };
  }
}

export let aiClient: AIClient = new FetchAIClient();

/** @internal Test-only — swap the global AI client for a mock implementation. */
export function setAIClient(client: AIClient): void {
    aiClient = client;
}

/** @internal Test-only — restore the default FetchAIClient. */
export function resetAIClient(): void {
    aiClient = new FetchAIClient();
}

