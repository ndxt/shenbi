import type { ColumnSchema, SchemaNode } from '@shenbi/schema';
import { supportedComponents, supportedComponentList, supportedComponentSet } from './component-catalog.ts';

export { supportedComponents, supportedComponentList, supportedComponentSet } from './component-catalog.ts';

const htmlComponentMapping: Record<string, string> = {
  div: 'Container',
  section: 'Container',
  header: 'Container',
  footer: 'Container',
  main: 'Container',
  nav: 'Container',
  span: 'Typography.Text',
  p: 'Typography.Paragraph',
  h1: 'Typography.Title',
  h2: 'Typography.Title',
  h3: 'Typography.Title',
  button: 'Button',
};

export function isNodeLike(value: unknown): value is SchemaNode {
  return Boolean(value) && typeof value === 'object' && 'component' in (value as Record<string, unknown>);
}

function toSafeIdSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'node';
}

function isTextLike(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function flattenToText(value: unknown): string {
  if (isTextLike(value)) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(flattenToText).filter(Boolean).join(' ').trim();
  }
  if (isNodeLike(value)) {
    return flattenToText(value.children);
  }
  return '';
}

function textToTypographyNode(text: string, id: string): SchemaNode {
  return {
    id,
    component: 'Typography.Text',
    props: {},
    children: text,
  };
}

function normalizeChildrenPayload(children: unknown[], nodeId: string): SchemaNode[] | string | undefined {
  const nodeChildren = children.filter(isNodeLike);
  const textChildren = children.filter(isTextLike).map(String).filter(Boolean);

  if (nodeChildren.length > 0) {
    return [
      ...nodeChildren,
      ...textChildren.map((text, index) => textToTypographyNode(text, `${nodeId}-text-${index + 1}`)),
    ];
  }

  const text = textChildren.join(' ').trim();
  return text || undefined;
}

function normalizeNodeProps(node: SchemaNode): void {
  const props = node.props;
  if (!props || typeof props !== 'object') {
    return;
  }

  const textPropKeys = ['title', 'label', 'description', 'extra', 'placeholder'];
  for (const key of textPropKeys) {
    if (key in props) {
      const value = props[key];
      if (isNodeLike(value) || Array.isArray(value)) {
        const text = flattenToText(value);
        if (text) {
          props[key] = text;
        } else {
          delete props[key];
        }
      }
    }
  }

  if (node.component === 'Alert') {
    if (isNodeLike(props.title) || Array.isArray(props.title)) {
      props.title = flattenToText(props.title) || '提示';
    }
    if (isNodeLike(props.description) || Array.isArray(props.description)) {
      props.description = flattenToText(props.description);
    }
    delete props.action;
    delete props.closeText;
    delete props.icon;
  }

  if (node.component === 'Card') {
    if (isNodeLike(props.title) || Array.isArray(props.title)) {
      props.title = flattenToText(props.title) || '内容卡片';
    }
    if (isNodeLike(props.extra) || Array.isArray(props.extra)) {
      props.extra = flattenToText(props.extra);
    }
  }

  if (node.component === 'Descriptions.Item') {
    if (isNodeLike(props.label) || Array.isArray(props.label)) {
      props.label = flattenToText(props.label) || '字段';
    }
  }

  if (node.component === 'Descriptions') {
    delete props.items;
  }

  if (node.component === 'Statistic') {
    if (isNodeLike(props.title) || Array.isArray(props.title)) {
      props.title = flattenToText(props.title) || '指标';
    }
    if (isNodeLike(props.prefix) || Array.isArray(props.prefix)) {
      delete props.prefix;
    }
    if (isNodeLike(props.suffix) || Array.isArray(props.suffix)) {
      const suffix = flattenToText(props.suffix);
      if (suffix) {
        props.suffix = suffix;
      } else {
        delete props.suffix;
      }
    }
  }

  if (node.component === 'Tag') {
    delete props.icon;
  }

  if (node.component === 'Table' && Array.isArray(props.columns)) {
    node.columns = props.columns.map((column, index) => {
      const col = (column && typeof column === 'object' ? { ...(column as Record<string, unknown>) } : {}) as ColumnSchema & Record<string, unknown>;
      if (isNodeLike(col.title) || Array.isArray(col.title)) {
        col.title = flattenToText(col.title) || `列${index + 1}`;
      }
      if (isNodeLike(col.render) || Array.isArray(col.render) || typeof col.render === 'object') {
        delete col.render;
      }
      if (isNodeLike(col.editRender) || Array.isArray(col.editRender) || typeof col.editRender === 'object') {
        delete col.editRender;
      }
      if (typeof col.dataIndex !== 'string' || !col.dataIndex) {
        col.dataIndex = `field${index + 1}`;
      }
      if (typeof col.key !== 'string' || !col.key) {
        col.key = String(col.dataIndex);
      }
      if (typeof col.title !== 'string' || !col.title) {
        col.title = `列${index + 1}`;
      }
      return col;
    });
    delete props.columns;
  }

  if (node.component === 'Table' && props.pagination && typeof props.pagination === 'object' && !Array.isArray(props.pagination)) {
    const pagination = { ...(props.pagination as Record<string, unknown>) };

    if (typeof pagination.showTotal !== 'function') {
      delete pagination.showTotal;
    }
    if (typeof pagination.itemRender !== 'function') {
      delete pagination.itemRender;
    }
    if (
      pagination.showQuickJumper
      && typeof pagination.showQuickJumper === 'object'
      && !Array.isArray(pagination.showQuickJumper)
    ) {
      const quickJumper = { ...(pagination.showQuickJumper as Record<string, unknown>) };
      if (isNodeLike(quickJumper.goButton) || Array.isArray(quickJumper.goButton) || typeof quickJumper.goButton === 'object') {
        delete quickJumper.goButton;
      }
      pagination.showQuickJumper = quickJumper;
    }

    (props as Record<string, unknown>).pagination = pagination;
  }
}

