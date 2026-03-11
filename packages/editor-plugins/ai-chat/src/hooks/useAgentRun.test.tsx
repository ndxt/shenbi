import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunRequest } from '../ai/api-types';
import { resetAIClient, setAIClient } from '../ai/sse-client';
import { useAgentRun } from './useAgentRun';
import type { EditorAIBridge } from '../ai/editor-ai-bridge';

function createBridge() {
  let schema = {
    id: 'page-1',
    body: [
      {
        id: 'card-1',
        component: 'Card',
        children: [],
      },
    ],
  };
  const execute = vi.fn(async (commandId: string, args?: any) => {
    if (commandId === 'node.patchProps' && args?.treeId === 'body.0') {
      schema = {
        ...schema,
        body: [
          {
            ...schema.body[0],
            props: {
              title: args.patch.title,
            },
          },
        ],
      };
    }
    return { success: true };
  });
  const bridge: EditorAIBridge = {
    getSchema: () => schema,
    getSelectedNodeId: () => 'card-1',
    getAvailableComponents: () => [],
    execute,
    replaceSchema: vi.fn(),
    appendBlock: vi.fn(),
    removeNode: vi.fn(),
    subscribe: () => () => undefined,
  };
  return { bridge, execute };
}

afterEach(() => {
  resetAIClient();
});

describe('useAgentRun', () => {
  it('executes modify operations inside a single history batch and sends schemaJson', async () => {
    const { bridge, execute } = createBridge();
    const requests: RunRequest[] = [];
    const finalize = vi.fn(async () => undefined);
    setAIClient({
      async *runStream(request) {
        requests.push(request);
        yield { type: 'run:start', data: { sessionId: 'session-1' } };
        yield { type: 'intent', data: { intent: 'schema.modify', confidence: 0.9 } };
        yield { type: 'message:start', data: { role: 'assistant' } };
        yield { type: 'message:delta', data: { text: '准备修改当前卡片。' } };
        yield { type: 'modify:start', data: { operationCount: 1, explanation: '准备修改当前卡片。' } };
        yield {
          type: 'modify:op',
          data: {
            index: 0,
            operation: {
              op: 'schema.patchProps',
              nodeId: 'card-1',
              patch: { title: '本月营收' },
            },
          },
        };
        yield { type: 'modify:done', data: {} };
        yield { type: 'done', data: { metadata: { sessionId: 'session-1' } } };
      },
      finalize,
    });

    const onMessageStart = vi.fn(() => 'message-1');
    const onMessageDelta = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() => useAgentRun(bridge));

    await act(async () => {
      await result.current.runAgent(
        '把当前卡片标题改成本月营收',
        'planner-model',
        'block-model',
        false,
        'conv-1',
        onMessageStart,
        onMessageDelta,
        onDone,
        onError,
      );
    });

    expect(onError).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith({ sessionId: 'session-1' });
    expect(onMessageDelta).toHaveBeenCalledWith('message-1', '准备修改当前卡片。');
    expect(requests[0]?.intent).toBe('schema.modify');
    expect(requests[0]?.context.schemaJson).toEqual({
      id: 'page-1',
      body: [
        {
          id: 'card-1',
          component: 'Card',
          children: [],
        },
      ],
    });
    expect(finalize).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      sessionId: 'session-1',
      success: true,
    });
    expect(execute.mock.calls.map(([commandId]) => commandId)).toEqual([
      'history.beginBatch',
      'node.patchProps',
      'history.commitBatch',
    ]);
  });

  it('discards failed modify batches and reports the failed op index', async () => {
    const { bridge, execute } = createBridge();
    execute.mockImplementation(async (commandId: string, args?: any) => {
      if (commandId === 'node.patchProps' && args?.treeId === 'body.0') {
        return { success: false, error: 'node missing' };
      }
      return { success: true };
    });
    const finalize = vi.fn(async () => undefined);

    setAIClient({
      async *runStream() {
        yield { type: 'run:start', data: { sessionId: 'session-2' } };
        yield { type: 'intent', data: { intent: 'schema.modify', confidence: 1 } };
        yield { type: 'message:start', data: { role: 'assistant' } };
        yield { type: 'modify:start', data: { operationCount: 1, explanation: '准备修改当前卡片。' } };
        yield {
          type: 'modify:op',
          data: {
            index: 0,
            operation: {
              op: 'schema.patchProps',
              nodeId: 'card-1',
              patch: { title: '本月营收' },
            },
          },
        };
        yield { type: 'modify:done', data: {} };
        yield { type: 'done', data: { metadata: { sessionId: 'session-2' } } };
      },
      finalize,
    });

    const onError = vi.fn();
    const { result } = renderHook(() => useAgentRun(bridge));

    await act(async () => {
      await result.current.runAgent(
        '把当前卡片标题改成本月营收',
        'planner-model',
        'block-model',
        false,
        'conv-2',
        () => 'message-1',
        vi.fn(),
        vi.fn(),
        onError,
      );
    });

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('第 1 条'));
    expect(execute.mock.calls.map(([commandId]) => commandId)).toEqual([
      'history.beginBatch',
      'node.patchProps',
      'history.discardBatch',
    ]);
    expect(finalize).toHaveBeenCalledWith({
      conversationId: 'conv-2',
      sessionId: 'session-2',
      success: false,
      failedOpIndex: 0,
      error: 'node missing',
    });
  });

  it('retries rollback during modify:done when the first discard attempt fails', async () => {
    const { bridge, execute } = createBridge();
    let discardAttempts = 0;
    execute.mockImplementation(async (commandId: string, args?: any) => {
      if (commandId === 'node.patchProps' && args?.treeId === 'body.0') {
        return { success: false, error: 'node missing' };
      }
      if (commandId === 'history.discardBatch') {
        discardAttempts += 1;
        return discardAttempts === 1
          ? { success: false, error: 'rollback blocked' }
          : { success: true };
      }
      return { success: true };
    });
    const finalize = vi.fn(async () => undefined);

    setAIClient({
      async *runStream() {
        yield { type: 'run:start', data: { sessionId: 'session-3' } };
        yield { type: 'intent', data: { intent: 'schema.modify', confidence: 1 } };
        yield { type: 'message:start', data: { role: 'assistant' } };
        yield { type: 'modify:start', data: { operationCount: 1, explanation: '准备修改当前卡片。' } };
        yield {
          type: 'modify:op',
          data: {
            index: 0,
            operation: {
              op: 'schema.patchProps',
              nodeId: 'card-1',
              patch: { title: '本月营收' },
            },
          },
        };
        yield { type: 'modify:done', data: {} };
        yield { type: 'done', data: { metadata: { sessionId: 'session-3' } } };
      },
      finalize,
    });

    const onError = vi.fn();
    const { result } = renderHook(() => useAgentRun(bridge));

    await act(async () => {
      await result.current.runAgent(
        '把当前卡片标题改成本月营收',
        'planner-model',
        'block-model',
        false,
        'conv-3',
        () => 'message-1',
        vi.fn(),
        vi.fn(),
        onError,
      );
    });

    expect(execute.mock.calls.filter(([commandId]) => commandId === 'history.discardBatch')).toHaveLength(2);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('回滚失败'));
    expect(finalize).toHaveBeenCalledWith({
      conversationId: 'conv-3',
      sessionId: 'session-3',
      success: false,
      failedOpIndex: 0,
      error: expect.stringContaining('rollback failed'),
    });
  });
});
