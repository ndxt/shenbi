import { useCallback } from 'react';

export type NodePatchDispatchMode = 'shell' | 'scenarios';

type SchemaPatchPayload = Record<string, unknown>;
type ColumnsPatchPayload = unknown[];

type SchemaPatchFn<TSchema, TPayload> = (
  schema: TSchema,
  selectedNodeId: string | undefined,
  payload: TPayload,
) => TSchema;

export interface UseNodePatchDispatchOptions<TSchema> {
  mode: NodePatchDispatchMode;
  selectedNodeId: string | undefined;
  executeShellCommand: (commandId: string, args: Record<string, unknown>) => void;
  updateScenarioSchema: (updater: (schema: TSchema) => TSchema) => void;
  patchSchemaNodeProps: SchemaPatchFn<TSchema, SchemaPatchPayload>;
  patchSchemaNodeEvents: SchemaPatchFn<TSchema, SchemaPatchPayload>;
  patchSchemaNodeStyle: SchemaPatchFn<TSchema, SchemaPatchPayload>;
  patchSchemaNodeLogic: SchemaPatchFn<TSchema, SchemaPatchPayload>;
  patchSchemaNodeColumns: SchemaPatchFn<TSchema, ColumnsPatchPayload>;
}

export interface UseNodePatchDispatchResult {
  handlePatchProps: (patch: SchemaPatchPayload) => void;
  handlePatchEvents: (patch: SchemaPatchPayload) => void;
  handlePatchStyle: (patch: SchemaPatchPayload) => void;
  handlePatchLogic: (patch: SchemaPatchPayload) => void;
  handlePatchColumns: (columns: ColumnsPatchPayload) => void;
}

export function useNodePatchDispatch<TSchema>(
  options: UseNodePatchDispatchOptions<TSchema>,
): UseNodePatchDispatchResult {
  const {
    mode,
    selectedNodeId,
    executeShellCommand,
    updateScenarioSchema,
    patchSchemaNodeProps,
    patchSchemaNodeEvents,
    patchSchemaNodeStyle,
    patchSchemaNodeLogic,
    patchSchemaNodeColumns,
  } = options;

  const handlePatchProps = useCallback((patch: SchemaPatchPayload) => {
    if (mode === 'shell') {
      if (!selectedNodeId) {
        return;
      }
      executeShellCommand('node.patchProps', { treeId: selectedNodeId, patch });
      return;
    }
    updateScenarioSchema((schema) => patchSchemaNodeProps(schema, selectedNodeId, patch));
  }, [executeShellCommand, mode, patchSchemaNodeProps, selectedNodeId, updateScenarioSchema]);

  const handlePatchEvents = useCallback((patch: SchemaPatchPayload) => {
    if (mode === 'shell') {
      if (!selectedNodeId) {
        return;
      }
      executeShellCommand('node.patchEvents', { treeId: selectedNodeId, patch });
      return;
    }
    updateScenarioSchema((schema) => patchSchemaNodeEvents(schema, selectedNodeId, patch));
  }, [executeShellCommand, mode, patchSchemaNodeEvents, selectedNodeId, updateScenarioSchema]);

  const handlePatchStyle = useCallback((patch: SchemaPatchPayload) => {
    if (mode === 'shell') {
      if (!selectedNodeId) {
        return;
      }
      executeShellCommand('node.patchStyle', { treeId: selectedNodeId, patch });
      return;
    }
    updateScenarioSchema((schema) => patchSchemaNodeStyle(schema, selectedNodeId, patch));
  }, [executeShellCommand, mode, patchSchemaNodeStyle, selectedNodeId, updateScenarioSchema]);

  const handlePatchLogic = useCallback((patch: SchemaPatchPayload) => {
    if (mode === 'shell') {
      if (!selectedNodeId) {
        return;
      }
      executeShellCommand('node.patchLogic', { treeId: selectedNodeId, patch });
      return;
    }
    updateScenarioSchema((schema) => patchSchemaNodeLogic(schema, selectedNodeId, patch));
  }, [executeShellCommand, mode, patchSchemaNodeLogic, selectedNodeId, updateScenarioSchema]);

  const handlePatchColumns = useCallback((columns: ColumnsPatchPayload) => {
    if (mode === 'shell') {
      if (!selectedNodeId) {
        return;
      }
      executeShellCommand('node.patchColumns', { treeId: selectedNodeId, columns });
      return;
    }
    updateScenarioSchema((schema) => patchSchemaNodeColumns(schema, selectedNodeId, columns));
  }, [executeShellCommand, mode, patchSchemaNodeColumns, selectedNodeId, updateScenarioSchema]);

  return {
    handlePatchProps,
    handlePatchEvents,
    handlePatchStyle,
    handlePatchLogic,
    handlePatchColumns,
  };
}
