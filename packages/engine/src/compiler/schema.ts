import type { ColumnSchema, PropValue, SchemaNode } from '@shenbi/schema';
import type {
  ComponentResolver,
  CompiledColumn,
  CompiledExpression,
  CompiledNode,
} from '../types/contracts';
import { compileExpression, compilePropValue, extractDeps } from './expression';

type MaybeJSExpressionDef = { type?: string; __type?: string; value?: string };
type MaybeJSFunctionDef = { type?: string; __type?: string; params?: string[]; body?: string };

const EMPTY_EXPRESSION_CONTEXT = {
  state: {},
  params: {},
  computed: {},
  ds: {},
  utils: {},
  refs: {},
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return isObject(value) && !Array.isArray(value);
}

function isSchemaNode(value: unknown): value is SchemaNode {
  return isObject(value) && typeof value.component === 'string';
}

function isPrimitiveChild(value: unknown): value is string | number | boolean | null {
  return value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function isCompiledExpression(value: unknown): value is CompiledExpression {
  return (
    isObject(value) &&
    typeof value.raw === 'string' &&
    Array.isArray(value.deps) &&
    typeof value.fn === 'function'
  );
}

function isJSExpressionDef(value: unknown): value is MaybeJSExpressionDef {
  return isObject(value) && (value.type === 'JSExpression' || value.__type === 'JSExpression');
}

function isJSFunctionDef(value: unknown): value is MaybeJSFunctionDef {
  return (
    isObject(value) &&
    (value.type === 'JSFunction' || value.__type === 'JSFunction') &&
    typeof value.body === 'string'
  );
}

function createStaticExpression(value: any, raw = '{{__static__}}'): CompiledExpression {
  return {
    raw,
    deps: [],
    fn: () => value,
  };
}

function collectDeps(depsList: Array<string[] | undefined>): string[] {
  const output = new Set<string>();
  for (const deps of depsList) {
    for (const dep of deps ?? []) {
      output.add(dep);
    }
  }
  return [...output];
}

interface CompiledPropResult {
  isStatic: boolean;
  value: any;
  deps: string[];
}

function compileFunctionToExpression(
  rawValue: unknown,
  compiledFn: (ctx: any, ...args: any[]) => any,
): CompiledExpression {
  const body = isJSFunctionDef(rawValue) ? rawValue.body ?? '' : '';
  const deps = body ? extractDeps(body) : [];
  return {
    raw: '{{[JSFunction]}}',
    deps,
    fn: (ctx) => (...args: any[]) => compiledFn(ctx, ...args),
  };
}

function resolveCompiledPropResult(
  result: CompiledPropResult,
  ctx: any,
): any {
  if (result.isStatic) {
    return result.value;
  }
  return (result.value as CompiledExpression).fn(ctx);
}

function compilePropRuntimeValue(value: unknown): CompiledPropResult {
  const compiled = compilePropValue(value);
  if (isCompiledExpression(compiled)) {
    return {
      isStatic: false,
      value: compiled,
      deps: compiled.deps,
    };
  }

  if (typeof compiled === 'function') {
    const expression = compileFunctionToExpression(value, compiled);
    return {
      isStatic: false,
      value: expression,
      deps: expression.deps,
    };
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => compilePropRuntimeValue(item));
    const hasDynamic = items.some((item) => !item.isStatic);
    if (!hasDynamic) {
      return {
        isStatic: true,
        value,
        deps: [],
      };
    }

    const deps = collectDeps(items.map((item) => item.deps));
    const expression: CompiledExpression = {
      raw: '{{[Array]}}',
      deps,
      fn: (ctx) => items.map((item) => resolveCompiledPropResult(item, ctx)),
    };
    return {
      isStatic: false,
      value: expression,
      deps,
    };
  }

  if (isPlainObject(value)) {
    const fields = Object.entries(value).map(([key, child]) => ({
      key,
      result: compilePropRuntimeValue(child),
    }));
    const hasDynamic = fields.some((entry) => !entry.result.isStatic);
    if (!hasDynamic) {
      return {
        isStatic: true,
        value,
        deps: [],
      };
    }

    const deps = collectDeps(fields.map((entry) => entry.result.deps));
    const expression: CompiledExpression = {
      raw: '{{[Object]}}',
      deps,
      fn: (ctx) => {
        const output: Record<string, any> = {};
        for (const entry of fields) {
          output[entry.key] = resolveCompiledPropResult(entry.result, ctx);
        }
        return output;
      },
    };
    return {
      isStatic: false,
      value: expression,
      deps,
    };
  }

  return {
    isStatic: true,
    value,
    deps: [],
  };
}

