/**
 * Mock AI client for tests only — NOT exported from the package public API.
 */
import type {
  AIClient,
  AgentEvent,
  ChatRequest,
  ChatResponse,
  ClassifyRouteRequest,
  ClassifyRouteResponse,
  FinalizeRequest,
  ProjectAgentEvent,
  ProjectCancelRequest,
  ProjectConfirmRequest,
  ProjectReviseRequest,
  ProjectRunRequest,
  ProjectSessionMutationResult,
  RunRequest,
  RunStreamOptions,
} from './api-types';
import type { PageSchema, SchemaNode } from '@shenbi/schema';

const MODIFY_PROMPT_PATTERN = /修改|调整|删除|添加|增加|替换|移动|隐藏|显示|改成|换成|update|change|remove|delete|insert|add|replace|move|hide|show/i;

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

function pickTargetNode(schema: RunRequest['context']['schemaJson'], selectedNodeId?: string): SchemaNode | undefined {
    const body = Array.isArray(schema?.body)
        ? schema.body
        : schema?.body
            ? [schema.body]
            : [];
    if (selectedNodeId) {
        const selected = body.find((node) => node.id === selectedNodeId);
        if (selected) {
            return selected;
        }
    }
    return body[0];
}

function shouldModify(request: RunRequest): boolean {
    return request.intent === 'schema.modify'
        || Boolean(request.context.schemaJson && MODIFY_PROMPT_PATTERN.test(request.prompt));
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

        const isModifyRun = shouldModify(request);
        yield {
            type: 'intent',
            data: {
                intent: isModifyRun ? 'schema.modify' : request.intent ?? 'schema.create',
                confidence: 1,
            },
        };
        await wait(120, options.signal);

        yield { type: 'message:start', data: { role: 'assistant' } };
        yield { type: 'message:delta', data: { text: '正在分析您的请求：\n\n' } };
        yield { type: 'message:delta', data: { text: `> ${request.prompt}\n\n` } };
        await wait(500, options.signal);

        if (request.prompt.includes('error')) {
            yield { type: 'error', data: { message: '模拟的运行错误！', code: 'MOCK_ERROR' } };
            return;
        }

        if (request.intent === 'chat') {
            yield { type: 'message:delta', data: { text: '这是 mock chat 响应。' } };
            yield {
                type: 'done',
                data: {
                    metadata: {
                        sessionId,
                        ...(request.conversationId ? { conversationId: request.conversationId } : {}),
                        durationMs: 400,
                        tokensUsed: 64,
                    },
                },
            };
            return;
        }

        if (isModifyRun) {
            const targetNode = pickTargetNode(request.context.schemaJson, request.selectedNodeId);
            const targetNodeId = targetNode?.id ?? request.selectedNodeId ?? 'node-1';
            yield { type: 'tool:start', data: { tool: 'modifySchema', label: '分析修改意图' } };
            await wait(240, options.signal);
            yield { type: 'tool:result', data: { tool: 'modifySchema', ok: true, summary: '准备更新当前节点标题。' } };
            yield { type: 'message:delta', data: { text: '识别为局部修改，准备直接应用到当前页面。\n' } };
            yield { type: 'modify:start', data: { operationCount: 1, operations: [{ op: 'schema.patchProps', label: '更新标题' }], explanation: '准备更新当前节点标题。' } };
            yield {
                type: 'modify:op',
                data: {
                    index: 0,
                    operation: {
                        op: 'schema.patchProps',
                        nodeId: targetNodeId,
                        patch: {
                            title: '模拟修改后的标题',
                        },
                    },
                },
            };
            await wait(200, options.signal);
            yield { type: 'modify:done', data: {} };
            yield { type: 'message:delta', data: { text: '局部修改已完成。' } };
            yield {
                type: 'done',
                data: {
                    metadata: {
                        sessionId,
                        ...(request.conversationId ? { conversationId: request.conversationId } : {}),
                        ...(request.plannerModel ? { plannerModel: request.plannerModel } : {}),
                        ...(request.blockModel ? { blockModel: request.blockModel } : {}),
                        durationMs: 900,
                        tokensUsed: 256,
                    },
                },
            };
            return;
        }

        yield { type: 'tool:start', data: { tool: 'planPage', label: '规划页面' } };
        await wait(600, options.signal);

        yield {
            type: 'plan',
            data: {
                pageTitle: '示例应用布局',
                pageType: 'dashboard',
                layout: [
                    { blocks: ['header-block'] },
                    {
                        columns: [
                            { span: 16, blocks: ['hero-block'] },
                            { span: 8, blocks: ['aside-block'] },
                        ],
                    },
                ],
                blocks: [
                    {
                        id: 'header-block',
                        description: '顶部导航栏',
                        components: ['Container', 'Button'],
                        priority: 1,
                        complexity: 'simple' as const,
                    },
                    {
                        id: 'hero-block',
                        description: '内容介绍区',
                        components: ['Card'],
                        priority: 2,
                        complexity: 'medium' as const,
                    },
                    {
                        id: 'aside-block',
                        description: '右侧说明区',
                        components: ['Card', 'Typography.Text'],
                        priority: 3,
                        complexity: 'simple' as const,
                    },
                ],
            },
        };

        yield { type: 'tool:result', data: { tool: 'planPage', ok: true, summary: '规划完成' } };
        await wait(500, options.signal);
        yield { type: 'message:delta', data: { text: '规划完成，开始生成页面结构...\n' } };

        const schema: PageSchema = {
            id: 'mock-plan-b-page',
            name: '示例应用布局',
            body: [
                {
                    id: 'header-block',
                    component: 'Card',
                    props: {
                        title: '页面头部',
                    },
                    children: [
                        {
                            id: 'header-title',
                            component: 'Typography.Text',
                            children: '欢迎使用 Plan B 布局生成',
                        },
                    ],
                },
                {
                    id: 'layout-row-2',
                    component: 'Row',
                    props: { gutter: [24, 24] },
                    children: [
                        {
                            id: 'layout-row-2-col-1',
                            component: 'Col',
                            props: { span: 16 },
                            children: [
                                {
                                    id: 'hero-block',
                                    component: 'Card',
                                    props: {
                                        title: '内容介绍区',
                                    },
                                    children: [
                                        {
                                            id: 'hero-text',
                                            component: 'Typography.Text',
                                            children: '这里展示页面的核心介绍内容。',
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            id: 'layout-row-2-col-2',
                            component: 'Col',
                            props: { span: 8 },
                            children: [
                                {
                                    id: 'aside-block',
                                    component: 'Card',
                                    props: {
                                        title: '右侧说明区',
                                    },
                                    children: [
                                        {
                                            id: 'aside-text',
                                            component: 'Typography.Text',
                                            children: '这里展示补充说明和操作提示。',
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        };
        const skeletonSchema: PageSchema = {
            id: 'mock-skeleton-page',
            name: '示例应用布局',
            body: [
                {
                    id: 'header-block-skeleton',
                    component: 'Card',
                    props: {
                        title: '页面头部',
                        loading: true,
                    },
                    children: [
                        {
                            id: 'header-block-skeleton-text',
                            component: 'Typography.Text',
                            children: '生成中...',
                        },
                    ],
                },
                {
                    id: 'layout-row-2',
                    component: 'Row',
                    props: { gutter: [24, 24] },
                    children: [
                        {
                            id: 'layout-row-2-col-1',
                            component: 'Col',
                            props: { span: 16 },
                            children: [
                                {
                                    id: 'hero-block-skeleton',
                                    component: 'Card',
                                    props: {
                                        title: '内容介绍区',
                                        loading: true,
                                    },
                                    children: [
                                        {
                                            id: 'hero-block-skeleton-text',
                                            component: 'Typography.Text',
                                            children: '生成中...',
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            id: 'layout-row-2-col-2',
                            component: 'Col',
                            props: { span: 8 },
                            children: [
                                {
                                    id: 'aside-block-skeleton',
                                    component: 'Card',
                                    props: {
                                        title: '右侧说明区',
                                        loading: true,
                                    },
                                    children: [
                                        {
                                            id: 'aside-block-skeleton-text',
                                            component: 'Typography.Text',
                                            children: '生成中...',
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        };
        yield {
            type: 'schema:skeleton',
            data: {
                schema: skeletonSchema,
            },
        };
        await wait(300, options.signal);
        yield { type: 'schema:block:start', data: { blockId: 'header-block', description: '顶部导航栏' } };
        yield { type: 'schema:block:start', data: { blockId: 'hero-block', description: '内容介绍区' } };
        yield { type: 'schema:block:start', data: { blockId: 'aside-block', description: '右侧说明区' } };
        await wait(300, options.signal);

        const nodes = Array.isArray(schema.body) ? schema.body : [schema.body];
        const blockIds = ['header-block', 'hero-block', 'aside-block'];
        for (const [index, node] of nodes.entries()) {
            if (!node || !blockIds[index]) {
                continue;
            }
            yield { type: 'schema:block', data: { blockId: blockIds[index]!, node } };
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

    async finalize(_request: FinalizeRequest): Promise<{ memoryDebugFile?: string }> {
        return {};
    }

    async chat(request: ChatRequest): Promise<ChatResponse> {
        const lastMessage = request.messages[request.messages.length - 1];
        return {
            content: [
                'Status: 正在分析请求',
                'Action: finish',
                `Action Input: ${JSON.stringify({ summary: typeof lastMessage?.content === 'string' ? lastMessage.content : 'mock complete' })}`,
            ].join('\n'),
            tokensUsed: {
                input: 16,
                output: 24,
                total: 40,
            },
            durationMs: 80,
        };
    }

    async *chatStream(request: ChatRequest, _options: RunStreamOptions = {}): AsyncIterable<{ delta: string }> {
        const response = await this.chat(request);
        for (const chunk of response.content.match(/.{1,24}/g) ?? []) {
            yield { delta: chunk };
        }
    }

    async classifyRoute(_request: ClassifyRouteRequest): Promise<ClassifyRouteResponse> {
        return { scope: 'single-page', intent: 'schema.create', confidence: 0.9 };
    }

    async *projectStream(request: ProjectRunRequest, options: RunStreamOptions = {}): AsyncIterable<ProjectAgentEvent> {
        const sessionId = 'mock-project-session';
        yield {
            type: 'project:start',
            data: {
                sessionId,
                ...(request.conversationId ? { conversationId: request.conversationId } : {}),
                prompt: request.prompt,
            },
        };
        await wait(80, options.signal);
        const plan = {
            projectName: 'Mock 项目',
            pages: [
                {
                    pageId: 'mock-dashboard',
                    pageName: 'Mock 看板',
                    action: 'create' as const,
                    description: 'Mock 看板页',
                },
            ],
        };
        yield {
            type: 'project:plan',
            data: {
                sessionId,
                plan,
            },
        };
        yield {
            type: 'project:awaiting_confirmation',
            data: {
                sessionId,
                plan,
            },
        };
    }

    async projectConfirm(request: ProjectConfirmRequest): Promise<ProjectSessionMutationResult> {
        return {
            sessionId: request.sessionId,
            status: 'executing',
        };
    }

    async projectRevise(request: ProjectReviseRequest): Promise<ProjectSessionMutationResult> {
        return {
            sessionId: request.sessionId,
            status: 'awaiting_confirmation',
        };
    }

    async projectCancel(request: ProjectCancelRequest): Promise<ProjectSessionMutationResult> {
        return {
            sessionId: request.sessionId,
            status: 'cancelled',
        };
    }
}
