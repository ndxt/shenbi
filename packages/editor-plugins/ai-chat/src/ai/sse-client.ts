import type { AIClient, AgentEvent, RunRequest } from './api-types';
import { createAIDemoSchema } from './demo-schema';

export class MockAIClient implements AIClient {
    async *runStream(request: RunRequest): AsyncIterable<AgentEvent> {
        yield { type: 'run:start' };
        await new Promise((r) => setTimeout(r, 300));

        yield { type: 'message:start' };
        yield { type: 'message:delta', data: '正在分析您的请求：\n\n' };
        yield { type: 'message:delta', data: `> ${request.prompt}\n\n` };

        await new Promise((r) => setTimeout(r, 500));

        if (request.prompt.includes('error')) {
            yield { type: 'error', data: { message: '模拟的运行错误！' } };
            return;
        }

        yield { type: 'tool:start', data: { name: 'planPage' } };
        await new Promise((r) => setTimeout(r, 600));

        yield {
            type: 'plan',
            data: {
                title: '示例应用布局',
                blocks: [
                    { type: 'Header', description: '顶部导航栏' },
                    { type: 'Hero', description: '内容介绍区' }
                ]
            }
        };

        yield { type: 'tool:result', data: { name: 'planPage', summary: '规划完成' } };

        await new Promise((r) => setTimeout(r, 500));
        yield { type: 'message:delta', data: '规划完成，开始生成页面结构...\n' };

        const schema = createAIDemoSchema();

        // Emulate streaming blocks
        for (const node of (Array.isArray(schema.body) ? schema.body : [schema.body])) {
            if (!node) continue;
            yield { type: 'schema:block', data: { node } };
            await new Promise((r) => setTimeout(r, 800));
        }

        yield { type: 'message:delta', data: '页面生成完成 🎉' };

        yield { type: 'schema:done', data: schema };

        yield { type: 'done', data: { metadata: { durationMs: 2500, tokensUsed: 1024 } } };
    }
}

export const aiClient: AIClient = new MockAIClient();