function compileAnyToExpression(value: PropValue | unknown): CompiledExpression {
  const compiled = compilePropValue(value);
  if (isCompiledExpression(compiled)) {
    return compiled;
  }

  if (typeof compiled === 'function') {
    const functionBody = isJSFunctionDef(value) ? value.body ?? '' : '';
    return {
      raw: '{{[JSFunction]}}',
      deps: functionBody ? extractDeps(functionBody) : [],
      fn: (ctx) => (...args: any[]) => compiled(ctx, ...args),
    };
  }

  if (isJSExpressionDef(value) && typeof value.value === 'string') {
    return compileExpression(value.value);
  }

  return createStaticExpression(value);
}

function compileClassName(className: SchemaNode['className']): string | CompiledExpression | undefined {
  if (className == null) {
    return undefined;
  }
  const compiled = compilePropValue(className);
  if (isCompiledExpression(compiled)) {
    return compiled;
  }
  if (typeof className === 'string') {
    return className;
  }
  return String(className);
}

function compileStyle(style: SchemaNode['style']): Record<string, any> | CompiledExpression | undefined {
  if (style == null) {
    return undefined;
  }

  const topLevelCompiled = compilePropValue(style);
  if (isCompiledExpression(topLevelCompiled)) {
    return topLevelCompiled;
  }

  if (!isPlainObject(style)) {
    return createStaticExpression(style);
  }

  const staticStyle: Record<string, any> = {};
  const dynamicStyle: Record<string, CompiledExpression> = {};

  for (const [key, value] of Object.entries(style)) {
    const compiled = compilePropValue(value);
    if (isCompiledExpression(compiled)) {
      dynamicStyle[key] = compiled;
    } else if (typeof compiled === 'function') {
      staticStyle[key] = (...args: any[]) => compiled(EMPTY_EXPRESSION_CONTEXT, ...args);
    } else {
      staticStyle[key] = value;
    }
  }

  if (Object.keys(dynamicStyle).length === 0) {
    return staticStyle;
  }

  return {
    raw: '{{style}}',
    deps: collectDeps(Object.values(dynamicStyle).map((item) => item.deps)),
    fn: (ctx) => {
      const merged = { ...staticStyle };
      for (const [key, expr] of Object.entries(dynamicStyle)) {
        merged[key] = expr.fn(ctx);
      }
      return merged;
    },
  };
}

function compileColumns(columns: SchemaNode['columns'], resolver: ComponentResolver): CompiledColumn[] | undefined {
  if (!columns || columns.length === 0) {
    return undefined;
  }

  return columns.map((column) => {
    const {
      render,
      editRender,
      if: ifValue,
      editRules,
      ...config
    } = column as ColumnSchema & { renderParams?: string[]; editRenderParams?: string[] };

    const staticConfig: Record<string, any> = {};
    const dynamicConfig: Record<string, CompiledExpression> = {};

    for (const [key, value] of Object.entries(config)) {
      const result = compilePropRuntimeValue(value);
      if (result.isStatic) {
        staticConfig[key] = result.value;
      } else {
        dynamicConfig[key] = result.value as CompiledExpression;
      }
    }

    const compiled: CompiledColumn = {
      config: staticConfig,
    };

    if (Object.keys(dynamicConfig).length > 0) {
      compiled.dynamicConfig = dynamicConfig;
    }

    if (Array.isArray(editRules)) {
      compiled.editRules = editRules;
    }

    if (ifValue !== undefined) {
      compiled.ifFn = compileAnyToExpression(ifValue);
    }

    if (isSchemaNode(render)) {
      compiled.compiledRender = compileNode(render, resolver);
      const renderParams = (column as { renderParams?: string[] }).renderParams;
      if (Array.isArray(renderParams)) {
        compiled.renderParams = [...renderParams];
      }
    }

    if (isSchemaNode(editRender)) {
      compiled.compiledEditRender = compileNode(editRender, resolver);
      const editRenderParams = (column as { editRenderParams?: string[] }).editRenderParams;
      if (Array.isArray(editRenderParams)) {
        compiled.editRenderParams = [...editRenderParams];
      }
    }

    return compiled;
  });
}

