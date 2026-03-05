import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';

export type SelectionSyncMode = 'shell' | 'scenarios';

export interface UseSelectionSyncOptions<TSchema, TTreeNode> {
  mode: SelectionSyncMode;
  schema: TSchema;
  treeNodes: TTreeNode[];
  shellSelectedNodeId: string | undefined;
  scenarioSelectedNodeId: string | undefined;
  setShellSelectedNodeId: (nextNodeId: string | undefined) => void;
  setScenarioSelectedNodeId: Dispatch<SetStateAction<string | undefined>>;
  getNodeByTreeId: (schema: TSchema, treeId: string) => unknown;
  getDefaultSelectedNodeId: (treeNodes: TTreeNode[]) => string | undefined;
  getTreeIdBySchemaNodeId: (schema: TSchema, schemaNodeId: string) => string | undefined;
}

export interface UseSelectionSyncResult {
  selectedNodeId: string | undefined;
  selectTreeNode: (treeNodeId: string) => void;
  selectSchemaNode: (schemaNodeId: string) => void;
}

export function useSelectionSync<TSchema, TTreeNode>(
  options: UseSelectionSyncOptions<TSchema, TTreeNode>,
): UseSelectionSyncResult {
  const {
    mode,
    schema,
    treeNodes,
    shellSelectedNodeId,
    scenarioSelectedNodeId,
    setShellSelectedNodeId,
    setScenarioSelectedNodeId,
    getNodeByTreeId,
    getDefaultSelectedNodeId,
    getTreeIdBySchemaNodeId,
  } = options;

  useEffect(() => {
    if (mode === 'shell') {
      const currentSelected = shellSelectedNodeId;
      if (currentSelected && getNodeByTreeId(schema, currentSelected)) {
        return;
      }

      const nextDefault = getDefaultSelectedNodeId(treeNodes);
      if (nextDefault !== currentSelected) {
        setShellSelectedNodeId(nextDefault);
      }
      return;
    }

    setScenarioSelectedNodeId((previousNodeId) => {
      if (previousNodeId && getNodeByTreeId(schema, previousNodeId)) {
        return previousNodeId;
      }
      return getDefaultSelectedNodeId(treeNodes);
    });
  }, [
    getDefaultSelectedNodeId,
    getNodeByTreeId,
    mode,
    schema,
    setScenarioSelectedNodeId,
    setShellSelectedNodeId,
    shellSelectedNodeId,
    treeNodes,
  ]);

  const selectedNodeId = useMemo(
    () => (mode === 'shell' ? shellSelectedNodeId : scenarioSelectedNodeId),
    [mode, scenarioSelectedNodeId, shellSelectedNodeId],
  );

  const selectTreeNode = useCallback((treeNodeId: string) => {
    if (mode === 'shell') {
      setShellSelectedNodeId(treeNodeId);
      return;
    }
    setScenarioSelectedNodeId(treeNodeId);
  }, [mode, setScenarioSelectedNodeId, setShellSelectedNodeId]);

  const selectSchemaNode = useCallback((schemaNodeId: string) => {
    const treeNodeId = getTreeIdBySchemaNodeId(schema, schemaNodeId);
    if (!treeNodeId) {
      return;
    }
    selectTreeNode(treeNodeId);
  }, [getTreeIdBySchemaNodeId, schema, selectTreeNode]);

  return {
    selectedNodeId,
    selectTreeNode,
    selectSchemaNode,
  };
}
