import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useSelectionSync, type SelectionSyncMode } from './useSelectionSync';

interface TestSchema {
  validTreeIds: string[];
  schemaToTreeMap: Record<string, string>;
}

interface TreeNode {
  id: string;
}

interface HarnessOptions {
  mode: SelectionSyncMode;
  initialShellSelectedNodeId: string | undefined;
  initialScenarioSelectedNodeId: string | undefined;
  schema: TestSchema;
  treeNodes: TreeNode[];
}

function useSelectionSyncHarness(options: HarnessOptions) {
  const [shellSelectedNodeId, setShellSelectedNodeId] = useState<string | undefined>(
    options.initialShellSelectedNodeId,
  );
  const [scenarioSelectedNodeId, setScenarioSelectedNodeId] = useState<string | undefined>(
    options.initialScenarioSelectedNodeId,
  );

  const sync = useSelectionSync({
    mode: options.mode,
    schema: options.schema,
    treeNodes: options.treeNodes,
    shellSelectedNodeId,
    scenarioSelectedNodeId,
    setShellSelectedNodeId,
    setScenarioSelectedNodeId,
    getNodeByTreeId: (schema, treeId) => (schema.validTreeIds.includes(treeId) ? { id: treeId } : undefined),
    getDefaultSelectedNodeId: (treeNodes) => treeNodes[0]?.id,
    getTreeIdBySchemaNodeId: (schema, schemaNodeId) => schema.schemaToTreeMap[schemaNodeId],
  });

  return {
    ...sync,
    shellSelectedNodeId,
    scenarioSelectedNodeId,
  };
}

describe('useSelectionSync', () => {
  it('shell 模式下当前选中节点失效时会回退到默认节点', async () => {
    const { result } = renderHook(() => useSelectionSyncHarness({
      mode: 'shell',
      initialShellSelectedNodeId: 'missing-tree',
      initialScenarioSelectedNodeId: undefined,
      schema: {
        validTreeIds: ['tree-root', 'tree-card'],
        schemaToTreeMap: {},
      },
      treeNodes: [{ id: 'tree-root' }, { id: 'tree-card' }],
    }));

    await waitFor(() => {
      expect(result.current.selectedNodeId).toBe('tree-root');
      expect(result.current.shellSelectedNodeId).toBe('tree-root');
    });
  });

  it('scenarios 模式下保留有效选中节点', async () => {
    const { result } = renderHook(() => useSelectionSyncHarness({
      mode: 'scenarios',
      initialShellSelectedNodeId: 'tree-root',
      initialScenarioSelectedNodeId: 'tree-card',
      schema: {
        validTreeIds: ['tree-root', 'tree-card'],
        schemaToTreeMap: {},
      },
      treeNodes: [{ id: 'tree-root' }, { id: 'tree-card' }],
    }));

    await waitFor(() => {
      expect(result.current.selectedNodeId).toBe('tree-card');
      expect(result.current.scenarioSelectedNodeId).toBe('tree-card');
    });
  });

  it('selectTreeNode 根据模式写入对应状态', async () => {
    const { result } = renderHook(() => useSelectionSyncHarness({
      mode: 'shell',
      initialShellSelectedNodeId: 'tree-root',
      initialScenarioSelectedNodeId: 'tree-card',
      schema: {
        validTreeIds: ['tree-root', 'tree-card'],
        schemaToTreeMap: {},
      },
      treeNodes: [{ id: 'tree-root' }, { id: 'tree-card' }],
    }));

    act(() => {
      result.current.selectTreeNode('tree-card');
    });

    await waitFor(() => {
      expect(result.current.shellSelectedNodeId).toBe('tree-card');
      expect(result.current.scenarioSelectedNodeId).toBe('tree-card');
    });
  });

  it('selectSchemaNode 能通过映射定位并选中 tree 节点', async () => {
    const { result } = renderHook(() => useSelectionSyncHarness({
      mode: 'scenarios',
      initialShellSelectedNodeId: undefined,
      initialScenarioSelectedNodeId: undefined,
      schema: {
        validTreeIds: ['tree-root', 'tree-card'],
        schemaToTreeMap: {
          'schema-card': 'tree-card',
        },
      },
      treeNodes: [{ id: 'tree-root' }, { id: 'tree-card' }],
    }));

    act(() => {
      result.current.selectSchemaNode('schema-card');
    });

    await waitFor(() => {
      expect(result.current.selectedNodeId).toBe('tree-card');
      expect(result.current.scenarioSelectedNodeId).toBe('tree-card');
    });
  });
});
