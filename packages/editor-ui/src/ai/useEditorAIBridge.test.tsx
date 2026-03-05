import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PageSchema } from '@shenbi/schema';
import { useEditorAIBridge } from './useEditorAIBridge';

function createSchema(name: string): PageSchema {
  return {
    id: name,
    name,
    body: [],
  };
}

describe('useEditorAIBridge', () => {
  it('订阅时会立即收到快照，schema 更新会广播', async () => {
    const replaceSchema = vi.fn();
    const getAvailableComponents = vi.fn(() => []);
    const listener = vi.fn();

    const { result, rerender } = renderHook((props: { schema: PageSchema; selectedNodeId?: string }) => useEditorAIBridge({
      schema: props.schema,
      selectedNodeId: props.selectedNodeId,
      replaceSchema,
      getAvailableComponents,
    }), {
      initialProps: { schema: createSchema('first'), selectedNodeId: 'body.0' },
    });

    const unsubscribe = result.current.subscribe(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith({
      schema: createSchema('first'),
      selectedNodeId: 'body.0',
    });

    rerender({ schema: createSchema('second'), selectedNodeId: 'body.1' });

    await waitFor(() => {
      expect(listener).toHaveBeenCalledTimes(2);
    });
    expect(listener).toHaveBeenLastCalledWith({
      schema: createSchema('second'),
      selectedNodeId: 'body.1',
    });

    unsubscribe();
    rerender({ schema: createSchema('third'), selectedNodeId: 'body.2' });
    await waitFor(() => {
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  it('execute schema.replace 会调用 replaceSchema', async () => {
    const replaceSchema = vi.fn();
    const { result } = renderHook(() => useEditorAIBridge({
      schema: createSchema('initial'),
      selectedNodeId: 'body.0',
      replaceSchema,
      getAvailableComponents: () => [],
    }));

    await act(async () => {
      await result.current.execute('schema.replace', {
        schema: createSchema('next'),
      });
    });

    expect(replaceSchema).toHaveBeenCalledWith(createSchema('next'));
  });
});
