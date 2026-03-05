import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useNodePatchDispatch } from './useNodePatchDispatch';

interface MockSchema {
  marker: string;
}

function createPatchFns() {
  return {
    patchSchemaNodeProps: vi.fn((schema: MockSchema) => ({ ...schema, marker: 'props' })),
    patchSchemaNodeEvents: vi.fn((schema: MockSchema) => ({ ...schema, marker: 'events' })),
    patchSchemaNodeStyle: vi.fn((schema: MockSchema) => ({ ...schema, marker: 'style' })),
    patchSchemaNodeLogic: vi.fn((schema: MockSchema) => ({ ...schema, marker: 'logic' })),
    patchSchemaNodeColumns: vi.fn((schema: MockSchema) => ({ ...schema, marker: 'columns' })),
  };
}

describe('useNodePatchDispatch', () => {
  it('shell 模式下会分发到 node.patch* 命令', () => {
    const executeShellCommand = vi.fn();
    const updateScenarioSchema = vi.fn();
    const patchFns = createPatchFns();

    const { result } = renderHook(() => useNodePatchDispatch<MockSchema>({
      mode: 'shell',
      selectedNodeId: 'tree-card',
      executeShellCommand,
      updateScenarioSchema,
      ...patchFns,
    }));

    act(() => {
      result.current.handlePatchProps({ title: 'A' });
      result.current.handlePatchEvents({ onClick: [] });
      result.current.handlePatchStyle({ color: 'red' });
      result.current.handlePatchLogic({ if: '{{true}}' });
      result.current.handlePatchColumns([{ key: 'id' }]);
    });

    expect(executeShellCommand).toHaveBeenCalledWith('node.patchProps', {
      treeId: 'tree-card',
      patch: { title: 'A' },
    });
    expect(executeShellCommand).toHaveBeenCalledWith('node.patchEvents', {
      treeId: 'tree-card',
      patch: { onClick: [] },
    });
    expect(executeShellCommand).toHaveBeenCalledWith('node.patchStyle', {
      treeId: 'tree-card',
      patch: { color: 'red' },
    });
    expect(executeShellCommand).toHaveBeenCalledWith('node.patchLogic', {
      treeId: 'tree-card',
      patch: { if: '{{true}}' },
    });
    expect(executeShellCommand).toHaveBeenCalledWith('node.patchColumns', {
      treeId: 'tree-card',
      columns: [{ key: 'id' }],
    });
    expect(updateScenarioSchema).not.toHaveBeenCalled();
  });

  it('shell 模式下无选中节点时不分发命令', () => {
    const executeShellCommand = vi.fn();
    const patchFns = createPatchFns();
    const { result } = renderHook(() => useNodePatchDispatch<MockSchema>({
      mode: 'shell',
      selectedNodeId: undefined,
      executeShellCommand,
      updateScenarioSchema: vi.fn(),
      ...patchFns,
    }));

    act(() => {
      result.current.handlePatchProps({ title: 'A' });
    });

    expect(executeShellCommand).not.toHaveBeenCalled();
  });

  it('scenarios 模式下会走 schema patch 回写', () => {
    const executeShellCommand = vi.fn();
    const updateScenarioSchema = vi.fn((updater: (schema: MockSchema) => MockSchema) => {
      const next = updater({ marker: 'init' });
      expect(next.marker).toBe('props');
    });
    const patchFns = createPatchFns();

    const { result } = renderHook(() => useNodePatchDispatch<MockSchema>({
      mode: 'scenarios',
      selectedNodeId: 'tree-card',
      executeShellCommand,
      updateScenarioSchema,
      ...patchFns,
    }));

    act(() => {
      result.current.handlePatchProps({ title: 'B' });
    });

    expect(updateScenarioSchema).toHaveBeenCalledTimes(1);
    expect(patchFns.patchSchemaNodeProps).toHaveBeenCalledWith(
      { marker: 'init' },
      'tree-card',
      { title: 'B' },
    );
    expect(executeShellCommand).not.toHaveBeenCalled();
  });
});
