import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEditor, getSchemaNodeByTreeId, getTreeIdBySchemaNodeId } from '@shenbi/editor-core';
import type { PageSchema } from '@shenbi/schema';
import type { AgentEvent, FinalizeRequest, RunRequest } from '../ai/api-types';
import type { EditorAIBridge } from '../ai/editor-ai-bridge';
import { resetAIClient } from '../ai/sse-client';
import { AIPanel } from './AIPanel';

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

  const bridge: EditorAIBridge = {
    getSchema: () => editor.state.getSchema(),
    getSelectedNodeId: () => 'card-1',
    getAvailableComponents: () => [],
    execute: async (commandId, args) => {
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
    subscribe: (listener) => {
      listener({
        schema: editor.state.getSchema(),
        selectedNodeId: 'card-1',
      });
      return () => undefined;
    },
  };

  return { bridge, editor };
}

function createSSEBody(events: AgentEvent[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });
}

describe('AIPanel integration', () => {
  const fetchMock = vi.fn();
  const streamRequests: RunRequest[] = [];
  const finalizeRequests: FinalizeRequest[] = [];

  beforeEach(() => {
    streamRequests.length = 0;
    finalizeRequests.length = 0;
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    resetAIClient();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

      if (url.endsWith('/api/ai/models')) {
        return new Response(JSON.stringify({
          success: true,
          data: [
            { id: 'openai-compatible::GLM-4.7', name: 'GLM-4.7', provider: 'openai-compatible' },
            { id: 'openai-compatible::GLM-4.6', name: 'GLM-4.6', provider: 'openai-compatible' },
          ],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/ai/run/stream')) {
        streamRequests.push(JSON.parse(String(init?.body)) as RunRequest);
        const events: AgentEvent[] = [
          {
            type: 'run:start',
            data: { sessionId: 'session-ui-success', conversationId: 'conv-ui-success' },
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
            type: 'message:delta',
            data: { text: '正在更新当前卡片。' },
          },
          {
            type: 'modify:start',
            data: { operationCount: 2, explanation: '更新标题并补充说明' },
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
                sessionId: 'session-ui-success',
                conversationId: 'conv-ui-success',
                debugFile: '.ai-debug/traces/2026-03-11-ui-success.json',
                durationMs: 222,
                tokensUsed: 88,
              },
            },
          },
        ];
        return new Response(createSSEBody(events), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }

      if (url.endsWith('/api/ai/run/finalize')) {
        finalizeRequests.push(JSON.parse(String(init?.body)) as FinalizeRequest);
        return new Response(JSON.stringify({
          success: true,
          data: {
            memoryDebugFile: '.ai-debug/memory/2026-03-11-ui-finalize.json',
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });
  });

  afterEach(() => {
    resetAIClient();
    vi.unstubAllGlobals();
  });

  it('runs a real modify stream through fetch, updates the editor, and surfaces trace files', async () => {
    const { bridge, editor } = createBridge();

    render(<AIPanel bridge={bridge} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Planner')).toHaveValue('openai-compatible::GLM-4.7');
    });

    fireEvent.change(
      screen.getByPlaceholderText('输入调试提示词，Enter 发送，Shift+Enter 换行'),
      { target: { value: '把当前卡片标题改成新标题，并追加一段说明' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(screen.getByText('Trace File: .ai-debug/traces/2026-03-11-ui-success.json')).toBeInTheDocument();
      expect(screen.getByText('Memory Dump: .ai-debug/memory/2026-03-11-ui-finalize.json')).toBeInTheDocument();
      expect(screen.getByText('耗时: 222ms')).toBeInTheDocument();
      expect(screen.getByText('Tokens: 88')).toBeInTheDocument();
      expect(screen.getByText('正在更新当前卡片。')).toBeInTheDocument();
    });

    expect(streamRequests).toHaveLength(1);
    expect(streamRequests[0]).toMatchObject({
      prompt: '把当前卡片标题改成新标题，并追加一段说明',
      conversationId: expect.stringContaining('conv-'),
      selectedNodeId: 'card-1',
      context: {
        schemaJson: createInitialSchema(),
      },
    });

    expect(finalizeRequests).toHaveLength(1);
    expect(finalizeRequests[0]).toMatchObject({
      conversationId: 'conv-ui-success',
      sessionId: 'session-ui-success',
      success: true,
    });
    expect(finalizeRequests[0].schemaDigest).toBeTypeOf('string');

    const nextSchema = editor.state.getSchema();
    const cardTreeId = getTreeIdBySchemaNodeId(nextSchema, 'card-1');
    const textTreeId = getTreeIdBySchemaNodeId(nextSchema, 'text-1');
    expect(cardTreeId).toBeTruthy();
    expect(textTreeId).toBeTruthy();
    expect(getSchemaNodeByTreeId(nextSchema, cardTreeId!)?.props?.title).toBe('新标题');
    expect(editor.history.getSize()).toBe(1);

    await act(async () => {
      await editor.commands.execute('editor.undo');
    });

    expect(getTreeIdBySchemaNodeId(editor.state.getSchema(), 'text-1')).toBeUndefined();
    const restoredCardTreeId = getTreeIdBySchemaNodeId(editor.state.getSchema(), 'card-1');
    expect(restoredCardTreeId).toBeTruthy();
    expect(getSchemaNodeByTreeId(editor.state.getSchema(), restoredCardTreeId!)?.props?.title).toBe('旧标题');
  });
});
