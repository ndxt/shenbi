import { getTreeIdBySchemaNodeId } from '@shenbi/editor-core';
import type { AgentOperation } from './api-types';
import type { EditorAIBridge, ExecuteResult } from './editor-ai-bridge';

function resolveTreeId(bridge: EditorAIBridge, nodeId: string, operation: AgentOperation['op']): string {
  const treeId = getTreeIdBySchemaNodeId(bridge.getSchema(), nodeId);
  if (!treeId) {
    throw new Error(`${operation} could not resolve schema node "${nodeId}"`);
  }
  return treeId;
}

function resolveInsertParentTreeId(
  bridge: EditorAIBridge,
  operation: Extract<AgentOperation, { op: 'schema.insertNode' }>,
): string | undefined {
  if (operation.parentId) {
    return resolveTreeId(bridge, operation.parentId, operation.op);
  }
  if (operation.container === 'dialogs') {
    return 'dialogs';
  }
  return undefined;
}

export async function executeAgentOperation(
  bridge: EditorAIBridge,
  operation: AgentOperation,
): Promise<ExecuteResult> {
  try {
    switch (operation.op) {
      case 'schema.patchProps':
        return bridge.execute('node.patchProps', {
          treeId: resolveTreeId(bridge, operation.nodeId, operation.op),
          patch: operation.patch,
        });
      case 'schema.patchStyle':
        return bridge.execute('node.patchStyle', {
          treeId: resolveTreeId(bridge, operation.nodeId, operation.op),
          patch: operation.patch,
        });
      case 'schema.patchEvents':
        return bridge.execute('node.patchEvents', {
          treeId: resolveTreeId(bridge, operation.nodeId, operation.op),
          patch: operation.patch,
        });
      case 'schema.patchLogic':
        return bridge.execute('node.patchLogic', {
          treeId: resolveTreeId(bridge, operation.nodeId, operation.op),
          patch: operation.patch,
        });
      case 'schema.patchColumns':
        return bridge.execute('node.patchColumns', {
          treeId: resolveTreeId(bridge, operation.nodeId, operation.op),
          columns: operation.columns,
        });
      case 'schema.insertNode':
        return typeof operation.index === 'number'
          ? bridge.execute('node.insertAt', {
              parentTreeId: resolveInsertParentTreeId(bridge, operation),
              index: operation.index,
              node: operation.node,
            })
          : bridge.execute('node.append', {
              parentTreeId: resolveInsertParentTreeId(bridge, operation),
              node: operation.node,
            });
      case 'schema.removeNode':
        return bridge.execute('node.remove', {
          treeId: resolveTreeId(bridge, operation.nodeId, operation.op),
        });
      case 'schema.replace':
        return bridge.execute('schema.replace', {
          schema: operation.schema,
        });
      default:
        return {
          success: false,
          error: `Unsupported operation: ${(operation as { op: string }).op}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