function normalizeChildren(node: SchemaNode): SchemaNode {
  normalizeNodeProps(node);
  const children = Array.isArray(node.children) ? node.children : [];

  switch (node.component) {
    case 'Alert':
    case 'DatePicker':
    case 'Input':
    case 'Select':
    case 'Statistic':
    case 'Table':
    case 'Tabs': {
      delete node.children;
      return node;
    }
    case 'Typography.Text':
    case 'Typography.Title':
    case 'Typography.Paragraph':
    case 'Tag': {
      const text = flattenToText(children);
      node.children = text || flattenToText(node.props?.title) || flattenToText(node.props?.label) || '内容';
      return node;
    }
    case 'Row': {
      node.children = children
        .filter((child) => isNodeLike(child) || isTextLike(child))
        .map((child, index) => {
          if (isNodeLike(child) && child.component === 'Col') {
            return child;
          }
          return {
            id: `${node.id ?? 'row'}-col-${index + 1}`,
            component: 'Col',
            props: { span: 24 },
            children: isNodeLike(child)
              ? [child]
              : [textToTypographyNode(String(child), `${node.id ?? 'row'}-col-${index + 1}-text`)],
          };
        });
      return node;
    }
    case 'Descriptions': {
      node.children = children
        .filter((child) => isNodeLike(child) || isTextLike(child))
        .map((child, index) => {
          if (isNodeLike(child) && child.component === 'Descriptions.Item') {
            return child;
          }
          return {
            id: `${node.id ?? 'descriptions'}-item-${index + 1}`,
            component: 'Descriptions.Item',
            props: { label: `字段${index + 1}` },
            children: isNodeLike(child)
              ? [child]
              : [textToTypographyNode(String(child), `${node.id ?? 'descriptions'}-item-${index + 1}-text`)],
          };
        });
      return node;
    }
    case 'Form': {
      node.children = children
        .filter(isNodeLike)
        .map((child, index) => {
          if (child.component === 'Form.Item' || child.component === 'FormItem') {
            return {
              ...child,
              component: 'FormItem',
            };
          }
          return {
            id: `${node.id ?? 'form'}-form-item-${index + 1}`,
            component: 'FormItem',
            props: {
              label: `字段${index + 1}`,
              name: `field${index + 1}`,
            },
            children: [child],
          };
        });
      return node;
    }
    case 'FormItem': {
      const nodeChildren = children.filter(isNodeLike);
      const firstChild = nodeChildren[0];
      node.children = firstChild
        ? [firstChild]
        : [
            {
              id: `${node.id ?? 'form-item'}-input`,
              component: 'Input',
              props: {
                placeholder: String(node.props?.label ?? '请输入'),
              },
            },
          ];
      return node;
    }
    default: {
      if (Array.isArray(node.children)) {
        const normalizedChildren = normalizeChildrenPayload(children, node.id ?? node.component.toLowerCase());
        if (normalizedChildren === undefined) {
          delete node.children;
        } else {
          node.children = normalizedChildren;
        }
      }
      return node;
    }
  }
}

function normalizeComponentName(node: SchemaNode): void {
  const mapped = htmlComponentMapping[node.component.toLowerCase()];
  if (mapped) {
    node.component = mapped;
    return;
  }
  if (!supportedComponentSet.has(node.component)) {
    node.component = 'Container';
  }
}

function ensureUniqueNodeIds(node: SchemaNode, seen: Set<string>, fallbackBase = 'node'): void {
  const baseId = toSafeIdSegment(
    typeof node.id === 'string' && node.id
      ? node.id
      : `${fallbackBase}-${node.component.toLowerCase()}`
  );
  let nextId = baseId;
  let suffix = 2;
  while (seen.has(nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }
  seen.add(nextId);
  node.id = nextId;

  if (Array.isArray(node.children)) {
    node.children.forEach((child, index) => {
      if (isNodeLike(child)) {
        ensureUniqueNodeIds(child, seen, `${node.id}-child-${index + 1}`);
      }
    });
  }
}

export function normalizeGeneratedNode(node: SchemaNode): SchemaNode {
  normalizeComponentName(node);

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (isNodeLike(child)) {
        normalizeGeneratedNode(child);
      }
    }
  }

  const normalized = normalizeChildren(node);
  ensureUniqueNodeIds(normalized, new Set());
  return normalized;
}
