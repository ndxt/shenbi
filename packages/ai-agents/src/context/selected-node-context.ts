import type { PageSchema, SchemaNode } from '@shenbi/schema';
import { serializeSchemaSubtree, summarizeSchemaNode } from './schema-tree';

interface IndexedNodeContext {
  node: SchemaNode;
  path: string;
  ancestors: SchemaNode[];
  siblings: SchemaNode[];
  siblingIndex: number;
}

export interface ResolvedSelectedNodeContext {
  originalSelection: string;
  selectionType: 'editor-path' | 'schema-id';
  path: string;
  node: SchemaNode;
  resolvedNodeId?: string;
  ancestors: SchemaNode[];
  previousSibling?: SchemaNode;
  nextSibling?: SchemaNode;
}

function isSchemaNode(value: unknown): value is SchemaNode {
  return Boolean(value) && typeof value === 'object' && typeof (value as SchemaNode).component === 'string';
}

function isEditorPath(selectedNodeId: string): boolean {
  return /^(body|dialogs)(\.|$)/.test(selectedNodeId);
}

function pushNodeContexts(
  value: SchemaNode | SchemaNode[] | undefined,
  pathBase: string,
  ancestors: SchemaNode[],
  contexts: IndexedNodeContext[],
): void {
  if (!value) {
    return;
  }
  const nodes = Array.isArray(value) ? value.filter(isSchemaNode) : isSchemaNode(value) ? [value] : [];
  for (const [index, node] of nodes.entries()) {
    const path = Array.isArray(value) ? `${pathBase}.${index}` : pathBase;
    contexts.push({
      node,
      path,
      ancestors,
      siblings: nodes,
      siblingIndex: index,
    });
    const nextAncestors = [...ancestors, node];
    if (Array.isArray(node.children)) {
      pushNodeContexts(node.children.filter(isSchemaNode), `${path}.children`, nextAncestors, contexts);
    }
    for (const [slotName, slotValue] of Object.entries(node.slots ?? {})) {
      if (Array.isArray(slotValue)) {
        pushNodeContexts(slotValue.filter(isSchemaNode), `${path}.slots.${slotName}`, nextAncestors, contexts);
      } else if (isSchemaNode(slotValue)) {
        pushNodeContexts(slotValue, `${path}.slots.${slotName}`, nextAncestors, contexts);
      }
    }
  }
}

function indexSchemaNodes(schema: PageSchema): IndexedNodeContext[] {
  const contexts: IndexedNodeContext[] = [];
  pushNodeContexts(schema.body, 'body', [], contexts);
  if (schema.dialogs) {
    pushNodeContexts(schema.dialogs, 'dialogs', [], contexts);
  }
  return contexts;
}

function getResolvedNodeId(node: SchemaNode): string | undefined {
  return typeof node.id === 'string' && node.id.trim() ? node.id.trim() : undefined;
}

export function resolveSelectedNodeContext(
  schema: PageSchema | undefined,
  selectedNodeId: string | undefined,
): ResolvedSelectedNodeContext | undefined {
  if (!schema || !selectedNodeId) {
    return undefined;
  }
  const contexts = indexSchemaNodes(schema);
  const matched = isEditorPath(selectedNodeId)
    ? contexts.find((context) => context.path === selectedNodeId)
    : contexts.find((context) => getResolvedNodeId(context.node) === selectedNodeId);
  if (!matched) {
    return undefined;
  }
  const resolvedNodeId = getResolvedNodeId(matched.node);
  const previousSibling = matched.siblingIndex > 0 ? matched.siblings[matched.siblingIndex - 1] : undefined;
  const nextSibling = matched.siblingIndex < matched.siblings.length - 1 ? matched.siblings[matched.siblingIndex + 1] : undefined;
  return {
    originalSelection: selectedNodeId,
    selectionType: isEditorPath(selectedNodeId) ? 'editor-path' : 'schema-id',
    path: matched.path,
    node: matched.node,
    ancestors: matched.ancestors,
    ...(resolvedNodeId ? { resolvedNodeId } : {}),
    ...(previousSibling ? { previousSibling } : {}),
    ...(nextSibling ? { nextSibling } : {}),
  };
}

export function buildFocusedNodeContext(
  schema: PageSchema | undefined,
  selectedNodeId: string | undefined,
): string | undefined {
  if (!schema || !selectedNodeId) {
    return undefined;
  }
  const resolved = resolveSelectedNodeContext(schema, selectedNodeId);
  if (!resolved) {
    return buildSelectedNodeHint(selectedNodeId);
  }

  const lines = [
    resolved.selectionType === 'editor-path'
      ? `Focused selection path: "${resolved.originalSelection}".`
      : `Focused schema nodeId: "${resolved.originalSelection}".`,
    `Resolved focused node: ${summarizeSchemaNode(resolved.node)}`,
    resolved.resolvedNodeId
      ? `Use resolved schema nodeId "${resolved.resolvedNodeId}" in nodeId / parentId fields.`
      : 'The focused node has no explicit schema nodeId; inspect the local subtree before issuing operations.',
    `Resolved schema path: ${resolved.path}`,
  ];

  const parentChain = resolved.ancestors.slice(-2).reverse();
  if (parentChain.length > 0) {
    lines.push('Parent chain:');
    for (const ancestor of parentChain) {
      lines.push(`- ${summarizeSchemaNode(ancestor)}`);
    }
  }

  if (resolved.previousSibling || resolved.nextSibling) {
    lines.push('Adjacent siblings:');
    if (resolved.previousSibling) {
      lines.push(`- Previous: ${summarizeSchemaNode(resolved.previousSibling)}`);
    }
    if (resolved.nextSibling) {
      lines.push(`- Next: ${summarizeSchemaNode(resolved.nextSibling)}`);
    }
  }

  lines.push('Local subtree:');
  lines.push(serializeSchemaSubtree(resolved.node, { maxDepth: 2, maxNodes: 20 }));
  return lines.join('\n');
}

export function buildSelectedNodeHint(selectedNodeId: string | undefined): string | undefined {
  if (!selectedNodeId) {
    return undefined;
  }
  if (isEditorPath(selectedNodeId)) {
    return [
      `User is currently focused on the node at path "${selectedNodeId}".`,
      `IMPORTANT: This is an editor path, NOT a node id. Resolve the schema node at this path and use its schema nodeId in operations.`,
      `Do NOT use the path string "${selectedNodeId}" as a nodeId directly.`,
    ].join('\n');
  }
  return `User is currently focused on node "${selectedNodeId}". Use this id directly in nodeId / parentId fields.`;
}
