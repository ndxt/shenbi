import {
  getSchemaNodeByTreeId,
  getTreeIdBySchemaNodeId,
} from './schema-editor';
import type { PageSchema, SchemaNode } from '@shenbi/schema';

export interface SchemaTreeArrayPosition {
  targetParentTreeId?: string;
  index: number;
}

export interface SchemaNodeDropTarget {
  placement: 'before' | 'after' | 'inside' | 'root';
  targetNodeSchemaId?: string;
}

export interface SchemaComponentContractLike {
  children?: {
    type: string;
  } | undefined;
}

export type SchemaComponentContractResolver = (
  componentType: string,
) => SchemaComponentContractLike | undefined;

export function cloneSchema(schema: PageSchema): PageSchema {
  if (typeof structuredClone === 'function') {
    return structuredClone(schema);
  }
  return JSON.parse(JSON.stringify(schema)) as PageSchema;
}

export function hasSchemaContent(schema: PageSchema): boolean {
  const bodyCount = Array.isArray(schema.body) ? schema.body.length : (schema.body ? 1 : 0);
  const dialogCount = Array.isArray(schema.dialogs) ? schema.dialogs.length : (schema.dialogs ? 1 : 0);
  return bodyCount + dialogCount > 0;
}

export function getTreeArrayPosition(treeId: string | undefined): SchemaTreeArrayPosition | undefined {
  if (!treeId) {
    return undefined;
  }
  if (treeId === 'body') {
    return { index: 0 };
  }

  const tokens = treeId.split('.').filter(Boolean);
  const lastToken = tokens[tokens.length - 1];
  const index = Number(lastToken);
  if (!Number.isInteger(index)) {
    return undefined;
  }

  const parentTokens = tokens.slice(0, -1);
  if (parentTokens.length === 1 && parentTokens[0] === 'body') {
    return { index };
  }
  if (parentTokens.length === 1 && parentTokens[0] === 'dialogs') {
    return { targetParentTreeId: 'dialogs', index };
  }
  if (parentTokens[parentTokens.length - 1] === 'children') {
    const targetParentTreeId = parentTokens.slice(0, -1).join('.');
    return {
      ...(targetParentTreeId ? { targetParentTreeId } : {}),
      index,
    };
  }

  return undefined;
}

export function canDropInsideComponent(
  componentType: string | undefined,
  resolveContract: SchemaComponentContractResolver,
): boolean {
  if (!componentType) {
    return false;
  }
  const contract = resolveContract(componentType);
  return Boolean(contract?.children && ['node', 'nodes', 'mixed'].includes(contract.children.type));
}

export function canSchemaNodeAcceptCanvasChildren(
  schema: PageSchema,
  schemaNodeId: string | undefined,
  resolveContract: SchemaComponentContractResolver,
): boolean {
  if (!schemaNodeId) {
    return false;
  }
  const targetTreeId = getTreeIdBySchemaNodeId(schema, schemaNodeId);
  if (!targetTreeId) {
    return false;
  }
  const targetNode = getSchemaNodeByTreeId(schema, targetTreeId);
  if (!targetNode) {
    return false;
  }
  return canDropInsideComponent(targetNode.component, resolveContract);
}

export function createClonedNodeId(componentType: string): string {
  const normalized = componentType
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'node';
  const randomSuffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${normalized}-${randomSuffix}`;
}

export function cloneSchemaNodeWithFreshIds(node: SchemaNode): SchemaNode {
  const cloned = typeof structuredClone === 'function'
    ? structuredClone(node)
    : JSON.parse(JSON.stringify(node)) as SchemaNode;

  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map((item) => walk(item));
    }
    if (!value || typeof value !== 'object') {
      return value;
    }
    const record = value as Record<string, unknown>;
    const nextRecord = Object.fromEntries(
      Object.entries(record).map(([key, nested]) => [key, walk(nested)]),
    );
    if (typeof nextRecord.component === 'string') {
      nextRecord.id = createClonedNodeId(nextRecord.component);
    }
    return nextRecord;
  };

  return walk(cloned) as SchemaNode;
}

export function getContainerNodeCount(schema: PageSchema, parentTreeId?: string): number {
  if (!parentTreeId) {
    return Array.isArray(schema.body) ? schema.body.length : (schema.body ? 1 : 0);
  }
  if (parentTreeId === 'dialogs') {
    return Array.isArray(schema.dialogs) ? schema.dialogs.length : (schema.dialogs ? 1 : 0);
  }
  const parentNode = getSchemaNodeByTreeId(schema, parentTreeId);
  return Array.isArray(parentNode?.children) ? parentNode.children.length : 0;
}

export function resolveCanvasDropPosition(
  schema: PageSchema,
  target: SchemaNodeDropTarget,
  resolveContract: SchemaComponentContractResolver,
): {
  parentTreeId?: string;
  index: number;
} | undefined {
  if (target.placement === 'root' || !target.targetNodeSchemaId) {
    const bodyLength = Array.isArray(schema.body) ? schema.body.length : (schema.body ? 1 : 0);
    return { index: bodyLength };
  }

  const targetTreeId = getTreeIdBySchemaNodeId(schema, target.targetNodeSchemaId);
  if (!targetTreeId) {
    return undefined;
  }

  const targetNode = getSchemaNodeByTreeId(schema, targetTreeId);
  if (!targetNode) {
    return undefined;
  }

  if (target.placement === 'inside') {
    if (!canDropInsideComponent(targetNode.component, resolveContract)) {
      return undefined;
    }
    const childCount = Array.isArray(targetNode.children) ? targetNode.children.length : 0;
    return {
      parentTreeId: targetTreeId,
      index: childCount,
    };
  }

  const targetPosition = getTreeArrayPosition(targetTreeId);
  if (!targetPosition) {
    return undefined;
  }

  return {
    ...(targetPosition.targetParentTreeId ? { parentTreeId: targetPosition.targetParentTreeId } : {}),
    index: target.placement === 'before' ? targetPosition.index : targetPosition.index + 1,
  };
}
