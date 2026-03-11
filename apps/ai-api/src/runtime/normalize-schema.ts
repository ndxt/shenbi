import type { ColumnSchema, PropValue, SchemaNode } from '@shenbi/schema';
import type { ComponentContract, ContractProp } from '../../../../packages/schema/types/contract.ts';
import * as schemaContractsModule from '../../../../packages/schema/contracts/index.ts';
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

const componentAliasMapping: Record<string, string> = {
  FormItem: 'Form.Item',
};

const formLayoutChildComponents = new Set([
  'Container',
  'Row',
  'Col',
  'Space',
  'Flex',
]);

const formPresentationalChildComponents = new Set([
  'Alert',
  'Card',
  'Divider',
  'Typography.Title',
  'Typography.Text',
  'Typography.Paragraph',
]);

const formFieldLikeComponents = new Set([
  'Input',
  'Input.TextArea',
  'InputNumber',
  'Select',
  'DatePicker',
  'DatePicker.RangePicker',
  'TimePicker',
  'Switch',
  'Checkbox',
  'Checkbox.Group',
  'Radio',
  'Radio.Group',
  'Rate',
  'Slider',
  'TreeSelect',
  'Cascader',
  'AutoComplete',
  'Mentions',
  'ColorPicker',
]);

export interface SanitizationDiagnostic {
  componentType: string;
  propPath: string;
  valueKind: string;
  action: 'drop' | 'default' | 'preserve';
  rule: string;
}

const builtinContracts =
  (schemaContractsModule as { builtinContracts?: ComponentContract[] }).builtinContracts
  ?? (schemaContractsModule as { default?: { builtinContracts?: ComponentContract[] } }).default?.builtinContracts
  ?? [];

const builtinContractMap = Object.fromEntries(
  builtinContracts.map((contract) => [contract.componentType, contract]),
) as Record<string, ComponentContract>;

