import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PageSchema } from '@shenbi/schema';
import { usePluginContext } from './use-plugin-context';

function createSchema(name: string): PageSchema {
  return {
    id: name,
    name,
    body: [],
  };
}

describe('usePluginContext', () => {
  it('document/selection subscribe 会同步最新状态', () => {
    const replaceSchema = vi.fn();
    const executeCommand = vi.fn();
    const patchSelectedNode = {
      props: vi.fn(),
    };
    const { result, rerender } = renderHook((props: { name: string; selectedNodeId?: string }) => usePluginContext({
      schema: createSchema(props.name),
      selectedNode: props.selectedNodeId
        ? { id: props.selectedNodeId, component: 'Button' }
        : undefined,
      selectedNodeId: props.selectedNodeId,
      replaceSchema,
      patchSelectedNode,
      executeCommand,
    }), {
      initialProps: { name: 'initial', selectedNodeId: 'body.0' },
    });

    const documentListener = vi.fn();
    const selectionListener = vi.fn();
    const unsubscribeDocument = result.current.document?.subscribe?.(documentListener);
    const unsubscribeSelection = result.current.selection?.subscribe?.(selectionListener);

    expect(documentListener).toHaveBeenLastCalledWith(createSchema('initial'));
    expect(selectionListener).toHaveBeenLastCalledWith('body.0');

    rerender({ name: 'next', selectedNodeId: 'body.1' });

    expect(result.current.document?.getSchema?.().name).toBe('next');
    expect(result.current.selection?.getSelectedNodeId?.()).toBe('body.1');
    expect(documentListener).toHaveBeenLastCalledWith(createSchema('next'));
    expect(selectionListener).toHaveBeenLastCalledWith('body.1');

    unsubscribeDocument?.();
    unsubscribeSelection?.();
  });

  it('commands 和 replaceSchema 会透传到宿主实现', async () => {
    const replaceSchema = vi.fn();
    const executeCommand = vi.fn(async () => 'ok');
    const { result } = renderHook(() => usePluginContext({
      schema: createSchema('initial'),
      selectedNode: undefined,
      selectedNodeId: undefined,
      replaceSchema,
      patchSelectedNode: {},
      executeCommand,
      notifications: { success: vi.fn() },
    }));

    act(() => {
      result.current.document?.replaceSchema?.(createSchema('next'));
    });
    expect(replaceSchema).toHaveBeenCalledWith(createSchema('next'));

    await expect(result.current.commands?.execute?.('file.saveSchema')).resolves.toBe('ok');
    expect(executeCommand).toHaveBeenCalledWith('file.saveSchema');
  });
});
