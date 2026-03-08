import type { AIClient, AgentEvent, RunRequest, RunStreamOptions } from './api-types';

const DEFAULT_STREAM_ENDPOINT = '/api/ai/run/stream';
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

function parseEventChunk(chunk: string): AgentEvent | null {
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

    return JSON.parse(dataLines.join('\n')) as AgentEvent;
}

async function* parseEventStream(body: ReadableStream<Uint8Array>): AsyncIterable<AgentEvent> {
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
                const event = parseEventChunk(chunk);
                if (event) {
                    yield event;
                }
                boundaryIndex = buffer.indexOf('\n\n');
            }
        }

        buffer += TEXT_DECODER.decode();
        if (buffer.trim()) {
            const event = parseEventChunk(buffer);
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
    fetchImplementation?: typeof fetch;
}

export class FetchAIClient implements AIClient {
    private readonly endpoint: string;
    private readonly fetchImplementation: typeof fetch;

    constructor(options: FetchAIClientOptions = {}) {
        this.endpoint = options.endpoint ?? DEFAULT_STREAM_ENDPOINT;
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

        yield* parseEventStream(response.body);
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

