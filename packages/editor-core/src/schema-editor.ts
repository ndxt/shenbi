import type { ActionChain, PageSchema, PropValue, SchemaNode } from '@shenbi/schema';

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

function findTreePathBySchemaId(node: SchemaNode, path: string, schemaNodeId: string): string | undefined {
  if (node.id === schemaNodeId) {
    return path;
  }
  if (!Array.isArray(node.children)) {
    return undefined;
  }
  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index];
    if (!isSchemaNode(child)) {
      continue;
    }
    const matched = findTreePathBySchemaId(child, `${path}.children.${index}`, schemaNodeId);
    if (matched) {
      return matched;
    }
  }
  return undefined;
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

function getRootContainer(
  schema: PageSchema,
  container: 'body' | 'dialogs',
): SchemaNode[] | undefined {
  if (container === 'body') {
    if (Array.isArray(schema.body)) {
      return schema.body;
    }
    schema.body = isSchemaNode(schema.body) ? [schema.body] : [];
    return schema.body;
  }

  if (!Array.isArray(schema.dialogs)) {
    schema.dialogs = [];
  }
  return schema.dialogs;
}

function getNodeChildrenContainer(node: SchemaNode, createIfMissing = false): SchemaNode[] | undefined {
  if (Array.isArray(node.children)) {
    return node.children as SchemaNode[];
  }
  if (node.children === undefined && createIfMissing) {
    node.children = [];
    return node.children as SchemaNode[];
  }
  return undefined;
}

function clampIndex(index: number, length: number): number {
  if (index < 0) {
    return 0;
  }
  if (index > length) {
    return length;
  }
  return index;
}

export function getSchemaNodeByTreeId(schema: PageSchema, treeId?: string): SchemaNode | undefined {
  if (!treeId) {
    return undefined;
  }
  const node = getValueByPath(schema, treeId);
  return isSchemaNode(node) ? node : undefined;
}

export function appendSchemaNode(
  schema: PageSchema,
  node: SchemaNode,
  parentTreeId?: string,
): PageSchema {
  const nextSchema = deepCloneSchema(schema);

  if (!parentTreeId) {
    const body = getRootContainer(nextSchema, 'body');
    body?.push(node);
    return nextSchema;
  }

  if (parentTreeId === 'dialogs') {
    const dialogs = getRootContainer(nextSchema, 'dialogs');
    dialogs?.push(node);
    return nextSchema;
  }

  const parentNode = getSchemaNodeByTreeId(nextSchema, parentTreeId);
  if (!parentNode) {
    return schema;
  }

  const children = getNodeChildrenContainer(parentNode, true);
  if (!children) {
    return schema;
  }
  children.push(node);
  return nextSchema;
}

export function insertSchemaNodeAt(
  schema: PageSchema,
  node: SchemaNode,
  index: number,
  parentTreeId?: string,
): PageSchema {
  const nextSchema = deepCloneSchema(schema);

  if (!parentTreeId) {
    const body = getRootContainer(nextSchema, 'body');
    if (!body) {
      return schema;
    }
    body.splice(clampIndex(index, body.length), 0, node);
    return nextSchema;
  }

  if (parentTreeId === 'dialogs') {
    const dialogs = getRootContainer(nextSchema, 'dialogs');
    if (!dialogs) {
      return schema;
    }
    dialogs.splice(clampIndex(index, dialogs.length), 0, node);
    return nextSchema;
  }

  const parentNode = getSchemaNodeByTreeId(nextSchema, parentTreeId);
  if (!parentNode) {
    return schema;
  }

  const children = getNodeChildrenContainer(parentNode, true);
  if (!children) {
    return schema;
  }
  children.splice(clampIndex(index, children.length), 0, node);
  return nextSchema;
}

export function removeSchemaNode(schema: PageSchema, treeId: string | undefined): PageSchema {
  if (!treeId) {
    return schema;
  }

  const nextSchema = deepCloneSchema(schema);

  if (treeId === 'body' && isSchemaNode(nextSchema.body)) {
    nextSchema.body = [];
    return nextSchema;
  }

  const tokens = treeId.split('.').filter(Boolean);
  const lastToken = tokens[tokens.length - 1];
  const parentPath = tokens.slice(0, -1).join('.');
  const index = Number(lastToken);
  if (!Number.isInteger(index)) {
    return schema;
  }

  const parentValue = getValueByPath(nextSchema, parentPath);
  if (!Array.isArray(parentValue) || index < 0 || index >= parentValue.length) {
    return schema;
  }

  parentValue.splice(index, 1);
  return nextSchema;
}

export function getTreeIdBySchemaNodeId(
  schema: PageSchema,
  schemaNodeId: string | undefined,
): string | undefined {
  if (!schemaNodeId) {
    return undefined;
  }

  if (Array.isArray(schema.body)) {
    for (let index = 0; index < schema.body.length; index += 1) {
      const node = schema.body[index];
      if (!isSchemaNode(node)) {
        continue;
      }
      const matched = findTreePathBySchemaId(node, `body.${index}`, schemaNodeId);
      if (matched) {
        return matched;
      }
    }
  } else if (isSchemaNode(schema.body)) {
    const matched = findTreePathBySchemaId(schema.body, 'body', schemaNodeId);
    if (matched) {
      return matched;
    }
  }

  if (Array.isArray(schema.dialogs)) {
    for (let index = 0; index < schema.dialogs.length; index += 1) {
      const node = schema.dialogs[index];
      if (!isSchemaNode(node)) {
        continue;
      }
      const matched = findTreePathBySchemaId(node, `dialogs.${index}`, schemaNodeId);
      if (matched) {
        return matched;
      }
    }
  }

  return undefined;
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

export function patchSchemaNodeEvents(
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

  const currentEvents: Record<string, ActionChain> =
    node.events && typeof node.events === 'object' && !Array.isArray(node.events)
      ? (node.events as Record<string, ActionChain>)
      : {};

  const nextEvents: Record<string, ActionChain> = {
    ...currentEvents,
    ...(patch as Record<string, ActionChain>),
  };
  node.events = nextEvents;

  return nextSchema;
}

export function patchSchemaNodeStyle(
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

  if (Object.prototype.hasOwnProperty.call(patch, 'style')) {
    const nextStyle = patch.style;
    if (nextStyle == null) {
      delete node.style;
    } else {
      node.style = nextStyle as SchemaNode['style'];
    }
  }

  return nextSchema;
}

export function patchSchemaNodeLogic(
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

  const keys: Array<'if' | 'show' | 'loop'> = ['if', 'show', 'loop'];
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) {
      continue;
    }
    const value = patch[key];
    if (value == null) {
      delete node[key];
      continue;
    }
    (node as Record<string, unknown>)[key] = value;
  }

  return nextSchema;
}

export function patchSchemaNodeColumns(
  schema: PageSchema,
  treeId: string | undefined,
  columns: unknown,
): PageSchema {
  if (!treeId) {
    return schema;
  }

  const nextSchema = deepCloneSchema(schema);
  const node = getSchemaNodeByTreeId(nextSchema, treeId);
  if (!node) {
    return schema;
  }

  if (columns == null) {
    delete node.columns;
    return nextSchema;
  }

  if (!Array.isArray(columns)) {
    return schema;
  }

  node.columns = columns as NonNullable<SchemaNode['columns']>;
  return nextSchema;
}

export function getDefaultSelectedNodeId(treeNodes: EditorTreeNode[]): string | undefined {
  return treeNodes[0]?.id;
}