function compileChildren(
  node: SchemaNode,
  resolver: ComponentResolver,
): Pick<CompiledNode, 'childrenFn' | 'compiledChildren'> & { staticChildren?: any; deps: string[] } {
  const children = node.children;
  if (children == null) {
    return { deps: [] };
  }

  if (Array.isArray(children)) {
    const schemaChildren = children.filter(isSchemaNode);
    if (schemaChildren.length === 0 && children.every(isPrimitiveChild)) {
      return {
        staticChildren: children,
        deps: [],
      };
    }

    const compiledChildren = schemaChildren.map((child) => compileNode(child, resolver));
    return {
      compiledChildren,
      deps: collectDeps(compiledChildren.map((child) => child.allDeps)),
    };
  }

  if (isSchemaNode(children)) {
    const compiledChild = compileNode(children, resolver);
    return {
      compiledChildren: [compiledChild],
      deps: [...compiledChild.allDeps],
    };
  }

  const compiled = compilePropValue(children);
  if (isCompiledExpression(compiled)) {
    return {
      childrenFn: compiled,
      deps: [...compiled.deps],
    };
  }

  if (isJSExpressionDef(children) && typeof children.value === 'string') {
    const childrenFn = compileExpression(children.value);
    return {
      childrenFn,
      deps: [...childrenFn.deps],
    };
  }

  return {
    staticChildren: children,
    deps: [],
  };
}

function compileSlots(
  slots: SchemaNode['slots'],
  resolver: ComponentResolver,
): Record<string, CompiledNode | CompiledNode[]> | undefined {
  if (!slots) {
    return undefined;
  }

  const compiled: Record<string, CompiledNode | CompiledNode[]> = {};
  for (const [slotName, slotValue] of Object.entries(slots)) {
    if (Array.isArray(slotValue)) {
      compiled[slotName] = slotValue.filter(isSchemaNode).map((item) => compileNode(item, resolver));
      continue;
    }

    if (isSchemaNode(slotValue)) {
      compiled[slotName] = compileNode(slotValue, resolver);
    }
  }

  return Object.keys(compiled).length > 0 ? compiled : undefined;
}

function collectSlotDeps(compiledSlots: CompiledNode['compiledSlots']): string[] {
  if (!compiledSlots) {
    return [];
  }

  const deps: string[] = [];
  for (const slotValue of Object.values(compiledSlots)) {
    if (Array.isArray(slotValue)) {
      deps.push(...collectDeps(slotValue.map((item) => item.allDeps)));
    } else if (slotValue) {
      deps.push(...slotValue.allDeps);
    }
  }
  return [...new Set(deps)];
}

function collectColumnDeps(compiledColumns: CompiledColumn[] | undefined): string[] {
  if (!compiledColumns) {
    return [];
  }

  const deps: string[] = [];
  for (const column of compiledColumns) {
    if (column.dynamicConfig) {
      deps.push(...collectDeps(Object.values(column.dynamicConfig).map((item) => item.deps)));
    }
    if (column.ifFn) {
      deps.push(...column.ifFn.deps);
    }
    if (column.compiledRender) {
      deps.push(...column.compiledRender.allDeps);
    }
    if (column.compiledEditRender) {
      deps.push(...column.compiledEditRender.allDeps);
    }
  }
  return [...new Set(deps)];
}

