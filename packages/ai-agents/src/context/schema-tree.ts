import type { PageSchema, SchemaNode } from '@shenbi/schema';

export interface SerializeOptions {
  maxDepth?: number;
  maxNodes?: number;
}

interface SerializeState {
  readonly maxDepth: number;
  readonly maxNodes: number;
  visitedNodes: number;
}

function isSchemaNode(value: unknown): value is SchemaNode {
  return Boolean(value) && typeof value === 'object' && typeof (value as SchemaNode).component === 'string';
}

function getIndent(depth: number): string {
  return '  '.repeat(depth);
}

function quoteString(value: string): string {
  return `"${value.replace(/\s+/g, ' ').trim()}"`;
}

function formatPrimitive(value: unknown): string {
  if (typeof value === 'string') {
    return quoteString(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const compact = value
      .map((item) => (typeof item === 'string' ? quoteString(item) : formatPrimitive(item)))
      .join(', ');
    return `[${compact}]`;
  }
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[object]';
    }
  }
  return String(value);
}

function collectText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return value.map((item) => collectText(item)).filter(Boolean).join(' ').trim();
  }
  if (isSchemaNode(value)) {
    return collectText(value.children);
  }
  return '';
}

function getDirectChildNodes(node: SchemaNode): SchemaNode[] {
  const directChildren = Array.isArray(node.children) ? node.children.filter(isSchemaNode) : [];
  const slotChildren = Object.values(node.slots ?? {}).flatMap((value) => {
    if (Array.isArray(value)) {
      return value.filter(isSchemaNode);
    }
    return isSchemaNode(value) ? [value] : [];
  });
  return [...directChildren, ...slotChildren];
}

function getColumnTitles(node: SchemaNode): string[] {
  const rawColumns = Array.isArray(node.columns)
    ? node.columns
    : Array.isArray(node.props?.columns)
      ? node.props.columns
      : [];
  return rawColumns
    .map((column) => {
      if (!column || typeof column !== 'object') {
        return '';
      }
      const title = (column as { title?: unknown }).title;
      if (typeof title === 'string' || typeof title === 'number') {
        return String(title).trim();
      }
      return '';
    })
    .filter(Boolean);
}

function getKeyProps(node: SchemaNode): Array<[string, string]> {
  const props = node.props ?? {};
  switch (node.component) {
    case 'Card':
    case 'Modal':
    case 'Drawer':
      return typeof props.title === 'string' ? [['title', quoteString(props.title)]] : [];
    case 'Table': {
      const entries: Array<[string, string]> = [];
      const titles = getColumnTitles(node);
      if (titles.length > 0) {
        entries.push(['columns', formatPrimitive(titles)]);
      }
      if (props.dataSource !== undefined) {
        entries.push(['dataSource', formatPrimitive(props.dataSource)]);
      }
      return entries;
    }
    case 'Form.Item': {
      const entries: Array<[string, string]> = [];
      if (props.label !== undefined) {
        entries.push(['label', formatPrimitive(props.label)]);
      }
      if (props.name !== undefined) {
        entries.push(['name', formatPrimitive(props.name)]);
      }
      return entries;
    }
    case 'Button': {
      const entries: Array<[string, string]> = [];
      if (props.type !== undefined) {
        entries.push(['type', formatPrimitive(props.type)]);
      }
      const text = collectText(node.children);
      if (text) {
        entries.push(['text', quoteString(text)]);
      }
      return entries;
    }
    case 'Statistic': {
      const entries: Array<[string, string]> = [];
      if (props.title !== undefined) {
        entries.push(['title', formatPrimitive(props.title)]);
      }
      if (props.value !== undefined) {
        entries.push(['value', formatPrimitive(props.value)]);
      }
      return entries;
    }
    case 'Col':
      return props.span !== undefined ? [['span', formatPrimitive(props.span)]] : [];
    default: {
      const entries: Array<[string, string]> = [];
      if (props.title !== undefined) {
        entries.push(['title', formatPrimitive(props.title)]);
      }
      if (props.label !== undefined) {
        entries.push(['label', formatPrimitive(props.label)]);
      }
      return entries;
    }
  }
}

