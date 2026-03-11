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

/**
 * 对 AI 生成的 insertNode.node 做容错规范化：
 * 1. AI 有时将组件类型写成 `type` 而非 `component`，自动修正。
 * 2. AI 有时将文本内容放在 `props.children` 而非顶层 `children`，自动提升。
 */
function normalizeInsertNode(node: unknown): unknown {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return node;
  }
  const raw = node as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...raw };

  // 修正 1：type -> component
  if (typeof normalized.component !== 'string' && typeof normalized.type === 'string') {
    normalized.component = normalized.type;
    delete normalized.type;
  }

  // 修正 2：props.children -> 顶层 children
  // 触发条件：顶层 children 缺失（undefined）或为空数组（AI 常生成 "children": []）
  const topChildren = normalized.children;
  const topChildrenIsEmpty = topChildren === undefined || (Array.isArray(topChildren) && topChildren.length === 0);
  if (
    topChildrenIsEmpty &&
    normalized.props !== null &&
    typeof normalized.props === 'object' &&
    !Array.isArray(normalized.props)
  ) {
    const props = normalized.props as Record<string, unknown>;
    if ('children' in props) {
      normalized.children = props.children;
      const { children: _omit, ...restProps } = props;
      void _omit;
      normalized.props = restProps;
    }
  }

  // 递归处理子节点
  if (Array.isArray(normalized.children)) {
    normalized.children = normalized.children.map(normalizeInsertNode);
  }

  return normalized;
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
      case 'schema.insertNode': {
        const node = normalizeInsertNode(operation.node);
        return typeof operation.index === 'number'
          ? bridge.execute('node.insertAt', {
              parentTreeId: resolveInsertParentTreeId(bridge, operation),
              index: operation.index,
              node,
            })
          : bridge.execute('node.append', {
              parentTreeId: resolveInsertParentTreeId(bridge, operation),
              node,
            });
      }
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
