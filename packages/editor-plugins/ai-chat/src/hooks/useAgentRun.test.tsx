import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, getSchemaNodeByTreeId, getTreeIdBySchemaNodeId } from '@shenbi/editor-core';
import type { PageSchema } from '@shenbi/schema';
import { resetAIClient, setAIClient } from '../ai/sse-client';
import type { AIClient, AgentEvent, FinalizeRequest, FinalizeResult, RunRequest, RunStreamOptions } from '../ai/api-types';
import type { EditorAIBridge } from '../ai/editor-ai-bridge';
import { useAgentRun } from './useAgentRun';

function createInitialSchema(): PageSchema {
  return {
    id: 'page-1',
    name: 'Demo Page',
    body: [
      {
        id: 'container-1',
        component: 'Container',
        children: [
          {
            id: 'card-1',
            component: 'Card',
            props: {
              title: '旧标题',
            },
            children: [],
          },
        ],
      },
    ],
  };
}

function createBridge() {
  const editor = createEditor({
    initialSchema: createInitialSchema(),
  });
  const commandLog: Array<{ commandId: string; args?: unknown }> = [];

  const bridge: EditorAIBridge = {
    getSchema: () => editor.state.getSchema(),
    getSelectedNodeId: () => 'card-1',
    getAvailableComponents: () => [],
    execute: async (commandId, args) => {
      commandLog.push({ commandId, args });
      try {
        await editor.commands.execute(commandId, args);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    replaceSchema: (schema) => {
      void editor.commands.execute('schema.replace', { schema });
    },
    appendBlock: async (node, parentTreeId) => bridge.execute('node.append', { node, parentTreeId }),
    removeNode: async (treeId) => bridge.execute('node.remove', { treeId }),
    subscribe: () => () => undefined,
  };

  return { bridge, editor, commandLog };
}

class ScenarioAIClient implements AIClient {
  readonly finalizeCalls: FinalizeRequest[] = [];
  readonly requests: RunRequest[] = [];

  constructor(
    private readonly events: AgentEvent[],
    private readonly finalizeResult: FinalizeResult = {},
  ) {}

  async *runStream(request: RunRequest, _options: RunStreamOptions = {}): AsyncIterable<AgentEvent> {
    this.requests.push(request);
    for (const event of this.events) {
      yield event;
    }
  }

  async finalize(request: FinalizeRequest): Promise<FinalizeResult> {
    this.finalizeCalls.push(request);
    return this.finalizeResult;
  }
}

afterEach(() => {
  resetAIClient();
});

describe('useAgentRun', () => {
  it('executes modify operations inside one history batch and finalizes success', async () => {
    const { bridge, editor, commandLog } = createBridge();
    const client = new ScenarioAIClient([
      {
        type: 'run:start',
        data: { sessionId: 'session-success', conversationId: 'conv-success' },
      },
      {
        type: 'intent',
        data: { intent: 'schema.modify', confidence: 1 },
      },
      {
        type: 'message:start',
        data: { role: 'assistant' },
      },
      {
        type: 'modify:start',
        data: { operationCount: 2, explanation: '更新标题并新增说明' },
      },
      {
        type: 'modify:op',
        data: {
          index: 0,
          operation: {
            op: 'schema.patchProps',
            nodeId: 'card-1',
            patch: { title: '新标题' },
          },
        },
      },
      {
        type: 'modify:op',
        data: {
          index: 1,
          operation: {
            op: 'schema.insertNode',
            parentId: 'container-1',
            node: {
              id: 'text-1',
              component: 'Typography.Text',
              children: '新增说明',
            },
          },
        },
      },
      {
        type: 'modify:done',
        data: {},
      },
      {
        type: 'done',
        data: {
          metadata: {
            sessionId: 'session-success',
            conversationId: 'conv-success',
          },
        },
      },
    ], {
      memoryDebugFile: '.ai-debug/memory/finalize-success.json',
    });
    setAIClient(client);
    const onMessageStart = vi.fn(() => 'message-1');
    const onMessageDelta = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() => useAgentRun(bridge));

    await act(async () => {
      await result.current.runAgent(
        '把当前卡片标题改成新标题，并追加一段说明',
        '',
        '',
        false,
        'conv-success',
        onMessageStart,
        onMessageDelta,
        onDone,
        onError,
      );
    });

    expect(onError).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith({
      sessionId: 'session-success',
      conversationId: 'conv-success',
      memoryDebugFile: '.ai-debug/memory/finalize-success.json',
    });
    expect(client.requests).toHaveLength(1);
    expect(client.requests[0]).toMatchObject({
      prompt: '把当前卡片标题改成新标题，并追加一段说明',
      intent: 'schema.modify',
      conversationId: 'conv-success',
      selectedNodeId: 'card-1',
      context: {
        schemaJson: createInitialSchema(),
      },
    });
    expect(client.finalizeCalls).toHaveLength(1);
    expect(client.finalizeCalls[0]).toMatchObject({
      conversationId: 'conv-success',
      sessionId: 'session-success',
      success: true,
    });
    expect(client.finalizeCalls[0].schemaDigest).toBeTypeOf('string');

    const nextSchema = editor.state.getSchema();
    const cardTreeId = getTreeIdBySchemaNodeId(nextSchema, 'card-1');
    const textTreeId = getTreeIdBySchemaNodeId(nextSchema, 'text-1');
    expect(cardTreeId).toBeTruthy();
    expect(textTreeId).toBeTruthy();
    expect(editor.history.getSize()).toBe(1);
    expect(commandLog.map((entry) => entry.commandId)).toEqual([
      'history.beginBatch',
      'node.patchProps',
      'node.append',
      'history.commitBatch',
    ]);

    await act(async () => {
      await editor.commands.execute('editor.undo');
    });

    expect(getTreeIdBySchemaNodeId(editor.state.getSchema(), 'text-1')).toBeUndefined();
    const restoredCardTreeId = getTreeIdBySchemaNodeId(editor.state.getSchema(), 'card-1');
    expect(restoredCardTreeId).toBeTruthy();
    expect(getSchemaNodeByTreeId(editor.state.getSchema(), restoredCardTreeId)?.props?.title).toBe('旧标题');
  });

  it('rolls back failed modify batches and finalizes failure with failedOpIndex', async () => {
    const { bridge, editor, commandLog } = createBridge();
    const client = new ScenarioAIClient([
      {
        type: 'run:start',
        data: { sessionId: 'session-failure', conversationId: 'conv-failure' },
      },
      {
        type: 'intent',
        data: { intent: 'schema.modify', confidence: 1 },
      },
      {
        type: 'modify:start',
        data: { operationCount: 2, explanation: '第二条会失败' },
      },
      {
        type: 'modify:op',
        data: {
          index: 0,
          operation: {
            op: 'schema.patchProps',
            nodeId: 'card-1',
            patch: { title: '临时标题' },
          },
        },
      },
      {
        type: 'modify:op',
        data: {
          index: 1,
          operation: {
            op: 'schema.removeNode',
            nodeId: 'missing-node',
          },
        },
      },
      {
        type: 'modify:done',
        data: {},
      },
      {
        type: 'done',
        data: {
          metadata: {
            sessionId: 'session-failure',
            conversationId: 'conv-failure',
          },
        },
      },
    ], {
      memoryDebugFile: '.ai-debug/memory/finalize-failure.json',
    });
    setAIClient(client);
    const onDone = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() => useAgentRun(bridge));

    await act(async () => {
      await result.current.runAgent(
        '删除一个不存在的节点',
        '',
        '',
        false,
        'conv-failure',
        () => 'message-2',
        vi.fn(),
        onDone,
        onError,
      );
    });

    expect(onDone).toHaveBeenCalledWith({
      sessionId: 'session-failure',
      conversationId: 'conv-failure',
      memoryDebugFile: '.ai-debug/memory/finalize-failure.json',
    });
    expect(client.requests).toHaveLength(1);
    expect(client.requests[0]).toMatchObject({
      prompt: '删除一个不存在的节点',
      intent: 'schema.modify',
      conversationId: 'conv-failure',
      selectedNodeId: 'card-1',
      context: {
        schemaJson: createInitialSchema(),
      },
    });
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining('修改失败：第 2 条 schema.removeNode 执行出错'),
    );
    expect(client.finalizeCalls).toHaveLength(1);
    expect(client.finalizeCalls[0]).toMatchObject({
      conversationId: 'conv-failure',
      sessionId: 'session-failure',
      success: false,
      failedOpIndex: 1,
    });
    expect(editor.history.getSize()).toBe(0);
    expect(commandLog.map((entry) => entry.commandId)).toEqual([
      'history.beginBatch',
      'node.patchProps',
      'history.discardBatch',
    ]);

    const currentSchema = editor.state.getSchema();
    const cardTreeId = getTreeIdBySchemaNodeId(currentSchema, 'card-1');
    expect(cardTreeId).toBeTruthy();
    expect(getTreeIdBySchemaNodeId(currentSchema, 'missing-node')).toBeUndefined();
    const container = Array.isArray(currentSchema.body) ? currentSchema.body[0] : currentSchema.body;
    const card = Array.isArray(container?.children) ? container.children[0] : undefined;
    expect(card?.props?.title).toBe('旧标题');
  });

  it('retries rollback during modify:done when the first discard attempt fails', async () => {
    const editor = createEditor({
      initialSchema: createInitialSchema(),
    });
    const commandLog: Array<{ commandId: string; args?: unknown }> = [];
    let discardAttempts = 0;
    const bridge: EditorAIBridge = {
      getSchema: () => editor.state.getSchema(),
      getSelectedNodeId: () => 'card-1',
      getAvailableComponents: () => [],
      execute: async (commandId, args) => {
        commandLog.push({ commandId, args });
        if (commandId === 'history.discardBatch') {
          discardAttempts += 1;
          if (discardAttempts === 1) {
            return { success: false, error: 'rollback blocked' };
          }
        }
        try {
          await editor.commands.execute(commandId, args);
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
      replaceSchema: (schema) => {
        void editor.commands.execute('schema.replace', { schema });
      },
      appendBlock: async (node, parentTreeId) => bridge.execute('node.append', { node, parentTreeId }),
      removeNode: async (treeId) => bridge.execute('node.remove', { treeId }),
      subscribe: () => () => undefined,
    };
    const client = new ScenarioAIClient([
      {
        type: 'run:start',
        data: { sessionId: 'session-retry', conversationId: 'conv-retry' },
      },
      {
        type: 'intent',
        data: { intent: 'schema.modify', confidence: 1 },
      },
      {
        type: 'modify:start',
        data: { operationCount: 2, explanation: '第二条失败且第一次回滚失败' },
      },
      {
        type: 'modify:op',
        data: {
          index: 0,
          operation: {
            op: 'schema.patchProps',
            nodeId: 'card-1',
            patch: { title: '临时标题' },
          },
        },
      },
      {
        type: 'modify:op',
        data: {
          index: 1,
          operation: {
            op: 'schema.removeNode',
            nodeId: 'missing-node',
          },
        },
      },
      {
        type: 'modify:done',
        data: {},
      },
      {
        type: 'done',
        data: {
          metadata: {
            sessionId: 'session-retry',
            conversationId: 'conv-retry',
          },
        },
      },
    ], {
      memoryDebugFile: '.ai-debug/memory/finalize-retry.json',
    });
    setAIClient(client);
    const onDone = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() => useAgentRun(bridge));

    await act(async () => {
      await result.current.runAgent(
        '删除一个不存在的节点并触发回滚重试',
        '',
        '',
        false,
        'conv-retry',
        () => 'message-3',
        vi.fn(),
        onDone,
        onError,
      );
    });

    expect(discardAttempts).toBe(2);
    expect(onDone).toHaveBeenCalledWith({
      sessionId: 'session-retry',
      conversationId: 'conv-retry',
      memoryDebugFile: '.ai-debug/memory/finalize-retry.json',
    });
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('回滚失败'));
    expect(client.finalizeCalls).toHaveLength(1);
    expect(client.finalizeCalls[0]).toMatchObject({
      conversationId: 'conv-retry',
      sessionId: 'session-retry',
      success: false,
      failedOpIndex: 1,
      error: expect.stringContaining('rollback failed'),
    });
    expect(commandLog.filter((entry) => entry.commandId === 'history.discardBatch')).toHaveLength(2);
    expect(editor.history.getSize()).toBe(0);
    expect(getSchemaNodeByTreeId(editor.state.getSchema(), 'body.0.children.0')?.props?.title).toBe('旧标题');
  });
});
