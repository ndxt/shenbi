import type { PageSchema, PropValue, SchemaNode } from '@shenbi/schema';

export interface EditorTreeNode {
  id: string;
  type: string;
  name: string;
  children?: EditorTreeNode[];
  isHidden?: boolean;
}

function deepCloneSchema(schema: PageSchema): PageSchema {
  if (typeof structuredClone === 'function') {
    return structuredClone(schema);
  }
  return JSON.parse(JSON.stringify(schema)) as PageSchema;
}

function isSchemaNode(value: unknown): value is SchemaNode {
  return Boolean(value) && typeof value === 'object' && typeof (value as SchemaNode).component === 'string';
}

function getNodeLabel(node: SchemaNode): string {
  if (typeof node.id === 'string' && node.id.trim().length > 0) {
    return `${node.id} (${node.component})`;
  }
  return node.component;
}

function buildTreeNode(node: SchemaNode, path: string): EditorTreeNode {
  const children = Array.isArray(node.children)
    ? node.children
        .filter((child): child is SchemaNode => isSchemaNode(child))
        .map((child, index) => buildTreeNode(child, `${path}.children.${index}`))
    : [];

  const treeNode: EditorTreeNode = {
    id: path,
    type: node.component,
    name: getNodeLabel(node),
    isHidden: node.show === false,
  };
  if (children.length > 0) {
    treeNode.children = children;
  }
  return treeNode;
}

export function buildEditorTree(schema: PageSchema): EditorTreeNode[] {
  const treeNodes: EditorTreeNode[] = [];

  if (Array.isArray(schema.body)) {
    schema.body.forEach((node, index) => {
      if (isSchemaNode(node)) {
        treeNodes.push(buildTreeNode(node, `body.${index}`));
      }
    });
  } else if (isSchemaNode(schema.body)) {
    treeNodes.push(buildTreeNode(schema.body, 'body'));
  }

  if (Array.isArray(schema.dialogs)) {
    schema.dialogs.forEach((node, index) => {
      if (isSchemaNode(node)) {
        treeNodes.push(buildTreeNode(node, `dialogs.${index}`));
      }
    });
  }

  return treeNodes;
}

function getValueByPath(root: unknown, path: string): unknown {
  const tokens = path.split('.').filter(Boolean);
  let current: unknown = root;
  for (const token of tokens) {
    if (Array.isArray(current)) {
      const index = Number(token);
      if (!Number.isInteger(index)) {
        return undefined;
      }
      current = current[index];
      continue;
    }

    if (!current || typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[token];
  }
  return current;
}

export function getSchemaNodeByTreeId(schema: PageSchema, treeId?: string): SchemaNode | undefined {
  if (!treeId) {
    return undefined;
  }
  const node = getValueByPath(schema, treeId);
  return isSchemaNode(node) ? node : undefined;
}

export function patchSchemaNodeProps(
  schema: PageSchema,
  treeId: string | undefined,
  patch: Record<string, unknown>,
): PageSchema {
  if (!treeId || Object.keys(patch).length === 0) {
    return schema;
  }

  const nextSchema = deepCloneSchema(schema);
  const node = getSchemaNodeByTreeId(nextSchema, treeId);
  if (!node) {
    return schema;
  }

  const currentProps: Record<string, PropValue> =
    node.props && typeof node.props === 'object' && !Array.isArray(node.props)
      ? (node.props as Record<string, PropValue>)
      : {};

  node.props = {
    ...currentProps,
    ...(patch as Record<string, PropValue>),
  };

  return nextSchema;
}

export function getDefaultSelectedNodeId(treeNodes: EditorTreeNode[]): string | undefined {
  return treeNodes[0]?.id;
}
