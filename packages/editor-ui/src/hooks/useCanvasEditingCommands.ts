import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  buildEditorTree,
  canSchemaNodeAcceptCanvasChildren,
  cloneSchemaNodeWithFreshIds,
  getAncestorChain,
  getContainerNodeCount,
  getDefaultSelectedNodeId,
  getSchemaNodeByTreeId,
  getTreeArrayPosition,
  getTreeIdBySchemaNodeId,
  patchSchemaNodeColumns,
  patchSchemaNodeEvents,
  patchSchemaNodeLogic,
  patchSchemaNodeProps,
  patchSchemaNodeStyle,
  removeSchemaNode,
  resolveCanvasDropPosition,
} from '@shenbi/editor-core';
import { createSchemaNodeFromContract, getBuiltinContract, type PageSchema } from '@shenbi/schema';
import type { SchemaNode } from '@shenbi/schema';
import type { CanvasDropTarget } from '../canvas/types';
import { useNodePatchDispatch } from './useNodePatchDispatch';
import { useSelectionSync } from './useSelectionSync';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'unknown error';
}

export interface CanvasEditingState {
  treeNodes: ReturnType<typeof buildEditorTree>;
  selectedNodeId?: string | undefined;
  selectedNode?: SchemaNode | undefined;
  selectedContract?: ReturnType<typeof getBuiltinContract> | undefined;
  breadcrumbItems: ReturnType<typeof getAncestorChain>;
  breadcrumbHoveredSchemaId: string | null;
  canDeleteSelectedNode: boolean;
  canDuplicateSelectedNode: boolean;
  canMoveSelectedNodeUp: boolean;
  canMoveSelectedNodeDown: boolean;
  patchSelectedNode: {
    props: (patch: Record<string, unknown>) => void;
    columns: (columns: unknown[]) => void;
    style: (patch: Record<string, unknown>) => void;
    events: (patch: Record<string, unknown>) => void;
    logic: (patch: Record<string, unknown>) => void;
  };
  selectTreeNode: (treeNodeId: string) => void;
  handleCanvasSelectNode: (schemaNodeId: string) => void;
  handleCanvasDeselectNode: () => void;
  handleBreadcrumbSelect: (treeNodeId: string) => void;
  handleBreadcrumbHover: (treeNodeId: string | null) => void;
  handleInsertComponent: (componentType: string) => void;
  handleDeleteSelectedNode: () => void;
  handleDuplicateSelectedNode: () => void;
  moveSelectedNode: (direction: -1 | 1) => void;
  handleCanvasInsertComponent: (componentType: string, target: CanvasDropTarget) => void;
  handleCanvasMoveSelectedNode: (target: CanvasDropTarget) => void;
  canCanvasDropInsideNode: (schemaNodeId: string | undefined) => boolean;
}

export interface UseCanvasEditingCommandsOptions {
  appMode: 'shell' | 'scenarios';
  activeSchema: PageSchema;
  executeScenarioCommand: (commandId: string, payload: Record<string, unknown>) => Promise<unknown> | unknown;
  shellCommands: {
    execute: (commandId: string, payload?: unknown) => Promise<unknown>;
  };
  notifyCommandLocked: () => boolean;
  scenarioSelectedNodeId?: string | undefined;
  setScenarioSelectedNodeId: (nodeId: string | undefined) => void;
  shellSelectedNodeId?: string | undefined;
  setShellSelectedNodeId: (nodeId: string | undefined) => void;
  updateScenarioSchema: (updater: (schema: PageSchema) => PageSchema) => void;
  onError?: (message: string) => void;
}