export function isNodeLike(value: unknown): value is SchemaNode {
  return Boolean(value) && typeof value === 'object' && 'component' in (value as Record<string, unknown>);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isJsFunctionValue(value: unknown): value is { type?: string; __type?: string; params?: string[]; body?: string } {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && (
      (value as { type?: string }).type === 'JSFunction'
      || (value as { __type?: string }).__type === 'JSFunction'
    )
    && typeof (value as { body?: string }).body === 'string'
    && (
      !('params' in (value as Record<string, unknown>))
      || Array.isArray((value as { params?: unknown }).params)
    );
}

function isJsExpressionValue(value: unknown): value is { type?: string; __type?: string; value?: string } {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && (
      (value as { type?: string }).type === 'JSExpression'
      || (value as { __type?: string }).__type === 'JSExpression'
    )
    && typeof (value as { value?: string }).value === 'string';
}

function isAllowedFunctionValue(value: unknown): boolean {
  return typeof value === 'function' || isJsFunctionValue(value);
}

function isRenderablePrimitive(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function describeValueKind(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (isNodeLike(value)) {
    return 'SchemaNode';
  }
  if (isJsFunctionValue(value)) {
    return 'JSFunction';
  }
  return typeof value;
}

function pushDiagnostic(
  diagnostics: SanitizationDiagnostic[],
  componentType: string,
  propPath: string,
  value: unknown,
  action: SanitizationDiagnostic['action'],
  rule: string,
): void {
  diagnostics.push({
    componentType,
    propPath,
    valueKind: describeValueKind(value),
    action,
    rule,
  });
}

function isFormDirectChildComponent(component: string): boolean {
  return component === 'Form.Item'
    || component === 'FormItem'
    || formLayoutChildComponents.has(component)
    || formPresentationalChildComponents.has(component);
}

function isFormFieldLikeComponent(component: string): boolean {
  return formFieldLikeComponents.has(component);
}

function sanitizeSchemaNodeProp(
  value: unknown,
  componentType: string,
  propPath: string,
  diagnostics: SanitizationDiagnostic[],
): SchemaNode | undefined {
  if (!isNodeLike(value)) {
    pushDiagnostic(diagnostics, componentType, propPath, value, 'drop', 'type=SchemaNode');
    return undefined;
  }
  normalizeComponentName(value);
  sanitizePropsByContract(value, diagnostics);
  if (Array.isArray(value.children)) {
    for (const child of value.children) {
      if (isNodeLike(child)) {
        sanitizeSchemaNodeProp(child, value.component, `${propPath}.children`, diagnostics);
      }
    }
  }
  return value;
}

function sanitizeRenderableNodeValue(
  value: unknown,
  componentType: string,
  propPath: string,
  diagnostics: SanitizationDiagnostic[],
): unknown {
  if (isRenderablePrimitive(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    const sanitizedItems = value.flatMap((item, index) => {
      const sanitizedItem = sanitizeRenderableNodeValue(
        item,
        componentType,
        `${propPath}[${index}]`,
        diagnostics,
      );
      return sanitizedItem === undefined ? [] : [sanitizedItem];
    });
    return sanitizedItems;
  }

  return sanitizeSchemaNodeProp(value, componentType, propPath, diagnostics);
}

function normalizeLegacyPropAliases(node: SchemaNode): void {
  const props = node.props;
  if (!props || typeof props !== 'object') {
    return;
  }

  const propsRecord = props as Record<string, unknown>;
  if ('children' in propsRecord) {
    const legacyChildren = propsRecord.children;
    const hasTopLevelChildren = Array.isArray(node.children)
      ? node.children.length > 0
      : node.children != null;
    if (!hasTopLevelChildren && (
      isTextLike(legacyChildren)
      || isNodeLike(legacyChildren)
      || (Array.isArray(legacyChildren) && legacyChildren.every((item) => isTextLike(item) || isNodeLike(item)))
    )) {
      node.children = legacyChildren as PropValue | SchemaNode[];
    }
    delete propsRecord.children;
  }

  if (node.component === 'Alert') {
    if (!('message' in props) && 'title' in props) {
      props.message = props.title as PropValue;
    }
    delete props.title;
  }

  if (node.component === 'Tabs.TabPane' && !('label' in props) && 'tab' in props) {
    props.label = props.tab as PropValue;
    delete props.tab;
  }
}

function sanitizePropByContract(
  value: unknown,
  prop: ContractProp,
  componentType: string,
  propPath: string,
  diagnostics: SanitizationDiagnostic[],
): unknown {
  if (Array.isArray(prop.oneOf) && prop.oneOf.length > 0) {
    for (const candidate of prop.oneOf) {
      const candidateDiagnostics: SanitizationDiagnostic[] = [];
      const sanitizedValue = sanitizePropByContract(
        value,
        candidate,
        componentType,
        propPath,
        candidateDiagnostics,
      );
      if (sanitizedValue !== undefined) {
        diagnostics.push(...candidateDiagnostics);
        return sanitizedValue;
      }
    }

    pushDiagnostic(
      diagnostics,
      componentType,
      propPath,
      value,
      'drop',
      `oneOf(${prop.oneOf.map((candidate) => candidate.type).join('|')})`,
    );
    return undefined;
  }

  if (prop.allowExpression && isJsExpressionValue(value)) {
    return value;
  }

  switch (prop.type) {
    case 'function':
      if (isAllowedFunctionValue(value)) {
        return value;
      }
      pushDiagnostic(diagnostics, componentType, propPath, value, 'drop', 'type=function(JSFunction only)');
      return undefined;
    case 'boolean':
      if (typeof value === 'boolean' && (!prop.enum || prop.enum.includes(value))) {
        return value;
      }
      pushDiagnostic(
        diagnostics,
        componentType,
        propPath,
        value,
        'drop',
        prop.enum ? `type=boolean(${prop.enum.join('|')})` : 'type=boolean',
      );
      return undefined;
    case 'number':
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      pushDiagnostic(diagnostics, componentType, propPath, value, 'drop', 'type=number');
      return undefined;
    case 'string':
      if (typeof value === 'string') {
        return value;
      }
      pushDiagnostic(diagnostics, componentType, propPath, value, 'drop', 'type=string');
      return undefined;
    case 'enum':
      if (prop.enum?.includes(value)) {
        return value;
      }
      pushDiagnostic(
        diagnostics,
        componentType,
        propPath,
        value,
        'drop',
        `type=enum(${(prop.enum ?? []).join('|')})`,
      );
      return undefined;
    case 'SchemaNode':
      return sanitizeRenderableNodeValue(value, componentType, propPath, diagnostics);
    case 'object': {
      if (!isPlainObject(value)) {
        pushDiagnostic(diagnostics, componentType, propPath, value, 'drop', 'type=object');
        return undefined;
      }
      if (!prop.shape) {
        return value;
      }
      const sanitizedObject: Record<string, unknown> = {};
      for (const [childKey, childValue] of Object.entries(value)) {
        const childProp = prop.shape[childKey];
        if (!childProp) {
          pushDiagnostic(
            diagnostics,
            componentType,
            `${propPath}.${childKey}`,
            childValue,
            'drop',
            'unknown nested prop',
          );
          continue;
        }
        const nextValue = sanitizePropByContract(
          childValue,
          childProp,
          componentType,
          `${propPath}.${childKey}`,
          diagnostics,
        );
        if (nextValue !== undefined) {
          sanitizedObject[childKey] = nextValue;
        }
      }
      return sanitizedObject;
    }
    case 'array':
      if (!Array.isArray(value)) {
        pushDiagnostic(diagnostics, componentType, propPath, value, 'drop', 'type=array');
        return undefined;
      }
      if (!prop.items) {
        return value;
      }
      return value.flatMap((item, index) => {
        const sanitizedItem = sanitizePropByContract(
          item,
          prop.items!,
          componentType,
          `${propPath}[${index}]`,
          diagnostics,
        );
        return sanitizedItem === undefined ? [] : [sanitizedItem];
      });
    default:
      return value;
  }
}

function sanitizePropsByContract(
  node: SchemaNode,
  diagnostics: SanitizationDiagnostic[],
): void {
  const contract = builtinContractMap[node.component] as ComponentContract | undefined;
  const props = node.props;
  if (!contract?.props || !props || typeof props !== 'object') {
    return;
  }

  const sanitizedProps: Record<string, PropValue> = {};
  for (const [propName, propValue] of Object.entries(props)) {
    const contractProp = contract.props[propName];
    if (!contractProp) {
      pushDiagnostic(diagnostics, node.component, propName, propValue, 'drop', 'unknown prop');
      continue;
    }
    const sanitizedValue = sanitizePropByContract(
      propValue,
      contractProp,
      node.component,
      propName,
      diagnostics,
    );
    if (sanitizedValue !== undefined) {
      sanitizedProps[propName] = sanitizedValue as PropValue;
      continue;
    }
    if (contractProp.default !== undefined) {
      sanitizedProps[propName] = contractProp.default as PropValue;
      pushDiagnostic(diagnostics, node.component, propName, propValue, 'default', `default=${String(contractProp.default)}`);
    }
  }

  node.props = sanitizedProps;
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

  const textPropKeys = ['title', 'label', 'message', 'description', 'placeholder', 'subTitle'];
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
    if (isNodeLike(props.message) || Array.isArray(props.message)) {
      const message = flattenToText(props.message);
      if (message) {
        props.message = message;
      } else {
        delete props.message;
      }
    }
    if (isNodeLike(props.description) || Array.isArray(props.description)) {
      const description = flattenToText(props.description);
      if (description) {
        props.description = description;
      } else {
        delete props.description;
      }
    }
    delete props.title;
    delete props.action;
    delete props.closeText;
    delete props.icon;
  }

  if (node.component === 'Col') {
    // When both `span` and `flex` are set, `flex` (fixed px) overrides `span` (proportional grid),
    // causing columns to not fill available space. Drop `flex` when `span` is present.
    if ('span' in props && props.span != null && 'flex' in props) {
      delete props.flex;
    }
  }

  if (node.component === 'Card') {
    if (isNodeLike(props.title) || Array.isArray(props.title)) {
      props.title = flattenToText(props.title) || '内容卡片';
    }
    if (isNodeLike(props.extra) || Array.isArray(props.extra)) {
      props.extra = flattenToText(props.extra);
    }
    // antd v5: bordered is deprecated, use variant instead
    if ('bordered' in props) {
      props.variant = props.variant ?? (props.bordered ? 'outlined' : 'borderless');
      delete props.bordered;
    }
  }

  if (node.component === 'Tabs.TabPane' && !('label' in props) && 'tab' in props) {
    props.label = props.tab;
    delete props.tab;
  }

  if (node.component === 'Avatar') {
    delete props.icon;
    if (Array.isArray(node.children)) {
      const text = flattenToText(node.children);
      node.children = text ? text.slice(0, 2) : undefined;
    } else if (typeof node.children === 'string') {
      node.children = node.children.slice(0, 2);
    }
  }

  if (node.component === 'Badge') {
    if (isNodeLike(props.text) || Array.isArray(props.text)) {
      const text = flattenToText(props.text);
      if (text) {
        props.text = text;
      } else {
        delete props.text;
      }
    }
    if (isNodeLike(props.count) || Array.isArray(props.count)) {
      const count = flattenToText(props.count);
      if (count) {
        props.count = count;
      } else {
        delete props.count;
      }
    }
  }

  if (node.component === 'Badge.Ribbon') {
    if (isNodeLike(props.text) || Array.isArray(props.text)) {
      const text = flattenToText(props.text);
      if (text) {
        props.text = text;
      } else {
        delete props.text;
      }
    }
  }

  if (node.component === 'Empty') {
    if (isNodeLike(props.image) || Array.isArray(props.image) || typeof props.image === 'object') {
      delete props.image;
    }
  }

  if (node.component === 'Timeline') {
    // antd v5: Timeline.Item as children is deprecated; convert to items array.
    // IMPORTANT: props.items[].children must be plain text or undefined – the runtime
    // cannot render schema node objects placed there as React children.
    // If ANY Timeline.Item contains schema-node children (e.g. Container, Typography),
    // keep the entire Timeline in children form so the render engine can recurse.
    const timelineChildren = node.children;
    if (Array.isArray(timelineChildren)) {
      const timelineItems = timelineChildren.filter(
        (c): c is SchemaNode => isNodeLike(c) && c.component === 'Timeline.Item',
      );
      const hasNodeChildren = timelineItems.some(
        (item) => Array.isArray(item.children) && item.children.some(isNodeLike),
      );
      if (!hasNodeChildren && timelineItems.length > 0) {
        // All items contain only plain text – safe to convert to props.items
        const items = timelineItems.map((item) => {
          const itemProps = { ...(item.props ?? {}) };
          const content = flattenToText(item.children) || undefined;
          return { ...itemProps, children: content };
        });
        (props as Record<string, unknown>).items = items;
        node.children = undefined;
      }
      // If hasNodeChildren, leave node.children intact; the render engine handles recursion.
    }
    // antd v5: mode='left'/'right' are deprecated, use 'start'/'end' instead
    if (props.mode === 'left') props.mode = 'start';
    if (props.mode === 'right') props.mode = 'end';
  }

  if (node.component === 'Descriptions.Item') {
    if (isNodeLike(props.label) || Array.isArray(props.label)) {
      props.label = flattenToText(props.label) || '字段';
    }
  }

  if (node.component === 'Descriptions') {
    delete props.items;
  }

  if (node.component === 'Breadcrumb') {
    if (isNodeLike(props.separator) || Array.isArray(props.separator)) {
      const separator = flattenToText(props.separator);
      if (separator) {
        props.separator = separator;
      } else {
        delete props.separator;
      }
    }
    if (!isAllowedFunctionValue(props.itemRender)) {
      delete props.itemRender;
    }
    if (Array.isArray(props.items)) {
      (props as Record<string, unknown>).items = props.items
        .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
        .map((item, index) => {
          const entry = { ...(item as Record<string, unknown>) };
          const title = flattenToText(entry.title);
          entry.title = title || `路径${index + 1}`;
          if (entry.menu && typeof entry.menu === 'object') {
            delete entry.menu;
          }
          if (entry.overlay && typeof entry.overlay === 'object') {
            delete entry.overlay;
          }
          return entry;
        });
    }
  }

  if (node.component === 'Steps') {
    if (typeof props.progressDot !== 'boolean') {
      delete props.progressDot;
    }
    if (Array.isArray(props.items)) {
      (props as Record<string, unknown>).items = props.items
        .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
        .map((item, index) => {
          const entry = { ...(item as Record<string, unknown>) };
          entry.title = flattenToText(entry.title) || `步骤${index + 1}`;
          if ('description' in entry) {
            const description = flattenToText(entry.description);
            if (description) {
              entry.description = description;
            } else {
              delete entry.description;
            }
          }
          if ('subTitle' in entry) {
            const subTitle = flattenToText(entry.subTitle);
            if (subTitle) {
              entry.subTitle = subTitle;
            } else {
              delete entry.subTitle;
            }
          }
          delete entry.icon;
          return entry;
        });
    }
  }

  if (node.component === 'Progress') {
    if (!isAllowedFunctionValue(props.format)) {
      delete props.format;
    }
    if (props.success && typeof props.success === 'object' && !Array.isArray(props.success)) {
      const success = { ...(props.success as Record<string, unknown>) };
      if (!isAllowedFunctionValue(success.format)) {
        delete success.format;
      }
      if ('strokeColor' in success && typeof success.strokeColor === 'object') {
        delete success.strokeColor;
      }
      (props as Record<string, unknown>).success = success;
    }
  }

  if (node.component === 'Result') {
    if (isNodeLike(props.subTitle) || Array.isArray(props.subTitle)) {
      props.subTitle = flattenToText(props.subTitle) || '结果说明';
    }
    delete props.icon;
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
    // antd v5: valueStyle is deprecated, use styles.content instead
    if ('valueStyle' in props && props.valueStyle && typeof props.valueStyle === 'object') {
      const existingStyles = (props.styles && typeof props.styles === 'object'
        ? props.styles
        : {}) as Record<string, unknown>;
      props.styles = { ...existingStyles, content: props.valueStyle };
      delete props.valueStyle;
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

    if (!isAllowedFunctionValue(pagination.showTotal)) {
      delete pagination.showTotal;
    }
    if (!isAllowedFunctionValue(pagination.itemRender)) {
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

function normalizeChildren(node: SchemaNode, diagnostics: SanitizationDiagnostic[]): SchemaNode {
  normalizeNodeProps(node);
  const children = Array.isArray(node.children) ? node.children : [];

  switch (node.component) {
    case 'Alert':
    case 'Breadcrumb':
    case 'DatePicker':
    case 'DatePicker.RangePicker':
    case 'Input':
    case 'Pagination':
    case 'Progress':
    case 'Result':
    case 'Select':
    case 'Statistic':
    case 'Steps':
    case 'Table': {
      if (node.component === 'Breadcrumb' && !Array.isArray(node.props?.items)) {
        const breadcrumbItems = children
          .map((child, index) => {
            const title = flattenToText(child);
            if (!title) {
              return null;
            }
            return { title, key: `${node.id ?? 'breadcrumb'}-item-${index + 1}` };
          })
          .filter(Boolean);
        if (breadcrumbItems.length > 0) {
          node.props = { ...(node.props ?? {}), items: breadcrumbItems };
        }
      }
      if (node.component === 'Steps' && !Array.isArray(node.props?.items)) {
        const stepItems = children
          .map((child, index) => {
            const title = flattenToText(child);
            if (!title) {
              return null;
            }
            return { title, key: `${node.id ?? 'steps'}-item-${index + 1}` };
          })
          .filter(Boolean);
        if (stepItems.length > 0) {
          node.props = { ...(node.props ?? {}), items: stepItems };
        }
      }
      delete node.children;
      return node;
    }
    case 'Tabs': {
      node.children = children
        .filter((child) => isNodeLike(child) || isTextLike(child))
        .map((child, index) => {
          if (isNodeLike(child) && child.component === 'Tabs.TabPane') {
            return child;
          }
          return {
            id: `${node.id ?? 'tabs'}-pane-${index + 1}`,
            component: 'Tabs.TabPane',
            props: {
              key: `${node.id ?? 'tabs'}-pane-${index + 1}`,
              label: `标签${index + 1}`,
            },
            children: isNodeLike(child)
              ? [child]
              : [textToTypographyNode(String(child), `${node.id ?? 'tabs'}-pane-${index + 1}-text`)],
          };
        });
      return node;
    }
    case 'Avatar.Group': {
      node.children = children
        .filter((child) => isNodeLike(child) || isTextLike(child))
        .map((child, index) => {
          if (isNodeLike(child) && child.component === 'Avatar') {
            return child;
          }
          return {
            id: `${node.id ?? 'avatar-group'}-avatar-${index + 1}`,
            component: 'Avatar',
            props: {},
            children: isNodeLike(child)
              ? flattenToText(child) || '人'
              : String(child).slice(0, 2),
          };
        });
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
              component: 'Form.Item',
            };
          }
          if (isFormDirectChildComponent(child.component)) {
            return child;
          }
          if (isFormFieldLikeComponent(child.component)) {
            pushDiagnostic(
              diagnostics,
              'Form',
              `children[${index}]`,
              child,
              'default',
              'auto-wrapped-field-control',
            );
            return {
              id: `${node.id ?? 'form'}-form-item-${index + 1}`,
              component: 'Form.Item',
              children: [child],
            };
          }
          pushDiagnostic(
            diagnostics,
            'Form',
            `children[${index}]`,
            child,
            'preserve',
            'preserved-non-field-form-child',
          );
          return {
            ...child,
          };
        });
      return node;
    }
    case 'Form.Item':
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
        const normalizedChildren = normalizeChildrenPayload(children, node.id ?? (typeof node.component === 'string' && node.component ? node.component.toLowerCase() : 'node'));
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
  if (typeof node.component !== 'string' || !node.component) {
    node.component = 'Container';
    return;
  }
  const mapped = htmlComponentMapping[node.component.toLowerCase()];
  if (mapped) {
    node.component = mapped;
    return;
  }
  const alias = componentAliasMapping[node.component];
  if (alias) {
    node.component = alias;
  }
  if (!supportedComponentSet.has(node.component)) {
    node.component = 'Container';
  }
}

function ensureUniqueNodeIds(node: SchemaNode, seen: Set<string>, fallbackBase = 'node'): void {
  const baseId = toSafeIdSegment(
    typeof node.id === 'string' && node.id
      ? node.id
      : `${fallbackBase}-${typeof node.component === 'string' && node.component ? node.component.toLowerCase() : 'node'}`
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

function normalizeGeneratedNodeInternal(
  node: SchemaNode,
  diagnostics: SanitizationDiagnostic[],
): SchemaNode {
  normalizeComponentName(node);
  normalizeLegacyPropAliases(node);
  sanitizePropsByContract(node, diagnostics);

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (isNodeLike(child)) {
        normalizeGeneratedNodeInternal(child, diagnostics);
      }
    }
  }

  return normalizeChildren(node, diagnostics);
}

export function normalizeGeneratedNodeWithDiagnostics(node: SchemaNode): {
  node: SchemaNode;
  diagnostics: SanitizationDiagnostic[];
} {
  const diagnostics: SanitizationDiagnostic[] = [];
  const normalized = normalizeGeneratedNodeInternal(node, diagnostics);
  ensureUniqueNodeIds(normalized, new Set());
  return { node: normalized, diagnostics };
}

export function normalizeGeneratedNode(node: SchemaNode): SchemaNode {
  return normalizeGeneratedNodeWithDiagnostics(node).node;
}
