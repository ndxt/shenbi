import { describe, expect, it, vi } from 'vitest';
import { createSchemaDigest } from '@shenbi/ai-contracts';
import {
  buildRuntimeContext,
  createInMemoryAgentMemoryStore,
  createToolRegistry,
  formatConversationHistory,
  runAgentStream,
  type AgentOperation,
  type AgentRuntimeDeps,
  type RunRequest,
} from '@shenbi/ai-agents';
import { createMastraAiService } from '@shenbi/mastra-runtime';
import type { PageSchema } from '@shenbi/schema';
import { createMastraRuntimeDeps } from './agent-runtime.ts';
import { prepareRunRequest } from './request-attachments.ts';
import { writeMemoryDump } from '../adapters/debug-dump.ts';

function createSchema(overrides?: {
  title?: string;
  background?: string;
  extraNodeId?: string;
}): PageSchema {
  return {
    id: 'page-1',
    body: [
      {
        id: 'card-1',
        component: 'Card',
        props: {
          title: overrides?.title ?? '用户统计',
          ...(overrides?.background
            ? {
              style: {
                background: overrides.background,
              },
            }
            : {}),
        },
        children: [],
      },
      ...(overrides?.extraNodeId
        ? [{
          id: overrides.extraNodeId,
          component: 'Button',
          children: '导出',
        }]
        : []),
    ],
  };
}

function createFinalizeRuntime(memory: ReturnType<typeof createInMemoryAgentMemoryStore>) {
  return createMastraAiService({
    legacyRuntime: {
      run: async () => {
        throw new Error('Legacy runtime has been retired');
      },
      runStream: async function* () {
        throw new Error('Legacy runtime has been retired');
      },
      chat: async () => {
        throw new Error('Legacy runtime has been retired');
      },
      chatStream: async function* () {
        throw new Error('Legacy runtime has been retired');
      },
      classifyRoute: async () => {
        throw new Error('Legacy runtime has been retired');
      },
      finalize: async () => {
        throw new Error('Legacy runtime has been retired');
      },
      listModels: () => [],
      writeClientDebug: () => '.ai-debug/errors/client-debug.json',
      writeTraceDebug: () => '.ai-debug/traces/trace.json',
      projectStream: async function* () {
        throw new Error('Legacy runtime has been retired');
      },
      confirmProject: async () => {
        throw new Error('Legacy runtime has been retired');
      },
      reviseProject: async () => {
        throw new Error('Legacy runtime has been retired');
      },
      cancelProject: async () => {
        throw new Error('Legacy runtime has been retired');
      },
    },
    createDeps: () => createMastraRuntimeDeps(memory),
    prepareRunRequest,
    writeMemoryDump,
    listModels: () => [],
    writeClientDebug: () => '.ai-debug/errors/client-debug.json',
    writeTraceDebug: () => '.ai-debug/traces/trace.json',
  });
}

function createModifyDeps(
  memory: ReturnType<typeof createInMemoryAgentMemoryStore>,
  result: { explanation: string; operations: AgentOperation[] },
): AgentRuntimeDeps {
  return {
    llm: {
      chat: vi.fn(async () => ({ text: 'unused' })),
      streamChat: vi.fn(async function* () {
        yield { text: 'unused' };
      }),
    },
    tools: createToolRegistry([
      {
        name: 'modifySchema',
        async execute() {
          return result;
        },
      },
    ]),
    memory,
    logger: {
      info: vi.fn(),
      error: vi.fn(),
    },
  };
}

async function runModifyRound(input: {
  memory: ReturnType<typeof createInMemoryAgentMemoryStore>;
  conversationId: string;
  prompt: string;
  schema: PageSchema;
  result: { explanation: string; operations: AgentOperation[] };
}): Promise<string> {
  const deps = createModifyDeps(input.memory, input.result);
  const request: RunRequest = {
    prompt: input.prompt,
    intent: 'schema.modify',
    conversationId: input.conversationId,
    selectedNodeId: 'card-1',
    context: {
      schemaSummary: 'pageId=page-1; nodeCount=1',
      componentSummary: 'Card, Button',
      schemaJson: input.schema,
    },
  };

  let sessionId: string | undefined;
  for await (const event of runAgentStream(request, deps)) {
    if (event.type === 'run:start') {
      sessionId = event.data.sessionId;
    }
  }

  if (!sessionId) {
    throw new Error('run:start event missing');
  }
  return sessionId;
}

async function buildNextContext(input: {
  memory: ReturnType<typeof createInMemoryAgentMemoryStore>;
  conversationId: string;
  schema: PageSchema;
  prompt?: string;
}) {
  const [conversation, lastRunMetadata, lastBlockIds] = await Promise.all([
    input.memory.getConversation(input.conversationId),
    input.memory.getLastRunMetadata(input.conversationId),
    input.memory.getLastBlockIds(input.conversationId),
  ]);

  return buildRuntimeContext({
    request: {
      prompt: input.prompt ?? '继续优化这个页面',
      selectedNodeId: 'card-1',
      context: {
        schemaSummary: 'pageId=page-1; nodeCount=1',
        componentSummary: 'Card, Button',
        schemaJson: input.schema,
      },
    },
    conversation,
    ...(lastRunMetadata ? { lastRunMetadata } : {}),
    lastBlockIds,
  });
}