export function useCanvasEditingCommands({
  appMode,
  activeSchema,
  executeScenarioCommand,
  shellCommands,
  notifyCommandLocked,
  scenarioSelectedNodeId,
  setScenarioSelectedNodeId,
  shellSelectedNodeId,
  setShellSelectedNodeId,
  updateScenarioSchema,
  onError,
}: UseCanvasEditingCommandsOptions): CanvasEditingState {
  const treeNodes = useMemo(() => buildEditorTree(activeSchema), [activeSchema]);
  const executeShellCommand = useCallback((commandId: string, payload: Record<string, unknown>) => {
    void shellCommands.execute(commandId, payload).catch((error) => {
      onError?.(`节点更新失败: ${getErrorMessage(error)}`);
    });
  }, [onError, shellCommands]);

  const { selectedNodeId, selectTreeNode, selectSchemaNode } = useSelectionSync({
    mode: appMode,
    schema: activeSchema,
    treeNodes,
    shellSelectedNodeId,
    scenarioSelectedNodeId,
    setShellSelectedNodeId: setShellSelectedNodeId as Dispatch<SetStateAction<string | undefined>>,
    setScenarioSelectedNodeId: setScenarioSelectedNodeId as Dispatch<SetStateAction<string | undefined>>,
    getNodeByTreeId: getSchemaNodeByTreeId,
    getDefaultSelectedNodeId,
    getTreeIdBySchemaNodeId,
  });

  const selectedNode = useMemo(
    () => getSchemaNodeByTreeId(activeSchema, selectedNodeId),
    [activeSchema, selectedNodeId],
  );
  const selectedContract = useMemo(
    () => (selectedNode ? getBuiltinContract(selectedNode.component) : undefined),
    [selectedNode],
  );
  const selectedNodePosition = useMemo(
    () => getTreeArrayPosition(selectedNodeId),
    [selectedNodeId],
  );
  const selectedNodeSiblingCount = useMemo(
    () => (
      selectedNodePosition
        ? getContainerNodeCount(activeSchema, selectedNodePosition.targetParentTreeId)
        : 0
    ),
    [activeSchema, selectedNodePosition],
  );
  const canDeleteSelectedNode = Boolean(selectedNodeId);
  const canDuplicateSelectedNode = Boolean(selectedNodeId && selectedNode);
  const canMoveSelectedNodeUp = Boolean(
    selectedNodePosition && selectedNodePosition.index > 0,
  );
  const canMoveSelectedNodeDown = Boolean(
    selectedNodePosition && selectedNodePosition.index < selectedNodeSiblingCount - 1,
  );
  const breadcrumbItems = useMemo(
    () => getAncestorChain(treeNodes, selectedNodeId),
    [treeNodes, selectedNodeId],
  );

  const {
    handlePatchProps,
    handlePatchEvents,
    handlePatchColumns,
    handlePatchStyle,
    handlePatchLogic,
  } = useNodePatchDispatch({
    mode: appMode,
    selectedNodeId,
    executeShellCommand,
    updateScenarioSchema,
    patchSchemaNodeProps,
    patchSchemaNodeEvents,
    patchSchemaNodeStyle,
    patchSchemaNodeLogic,
    patchSchemaNodeColumns,
  });

  const patchSelectedNode = useMemo(() => ({
    props: (patch: Record<string, unknown>) => {
      if (!notifyCommandLocked()) {
        handlePatchProps?.(patch);
      }
    },
    columns: (columns: unknown[]) => {
      if (!notifyCommandLocked()) {
        handlePatchColumns?.(columns);
      }
    },
    style: (patch: Record<string, unknown>) => {
      if (!notifyCommandLocked()) {
        handlePatchStyle?.(patch);
      }
    },
    events: (patch: Record<string, unknown>) => {
      if (!notifyCommandLocked()) {
        handlePatchEvents?.(patch);
      }
    },
    logic: (patch: Record<string, unknown>) => {
      if (!notifyCommandLocked()) {
        handlePatchLogic?.(patch);
      }
    },
  }), [
    handlePatchColumns,
    handlePatchEvents,
    handlePatchLogic,
    handlePatchProps,
    handlePatchStyle,
    notifyCommandLocked,
  ]);

  const handleCanvasSelectNode = useCallback((schemaNodeId: string) => {
    if (!notifyCommandLocked()) {
      selectSchemaNode(schemaNodeId);
    }
  }, [notifyCommandLocked, selectSchemaNode]);

  const handleCanvasDeselectNode = useCallback(() => {
    if (!notifyCommandLocked()) {
      selectTreeNode(getDefaultSelectedNodeId(treeNodes) ?? '');
    }
  }, [notifyCommandLocked, selectTreeNode, treeNodes]);

  const handleBreadcrumbSelect = useCallback((treeNodeId: string) => {
    selectTreeNode(treeNodeId);
  }, [selectTreeNode]);

  const [breadcrumbHoveredSchemaId, setBreadcrumbHoveredSchemaId] = useState<string | null>(null);
  const handleBreadcrumbHover = useCallback((treeNodeId: string | null) => {
    if (!treeNodeId) {
      setBreadcrumbHoveredSchemaId(null);
      return;
    }
    const node = getSchemaNodeByTreeId(activeSchema, treeNodeId);
    setBreadcrumbHoveredSchemaId(node?.id ?? null);
  }, [activeSchema]);

  const executeSchemaCommand = useCallback((commandId: string, payload: Record<string, unknown>) => {
    if (notifyCommandLocked()) {
      return;
    }

    if (appMode === 'shell') {
      void shellCommands.execute(commandId, payload).catch((error) => {
        onError?.(error instanceof Error ? error.message : String(error));
      });
      return;
    }

    void executeScenarioCommand(commandId, payload);
  }, [appMode, executeScenarioCommand, notifyCommandLocked, onError, shellCommands]);

  const insertComponentAtTarget = useCallback((componentType: string, target: CanvasDropTarget) => {
    const contract = getBuiltinContract(componentType);
    if (!contract || notifyCommandLocked()) {
      return;
    }

    const position = resolveCanvasDropPosition(activeSchema, target, getBuiltinContract);
    if (!position) {
      return;
    }

    const node = createSchemaNodeFromContract(contract);
    executeSchemaCommand('node.insertAt', {
      node,
      ...(position.parentTreeId ? { parentTreeId: position.parentTreeId } : {}),
      index: position.index,
    });

    if (node.id) {
      requestAnimationFrame(() => {
        selectSchemaNode(node.id!);
      });
    }
  }, [activeSchema, executeSchemaCommand, notifyCommandLocked, selectSchemaNode]);

  const handleInsertComponent = useCallback((componentType: string) => {
    const canAppendInside = selectedContract?.children
      && ['node', 'nodes', 'mixed'].includes(selectedContract.children.type);
    insertComponentAtTarget(componentType, selectedNodeId && canAppendInside && selectedNode?.id
      ? {
          placement: 'inside',
          targetNodeSchemaId: selectedNode.id,
        }
      : {
          placement: selectedNode?.id ? 'after' : 'root',
          ...(selectedNode?.id ? { targetNodeSchemaId: selectedNode.id } : {}),
        });
  }, [insertComponentAtTarget, selectedContract, selectedNode, selectedNodeId]);

  const handleDeleteSelectedNode = useCallback(() => {
    if (!selectedNodeId || notifyCommandLocked()) {
      return;
    }
    const nextSchema = removeSchemaNode(activeSchema, selectedNodeId);
    executeSchemaCommand('node.remove', { treeId: selectedNodeId });
    requestAnimationFrame(() => {
      const nextTree = buildEditorTree(nextSchema);
      selectTreeNode(getDefaultSelectedNodeId(nextTree) ?? '');
    });
  }, [activeSchema, executeSchemaCommand, notifyCommandLocked, selectTreeNode, selectedNodeId]);

  const handleDuplicateSelectedNode = useCallback(() => {
    if (!selectedNodeId || !selectedNode || notifyCommandLocked()) {
      return;
    }
    const position = getTreeArrayPosition(selectedNodeId);
    if (!position) {
      return;
    }
    const duplicatedNode = cloneSchemaNodeWithFreshIds(selectedNode);
    executeSchemaCommand('node.insertAt', {
      node: duplicatedNode,
      ...(position.targetParentTreeId ? { parentTreeId: position.targetParentTreeId } : {}),
      index: position.index + 1,
    });
    if (duplicatedNode.id) {
      requestAnimationFrame(() => {
        selectSchemaNode(duplicatedNode.id!);
      });
    }
  }, [executeSchemaCommand, notifyCommandLocked, selectSchemaNode, selectedNode, selectedNodeId]);

  const moveSelectedNode = useCallback((direction: -1 | 1) => {
    if (!selectedNodeId || notifyCommandLocked()) {
      return;
    }
    const position = getTreeArrayPosition(selectedNodeId);
    if (!position) {
      return;
    }
    const nextIndex = position.index + direction;
    if (nextIndex < 0) {
      return;
    }
    executeSchemaCommand('node.move', {
      sourceTreeId: selectedNodeId,
      ...(position.targetParentTreeId ? { targetParentTreeId: position.targetParentTreeId } : {}),
      index: nextIndex,
    });
  }, [executeSchemaCommand, notifyCommandLocked, selectedNodeId]);

  const handleCanvasInsertComponent = useCallback((componentType: string, target: CanvasDropTarget) => {
    insertComponentAtTarget(componentType, target);
  }, [insertComponentAtTarget]);

  const handleCanvasMoveSelectedNode = useCallback((target: CanvasDropTarget) => {
    if (!selectedNodeId || notifyCommandLocked()) {
      return;
    }
    if (target.targetNodeSchemaId) {
      const targetTreeId = getTreeIdBySchemaNodeId(activeSchema, target.targetNodeSchemaId);
      if (
        targetTreeId
        && (targetTreeId === selectedNodeId || targetTreeId.startsWith(`${selectedNodeId}.children.`))
      ) {
        return;
      }
    }

    const position = resolveCanvasDropPosition(activeSchema, target, getBuiltinContract);
    if (!position) {
      return;
    }

    executeSchemaCommand('node.move', {
      sourceTreeId: selectedNodeId,
      ...(position.parentTreeId ? { targetParentTreeId: position.parentTreeId } : {}),
      index: position.index,
    });
  }, [activeSchema, executeSchemaCommand, notifyCommandLocked, selectedNodeId]);

  const canCanvasDropInsideNode = useCallback((schemaNodeId: string | undefined) => {
    return canSchemaNodeAcceptCanvasChildren(activeSchema, schemaNodeId, getBuiltinContract);
  }, [activeSchema]);

  return {
    treeNodes,
    selectedNodeId,
    selectedNode,
    selectedContract,
    breadcrumbItems,
    breadcrumbHoveredSchemaId,
    canDeleteSelectedNode,
    canDuplicateSelectedNode,
    canMoveSelectedNodeUp,
    canMoveSelectedNodeDown,
    patchSelectedNode,
    selectTreeNode,
    handleCanvasSelectNode,
    handleCanvasDeselectNode,
    handleBreadcrumbSelect,
    handleBreadcrumbHover,
    handleInsertComponent,
    handleDeleteSelectedNode,
    handleDuplicateSelectedNode,
    moveSelectedNode,
    handleCanvasInsertComponent,
    handleCanvasMoveSelectedNode,
    canCanvasDropInsideNode,
  };
}