function formatNodeLabel(node: SchemaNode): string {
  const idSuffix = typeof node.id === 'string' && node.id.trim() !== '' ? `#${node.id}` : '';
  const keyProps = getKeyProps(node);
  if (keyProps.length === 0) {
    return `${node.component}${idSuffix}`;
  }
  return `${node.component}${idSuffix}(${keyProps.map(([key, value]) => `${key}=${value}`).join(', ')})`;
}

function appendFoldLine(lines: string[], depth: number, childCount: number): void {
  lines.push(`${getIndent(depth + 1)}-> ${childCount} children`);
}

function serializeNode(node: SchemaNode, depth: number, lines: string[], state: SerializeState): void {
  if (state.visitedNodes >= state.maxNodes) {
    return;
  }

  const directChildren = getDirectChildNodes(node);
  const label = formatNodeLabel(node);
  const canInlineSingleChild = node.component === 'Form.Item' && directChildren.length === 1 && depth < state.maxDepth;

  if (canInlineSingleChild) {
    lines.push(`${getIndent(depth)}${label} -> ${formatNodeLabel(directChildren[0]!)}`);
    state.visitedNodes += 2;
    return;
  }

  lines.push(`${getIndent(depth)}${label}`);
  state.visitedNodes += 1;

  if (directChildren.length === 0) {
    return;
  }
  if (depth > state.maxDepth || state.visitedNodes >= state.maxNodes) {
    appendFoldLine(lines, depth, directChildren.length);
    return;
  }

  for (const [index, child] of directChildren.entries()) {
    if (state.visitedNodes >= state.maxNodes) {
      appendFoldLine(lines, depth, directChildren.length - index);
      break;
    }
    serializeNode(child, depth + 1, lines, state);
  }
}

function appendSection(
  lines: string[],
  title: string,
  value: SchemaNode | SchemaNode[] | undefined,
  state: SerializeState,
): void {
  if (!value) {
    return;
  }
  lines.push(title);
  const nodes = Array.isArray(value) ? value.filter(isSchemaNode) : isSchemaNode(value) ? [value] : [];
  for (const node of nodes) {
    if (state.visitedNodes >= state.maxNodes) {
      lines.push('  -> more nodes omitted');
      break;
    }
    serializeNode(node, 1, lines, state);
  }
}

function inferStateType(field: unknown): string {
  if (!field || typeof field !== 'object') {
    return 'unknown';
  }
  const stateField = field as { type?: unknown; default?: unknown };
  if (typeof stateField.type === 'string' && stateField.type.trim() !== '') {
    return stateField.type;
  }
  const defaultValue = stateField.default;
  if (Array.isArray(defaultValue)) {
    return 'array';
  }
  if (defaultValue === null) {
    return 'null';
  }
  if (defaultValue !== undefined) {
    return typeof defaultValue;
  }
  return 'unknown';
}

function appendStateSection(lines: string[], schema: PageSchema): void {
  const stateEntries = Object.entries(schema.state ?? {});
  if (stateEntries.length === 0) {
    return;
  }
  lines.push('[state]');
  for (const [key, value] of stateEntries) {
    lines.push(`  ${key}: ${inferStateType(value)}`);
  }
}

export function serializeSchemaTree(schema: PageSchema, options: SerializeOptions = {}): string {
  const lines: string[] = [];
  const state: SerializeState = {
    maxDepth: options.maxDepth ?? 8,
    maxNodes: options.maxNodes ?? 200,
    visitedNodes: 0,
  };

  appendSection(lines, '[body]', schema.body, state);
  if (Array.isArray(schema.dialogs) && schema.dialogs.length > 0) {
    appendSection(lines, '[dialogs]', schema.dialogs, state);
  }
  appendStateSection(lines, schema);

  return lines.join('\n');
}
