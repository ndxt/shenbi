/**
 * Mock AI client for tests only — NOT exported from the package public API.
 */
import type { AIClient, AgentEvent, RunRequest, RunStreamOptions } from './api-types';
import { createAIDemoSchema } from './demo-schema';

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
                        complexity: 'simple' as const,
                    },
                    {
                        id: 'hero-block',
                        type: 'Hero',
                        description: '内容介绍区',
                        components: ['Card'],
                        priority: 2,
                        complexity: 'medium' as const,
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