function compileLoop(loop: SchemaNode['loop'], node: SchemaNode, resolver: ComponentResolver) {
  if (!loop) {
    return undefined;
  }

  const itemKey = loop.itemKey ?? 'item';
  const indexKey = loop.indexKey ?? 'index';
  const dataFn = compileAnyToExpression(loop.data);
  const keyFn = loop.key
    ? compileAnyToExpression(loop.key)
    : compileExpression(`{{${itemKey}.id ?? ${indexKey}}}`);

  const { loop: _removed, ...bodyNode } = node;
  const body = compileNode(bodyNode as SchemaNode, resolver);

  return {
    dataFn,
    itemKey,
    indexKey,
    keyFn,
    body,
  };
}

function compileNode(node: SchemaNode, resolver: ComponentResolver): CompiledNode {
  const staticProps: Record<string, any> = {};
  const dynamicProps: Record<string, CompiledExpression> = {};
  const propDeps: string[][] = [];

  for (const [key, value] of Object.entries(node.props ?? {})) {
    const result = compilePropRuntimeValue(value);
    if (!result.isStatic) {
      dynamicProps[key] = result.value as CompiledExpression;
      propDeps.push(result.deps);
      continue;
    }
    staticProps[key] = result.value;
  }

  const ifFn = node.if !== undefined ? compileAnyToExpression(node.if) : undefined;
  const showFn = node.show !== undefined ? compileAnyToExpression(node.show) : undefined;
  const className = compileClassName(node.className);
  const style = compileStyle(node.style);
  const compiledChildrenInfo = compileChildren(node, resolver);
  const compiledSlots = compileSlots(node.slots, resolver);
  const compiledColumns = compileColumns(node.columns, resolver);
  const loop = compileLoop(node.loop, node, resolver);

  if (compiledChildrenInfo.staticChildren !== undefined) {
    staticProps.children = compiledChildrenInfo.staticChildren;
  }

  let errorBoundary: CompiledNode['errorBoundary'];
  if (node.errorBoundary?.fallback && isSchemaNode(node.errorBoundary.fallback)) {
    errorBoundary = {
      fallback: compileNode(node.errorBoundary.fallback, resolver),
    };
  }

  const deps = collectDeps([
    ...propDeps,
    ifFn?.deps,
    showFn?.deps,
    isCompiledExpression(style) ? style.deps : undefined,
    isCompiledExpression(className) ? className.deps : undefined,
    compiledChildrenInfo.childrenFn?.deps,
    compiledChildrenInfo.compiledChildren?.flatMap((child) => child.allDeps),
    collectSlotDeps(compiledSlots),
    collectColumnDeps(compiledColumns),
    loop?.dataFn.deps,
    loop?.keyFn.deps,
    loop?.body.allDeps,
    errorBoundary?.fallback.allDeps,
  ]);

  const compiledNode: CompiledNode = {
    Component: resolver.resolve(node.component),
    componentType: node.component,
    staticProps,
    dynamicProps,
    allDeps: deps,
    __raw: node,
  };

  if (node.id !== undefined) {
    compiledNode.id = node.id;
  }
  if (ifFn) {
    compiledNode.ifFn = ifFn;
  }
  if (showFn) {
    compiledNode.showFn = showFn;
  }
  if (compiledChildrenInfo.childrenFn) {
    compiledNode.childrenFn = compiledChildrenInfo.childrenFn;
  }
  if (compiledChildrenInfo.compiledChildren) {
    compiledNode.compiledChildren = compiledChildrenInfo.compiledChildren;
  }
  if (compiledSlots) {
    compiledNode.compiledSlots = compiledSlots;
  }
  if (compiledColumns) {
    compiledNode.compiledColumns = compiledColumns;
  }
  if (loop) {
    compiledNode.loop = loop;
  }
  if (node.events) {
    compiledNode.events = node.events;
  }
  if (style !== undefined) {
    compiledNode.style = style;
  }
  if (className !== undefined) {
    compiledNode.className = className;
  }
  if (typeof node.permission === 'string') {
    compiledNode.permission = node.permission;
  }
  if (errorBoundary) {
    compiledNode.errorBoundary = errorBoundary;
  }

  return compiledNode;
}

export function compileSchema(
  node: SchemaNode | SchemaNode[],
  resolver: ComponentResolver,
): CompiledNode | CompiledNode[] {
  if (Array.isArray(node)) {
    return node.map((item) => compileNode(item, resolver));
  }
  return compileNode(node, resolver);
}
