import { describe, expect, it, vi } from 'vitest';
import type { ComponentContract, PageSchema } from '@shenbi/schema';
import { createEditorAIBridge, type EditorBridgeSnapshot } from './editor-ai-bridge';

function createSchema(name: string): PageSchema {
  return {
    id: name,
    name,
    body: [],
  };
}

describe('createEditorAIBridge', () => {
  it('executes schema.replace successfully', async () => {
    const replaceSchema = vi.fn();
    const subscribe = vi.fn(() => () => undefined);
    const snapshot: EditorBridgeSnapshot = { schema: createSchema('initial') };
    const contracts: ComponentContract[] = [];
    const bridge = createEditorAIBridge({
      getSnapshot: () => snapshot,
      replaceSchema,
      getAvailableComponents: () => contracts,
      subscribe,
    });

    const result = await bridge.execute('schema.replace', {
      schema: createSchema('next'),
    });

    expect(result).toEqual({ success: true });
    expect(replaceSchema).toHaveBeenCalled();
  });

  it('returns error for unsupported command', async () => {
    const bridge = createEditorAIBridge({
      getSnapshot: () => ({ schema: createSchema('initial') }),
      replaceSchema: vi.fn(),
      getAvailableComponents: () => [],
      subscribe: () => () => undefined,
    });

    const result = await bridge.execute('unknown.command');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported command');
  });

  it('returns error when schema.replace args are invalid', async () => {
    const bridge = createEditorAIBridge({
      getSnapshot: () => ({ schema: createSchema('initial') }),
      replaceSchema: vi.fn(),
      getAvailableComponents: () => [],
      subscribe: () => () => undefined,
    });

    const result = await bridge.execute('schema.replace', { schema: {} });
    expect(result.success).toBe(false);
    expect(result.error).toContain('schema.body');
  });

  it('delegates subscribe/getters to options', () => {
    const snapshot: EditorBridgeSnapshot = {
      schema: createSchema('snapshot'),
      selectedNodeId: 'body.0',
    };
    const contracts: ComponentContract[] = [
      {
        componentType: 'Button',
        version: '1.0.0',
      },
    ];
    const subscribe = vi.fn((listener: (value: EditorBridgeSnapshot) => void) => {
      listener(snapshot);
      return () => undefined;
    });
    const bridge = createEditorAIBridge({
      getSnapshot: () => snapshot,
      replaceSchema: vi.fn(),
      getAvailableComponents: () => contracts,
      subscribe,
    });
    const listener = vi.fn();

    const unsubscribe = bridge.subscribe(listener);

    expect(bridge.getSchema()).toBe(snapshot.schema);
    expect(bridge.getSelectedNodeId()).toBe('body.0');
    expect(bridge.getAvailableComponents()).toBe(contracts);
    expect(listener).toHaveBeenCalledWith(snapshot);
    expect(typeof unsubscribe).toBe('function');
  });
});
