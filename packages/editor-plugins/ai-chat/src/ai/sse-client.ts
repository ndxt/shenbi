import type { AIClient, AgentEvent, RunRequest, RunStreamOptions } from './api-types';
import { createAIDemoSchema } from './demo-schema';

const DEFAULT_STREAM_ENDPOINT = '/api/ai/run/stream';
const TEXT_DECODER = new TextDecoder();

function wait(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, ms);
        if (!signal) {
            return;
        }
        const onAbort = () => {
            clearTimeout(timeout);
            reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
        };
        if (signal.aborted) {
            onAbort();
            return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
    });
}

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

export class MockAIClient implements AIClient {
    async *runStream(request: RunRequest, options: RunStreamOptions = {}): AsyncIterable<AgentEvent> {
        const sessionId = 'mock-session';
        yield {
            type: 'run:start',
            data: {
                sessionId,
                ...(request.conversationId ? { conversationId: request.conversationId } : {}),
            },
        };
        await wait(300, options.signal);

        yield { type: 'message:start', data: { role: 'assistant' } };
        yield { type: 'message:delta', data: { text: '正在分析您的请求：\n\n' } };
        yield { type: 'message:delta', data: { text: `> ${request.prompt}\n\n` } };
        await wait(500, options.signal);

        if (request.prompt.includes('error')) {
            yield { type: 'error', data: { message: '模拟的运行错误！', code: 'MOCK_ERROR' } };
            return;
        }

        yield { type: 'tool:start', data: { tool: 'planPage', label: '规划页面' } };
        await wait(600, options.signal);

        yield {
            type: 'plan',
            data: {
                pageTitle: '示例应用布局',
                blocks: [
                    {
                        id: 'header-block',
                        type: 'Header',
                        description: '顶部导航栏',
                        components: ['Header'],
                        priority: 1,
                        complexity: 'simple',
                    },
                    {
                        id: 'hero-block',
                        type: 'Hero',
                        description: '内容介绍区',
                        components: ['Card'],
                        priority: 2,
                        complexity: 'medium',
                    },
                ],
            },
        };

        yield { type: 'tool:result', data: { tool: 'planPage', ok: true, summary: '规划完成' } };
        await wait(500, options.signal);
        yield { type: 'message:delta', data: { text: '规划完成，开始生成页面结构...\n' } };

        const schema = createAIDemoSchema();
        for (const [index, node] of (Array.isArray(schema.body) ? schema.body : [schema.body]).entries()) {
            if (!node) {
                continue;
            }
            yield { type: 'schema:block', data: { blockId: `block-${index + 1}`, node } };
            await wait(800, options.signal);
        }

        yield { type: 'message:delta', data: { text: '页面生成完成。' } };
        yield { type: 'schema:done', data: { schema } };
        yield {
            type: 'done',
            data: {
                metadata: {
                    sessionId,
                    ...(request.conversationId ? { conversationId: request.conversationId } : {}),
                    ...(request.plannerModel ? { plannerModel: request.plannerModel } : {}),
                    ...(request.blockModel ? { blockModel: request.blockModel } : {}),
                    durationMs: 2500,
                    tokensUsed: 1024,
                },
            },
        };
    }
}

export let aiClient: AIClient = new FetchAIClient();

export function setAIClient(client: AIClient): void {
    aiClient = client;
}

export function resetAIClient(): void {
    aiClient = new FetchAIClient();
}