describe('memory context integration', () => {
  it('keeps confirmed modify operations available in the next turn after finalize success', async () => {
    const memory = createInMemoryAgentMemoryStore();
    const runtime = createFinalizeRuntime(memory);
    const nextSchema = createSchema({ title: '本月营收' });
    const operation: AgentOperation = {
      op: 'schema.patchProps',
      nodeId: 'card-1',
      patch: { title: '本月营收' },
    };

    const sessionId = await runModifyRound({
      memory,
      conversationId: 'conv-success',
      prompt: '把当前卡片标题改成本月营收',
      schema: createSchema(),
      result: {
        explanation: '已更新当前卡片标题。',
        operations: [operation],
      },
    });

    await runtime.finalize({
      conversationId: 'conv-success',
      sessionId,
      success: true,
      schemaDigest: createSchemaDigest(nextSchema)!,
    });

    const context = await buildNextContext({
      memory,
      conversationId: 'conv-success',
      schema: nextSchema,
    });

    expect(context.conversation.lastOperations).toEqual([operation]);
    expect(
      formatConversationHistory(
        context.conversation.history,
        context.document.schemaDigest
          ? { schemaDigest: context.document.schemaDigest }
          : {},
      ),
    ).toContain('[执行: 修改节点 card-1 的属性 title="本月营收"]');
  });

  it('drops failed operations and keeps only the next successful modify in context', async () => {
    const memory = createInMemoryAgentMemoryStore();
    const runtime = createFinalizeRuntime(memory);
    const baseSchema = createSchema();
    const successSchema = createSchema({ background: '#fffbe6' });
    const failedOperation: AgentOperation = {
      op: 'schema.patchProps',
      nodeId: 'card-1',
      patch: { title: '本月营收' },
    };
    const successOperation: AgentOperation = {
      op: 'schema.patchStyle',
      nodeId: 'card-1',
      patch: { background: '#fffbe6' },
    };

    const failedSessionId = await runModifyRound({
      memory,
      conversationId: 'conv-retry',
      prompt: '把当前卡片标题改成本月营收',
      schema: baseSchema,
      result: {
        explanation: '准备修改当前卡片标题。',
        operations: [failedOperation],
      },
    });

    await runtime.finalize({
      conversationId: 'conv-retry',
      sessionId: failedSessionId,
      success: false,
      error: 'op 1 failed',
      schemaDigest: createSchemaDigest(baseSchema)!,
    });

    const successSessionId = await runModifyRound({
      memory,
      conversationId: 'conv-retry',
      prompt: '给这个卡片加一个浅黄色背景',
      schema: baseSchema,
      result: {
        explanation: '已给卡片补充浅黄色背景。',
        operations: [successOperation],
      },
    });

    await runtime.finalize({
      conversationId: 'conv-retry',
      sessionId: successSessionId,
      success: true,
      schemaDigest: createSchemaDigest(successSchema)!,
    });

    const context = await buildNextContext({
      memory,
      conversationId: 'conv-retry',
      schema: successSchema,
    });
    const history = formatConversationHistory(
      context.conversation.history,
      context.document.schemaDigest
        ? { schemaDigest: context.document.schemaDigest }
        : {},
    );

    expect(context.conversation.lastOperations).toEqual([successOperation]);
    expect(history).toContain('[执行: 调整节点 card-1 的样式 background="#fffbe6"]');
    expect(history).not.toContain('[执行: 修改节点 card-1 的属性 title="本月营收"]');
    expect(history).toContain('助手: [修改失败] op 1 failed');
  });

  it('omits stale operation summaries after the user manually changes the schema', async () => {
    const memory = createInMemoryAgentMemoryStore();
    const runtime = createFinalizeRuntime(memory);
    const aiSchema = createSchema({ title: '本月营收' });
    const manualSchema = createSchema({ title: '手工改过的标题', extraNodeId: 'button-1' });
    const operation: AgentOperation = {
      op: 'schema.patchProps',
      nodeId: 'card-1',
      patch: { title: '本月营收' },
    };

    const sessionId = await runModifyRound({
      memory,
      conversationId: 'conv-stale',
      prompt: '把当前卡片标题改成本月营收',
      schema: createSchema(),
      result: {
        explanation: '已更新当前卡片标题。',
        operations: [operation],
      },
    });

    await runtime.finalize({
      conversationId: 'conv-stale',
      sessionId,
      success: true,
      schemaDigest: createSchemaDigest(aiSchema)!,
    });

    const context = await buildNextContext({
      memory,
      conversationId: 'conv-stale',
      schema: manualSchema,
      prompt: '再帮我看看这个页面',
    });
    const history = formatConversationHistory(
      context.conversation.history,
      context.document.schemaDigest
        ? { schemaDigest: context.document.schemaDigest }
        : {},
    );

    expect(context.conversation.lastOperations).toBeUndefined();
    expect(history).toContain('助手: 已更新当前卡片标题。');
    expect(history).not.toContain('[执行: schema.patchProps(card-1)]');
  });
});
