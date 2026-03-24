import {
  createElement,
  Fragment,
  type ReactElement,
  type ReactNode,
  Component,
  createContext,
  useContext,
  useEffect,
  useRef,
} from 'react';
import type { ExpressionContext } from '@shenbi/schema';
import type {
  CompiledNode,
  CompiledColumn,
  ShenbiContextValue,
  CompiledExpression,
} from '../types/contracts';
import { setByPathMutable } from '../utils';

/**
 * Ant Design 内部使用 `{...node.props}` 从 JSX children 提取 item 数据的容器组件。
 * 这些组件的 children 被 NodeRenderer 包装后会导致 props 丢失。
 * 修复方式：将 compiledChildren 转换为 items prop 格式。
 */
const ITEMS_BASED_COMPONENTS = new Set([
  'Descriptions',
  'Timeline',
  'Tabs',
]);

/**
 * 需要将挂载容器设置为页面根节点的覆盖层组件。
 * 自动注入 getContainer prop 指向 ShenbiPage 的容器 div，
 * 避免这些组件默认挂载到 <body>。
 */
const OVERLAY_COMPONENTS = new Set(['Modal', 'Drawer']);

// ===== Context =====

export const ShenbiContext = createContext<ShenbiContextValue | null>(null);

export function useShenbi(): ShenbiContextValue {
  const ctx = useContext(ShenbiContext);
  if (!ctx) {
    throw new Error('useShenbi must be used within <ShenbiContext>');
  }
  return ctx;
}

export function useGetPopupContainer(): (() => HTMLElement) | undefined {
  const ctx = useContext(ShenbiContext);
  return ctx?.getPopupContainer;
}

// ===== ErrorBoundary =====

interface ErrorBoundaryProps {
  fallback: CompiledNode;
  extraContext?: Record<string, any> | undefined;
  children?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return createElement(NodeRenderer, {
        node: this.props.fallback,
        extraContext: this.props.extraContext,
      });
    }
    return this.props.children;
  }
}

// ===== Page-level ErrorBoundary =====

interface PageErrorBoundaryState {
  error: Error | null;
}

/**
 * Top-level error boundary for the entire page.
 * Catches any uncaught rendering errors and shows a user-friendly message
 * instead of crashing to a black screen.
 */
export class PageErrorBoundary extends Component<{ children?: ReactNode }, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return createElement('div', {
        style: {
          padding: 24,
          margin: 16,
          background: 'var(--color-danger-bg, #fff2f0)',
          border: '1px solid var(--color-danger, #ffccc7)',
          borderRadius: 8,
          color: 'var(--color-danger, #cf1322)',
          fontFamily: 'monospace',
          fontSize: 13,
        },
      },
        createElement('div', { style: { fontWeight: 600, marginBottom: 8, fontSize: 15 } }, '⚠ 页面渲染出错'),
        createElement('div', { style: { color: 'var(--color-text-secondary, #595959)', marginBottom: 8 } }, '页面组件在渲染时发生异常，请检查 schema 结构或联系开发者。'),
        createElement('pre', { style: { margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--color-danger, #cf1322)' } }, String(this.state.error)),
      );
    }
    return this.props.children;
  }
}

interface FormRuntimeBinderProps {
  Comp: any;
  resolvedProps: Record<string, any>;
  children: ReactNode;
  nodeId?: string;
  runtime: ShenbiContextValue['runtime'];
}

function FormRuntimeBinder({
  Comp,
  resolvedProps,
  children,
  nodeId,
  runtime,
}: FormRuntimeBinderProps): ReactElement {
  const useFormFn = (Comp as { useForm?: () => any[] }).useForm;
  const providedForm = resolvedProps.form;
  const generatedForm = useFormFn ? useFormFn()[0] : undefined;
  const form = providedForm ?? generatedForm;
  const prevInitialValuesRef = useRef<any>(undefined);
  const initialValues = resolvedProps.initialValues;

  useEffect(() => {
    if (!nodeId || !form) {
      return;
    }
    runtime.registerRef(nodeId, form);
    return () => {
      runtime.registerRef(nodeId, null);
    };
  }, [form, nodeId, runtime]);

  useEffect(() => {
    if (!form?.setFieldsValue) {
      return;
    }
    if (initialValues == null) {
      prevInitialValuesRef.current = initialValues;
      return;
    }
    if (Object.is(prevInitialValuesRef.current, initialValues)) {
      return;
    }
    form.setFieldsValue(initialValues);
    prevInitialValuesRef.current = initialValues;
  }, [form, initialValues]);

  return createElement(Comp, { ...resolvedProps, form }, children);
}

// ===== NodeRenderer =====

export interface NodeRendererProps {
  node: CompiledNode;
  extraContext?: Record<string, any> | undefined;
  [key: string]: any;
}

function evalExpr(compiled: CompiledExpression | undefined, ctx: ExpressionContext): any {
  if (!compiled) return undefined;
  return compiled.fn(ctx);
}

/** 递归渲染子节点的快捷方法 */
function renderChild(
  child: CompiledNode,
  key: string | number,
  extra?: Record<string, any>,
) {
  return createElement(NodeRenderer, { key, node: child, extraContext: extra });
}

export function NodeRenderer({ node, extraContext, ...injectedProps }: NodeRendererProps): ReactElement | null {
  const { runtime, resolver, getPopupContainer } = useShenbi();
  const ctx: ExpressionContext = runtime.getContext(extraContext);

  // Step 2: 权限检查
  if (node.permission) {
    // 阶段 1 简单实现：检查 state.__permissions 中是否包含该权限
    const permissions = ctx.state.__permissions as string[] | undefined;
    if (permissions && !permissions.includes(node.permission)) {
      return null;
    }
  }

  // Step 3: loop 展开
  if (node.loop) {
    const dataArr = evalExpr(node.loop.dataFn, ctx);
    if (!Array.isArray(dataArr)) return null;
    const elements = dataArr.map((item: any, index: number) => {
      const loopCtx: Record<string, any> = {
        ...extraContext,
        [node.loop!.itemKey]: item,
        [node.loop!.indexKey]: index,
      };
      const itemCtx: ExpressionContext = runtime.getContext(loopCtx);
      if (node.ifFn && !evalExpr(node.ifFn, itemCtx)) {
        return null;
      }
      const key = evalExpr(node.loop!.keyFn, itemCtx) ?? index;
      return renderChild(node.loop!.body, key, loopCtx);
    });
    return createElement(Fragment, null, ...elements);
  }

  // Step 1: if 条件（非 loop 节点）
  if (node.ifFn) {
    const ifResult = evalExpr(node.ifFn, ctx);
    if (!ifResult) return null;
  }

  // Resolve component
  const Comp = node.Component ?? resolver.resolve(node.componentType);
  if (Comp === null || Comp === undefined) {
    return createElement('div', {
      style: { color: 'red', border: '1px solid red', padding: 8 },
    }, `未知组件: ${node.componentType}`);
  }

  // Step 4+5: 解析 dynamicProps + 合并 staticProps
  const resolvedProps: Record<string, any> = { ...node.staticProps };
  for (const [key, expr] of Object.entries(node.dynamicProps)) {
    resolvedProps[key] = evalExpr(expr, ctx);
  }
  Object.assign(resolvedProps, injectedProps);

  // Step 6: 绑定 events
  if (node.events) {
    for (const [eventName, chain] of Object.entries(node.events)) {
      const handler = (...args: any[]) => {
        const eventData = args.length > 1 ? args : args[0];
        void runtime.executeActions(chain, eventData, extraContext).catch((error) => {
          console.error('[shenbi] executeActions failed', error);
        });
      };
      if (eventName.includes('.')) {
        setByPathMutable(resolvedProps, eventName, handler);
      } else {
        const existing = resolvedProps[eventName];
        if (typeof existing === 'function') {
          resolvedProps[eventName] = (...args: any[]) => {
            existing(...args);
            handler(...args);
          };
        } else {
          resolvedProps[eventName] = handler;
        }
      }
    }
  }

  // Step 7: style / className
  if (node.style) {
    resolvedProps.style = typeof (node.style as any).fn === 'function'
      ? evalExpr(node.style as CompiledExpression, ctx)
      : node.style;
  }
  if (node.className) {
    resolvedProps.className = typeof (node.className as any).fn === 'function'
      ? evalExpr(node.className as CompiledExpression, ctx)
      : node.className;
  }

  // 为编辑器画布提供可点击选中能力
  if (node.id && Comp !== Fragment) {
    resolvedProps['data-shenbi-node-id'] = node.id;
    resolvedProps['data-shenbi-component-type'] = node.componentType;
  }

  // 强制 Modal/Drawer 不使用 Portal，直接在当前 DOM 位置渲染（即页面容器内），
  // 而非默认挂载到 <body>。getContainer={false} 是 Ant Design 的标准用法。
  if (OVERLAY_COMPONENTS.has(node.componentType)) {
    resolvedProps.getContainer = false;

    // 自动注入关闭回调：如果 open 绑定了 state 表达式且没有 onClose/onCancel，
    // 则自动生成一个将对应 state 设为 false 的处理器。
    const isDrawer = node.componentType === 'Drawer';
    const closeEvent = isDrawer ? 'onClose' : 'onCancel';
    if (typeof resolvedProps[closeEvent] !== 'function') {
      const openExpr = node.dynamicProps.open;
      if (openExpr && openExpr.deps.length > 0) {
        // deps 形如 ['state.drawerVisible']，取第一个并去掉 'state.' 前缀
        const dep = openExpr.deps[0];
        if (dep) {
          const stateKey = dep.startsWith('state.') ? dep.slice(6) : dep;
          resolvedProps[closeEvent] = () => {
            runtime.dispatch({ type: 'SET', key: stateKey, value: false });
          };
        }
      } else if (node.id) {
        // open 是静态值（如 true）且没有 onClose/onCancel：
        // 使用节点 ID 自动生成 state key，让 Drawer/Modal 可以关闭。
        const autoKey = `__overlay_${node.id}`;
        // 用 state 覆写 open：state 为 undefined 时保留原始静态值，state 为 false 时关闭
        if (runtime.state[autoKey] === false) {
          resolvedProps.open = false;
        }
        resolvedProps[closeEvent] = () => {
          runtime.dispatch({ type: 'SET', key: autoKey, value: false });
        };
      }
    }
  }

  // Step 8: show 条件
  if (node.showFn) {
    const showResult = evalExpr(node.showFn, ctx);
    if (!showResult) {
      resolvedProps.style = { ...resolvedProps.style, display: 'none' };
    }
  }

  // ref 绑定 (React 19: ref 是普通 prop)
  if (node.id && Comp !== Fragment && node.componentType !== 'Form') {
    resolvedProps.ref = (el: any) => {
      runtime.registerRef(node.id!, el);
    };
  }

  // Step 9: slots
  if (node.compiledSlots) {
    for (const [slotName, slotNode] of Object.entries(node.compiledSlots)) {
      if (Array.isArray(slotNode)) {
        resolvedProps[slotName] = slotNode.map((s, i) => renderChild(s, i, extraContext));
      } else {
        resolvedProps[slotName] = renderChild(slotNode, slotName, extraContext);
      }
    }
  }

  if (node.compiledPropNodes) {
    for (const [propName, propNode] of Object.entries(node.compiledPropNodes)) {
      if (Array.isArray(propNode)) {
        resolvedProps[propName] = propNode.map((child, index) => renderChild(child, `${propName}_${index}`, extraContext));
      } else {
        resolvedProps[propName] = renderChild(propNode, propName, extraContext);
      }
    }
  }

  // Step 10: columns
  if (node.compiledColumns) {
    const rowKey = resolvedProps.rowKey ?? 'key';
    const editingKey = resolvedProps.editable?.editingKey;

    const resolveRowId = (record: any, index: number) => {
      if (typeof rowKey === 'function') {
        return rowKey(record, index);
      }
      return record?.[rowKey];
    };

    resolvedProps.columns = node.compiledColumns
      .filter((col) => !col.ifFn || evalExpr(col.ifFn, ctx))
      .map((col: CompiledColumn) => {
        const colConfig: Record<string, any> = { ...col.config };
        if (col.dynamicConfig) {
          for (const [key, expr] of Object.entries(col.dynamicConfig)) {
            colConfig[key] = evalExpr(expr, ctx);
          }
        }
        if (col.compiledRender || col.compiledEditRender) {
          const renderNode = col.compiledRender;
          const editRenderNode = col.compiledEditRender;
          colConfig.render = (text: any, record: any, index: number) => {
            const rowId = resolveRowId(record, index);
            const useEditRender = editRenderNode != null
              && editingKey != null
              && Object.is(rowId, editingKey);
            const renderTarget = useEditRender
              ? editRenderNode
              : renderNode;

            if (!renderTarget) {
              return text;
            }

            return renderChild(renderTarget, `col_${index}`, {
              ...extraContext,
              text,
              record,
              index,
            });
          };
        }
        return colConfig;
      });
  }

  // Step 10.5: Items-based 组件特殊处理
  // Ant Design 的部分容器组件（Descriptions, Timeline, Tabs 等）会通过 useItems / useLegacyItems
  // 内部使用 {...node.props} 从 JSX children 中提取 item 数据。当 children 是 NodeRenderer
  // 包装器时，node.props 是 { node: compiledNode } 而非预期的 { label, children, ... }，
  // 导致 label/children 全部丢失。
  // 修复：将 compiledChildren 转换为 items prop 格式，绕过 JSX children 路径。
  const isItemsBased = ITEMS_BASED_COMPONENTS.has(node.componentType);
  if (isItemsBased && node.compiledChildren && node.compiledChildren.length > 0) {
    const items = node.compiledChildren.map((itemNode, i) => {
      // 解析子节点的全部 props
      const resolvedItemProps: Record<string, any> = { ...itemNode.staticProps };
      for (const [propKey, propExpr] of Object.entries(itemNode.dynamicProps)) {
        resolvedItemProps[propKey] = evalExpr(propExpr, ctx);
      }

      // compiledPropNodes（如 label 是一个 SchemaNode）
      if (itemNode.compiledPropNodes) {
        for (const [propName, propNode] of Object.entries(itemNode.compiledPropNodes)) {
          if (Array.isArray(propNode)) {
            resolvedItemProps[propName] = propNode.map((child, idx) =>
              renderChild(child, `${propName}_${idx}`, extraContext),
            );
          } else {
            resolvedItemProps[propName] = renderChild(propNode, propName, extraContext);
          }
        }
      }

      // 解析 children (value/content)
      let itemChildren: ReactNode = resolvedItemProps.children;
      if (itemNode.childrenFn) {
        itemChildren = evalExpr(itemNode.childrenFn, ctx);
      } else if (itemNode.compiledChildren && itemNode.compiledChildren.length > 0) {
        itemChildren = itemNode.compiledChildren.map((child, idx) =>
          renderChild(child, child.id ?? idx, extraContext),
        );
      }
      resolvedItemProps.children = itemChildren;

      // 确保有 key
      resolvedItemProps.key = resolvedItemProps.key ?? itemNode.id ?? `item-${i}`;

      return resolvedItemProps;
    });

    resolvedProps.items = items;
  }

  // Step 10.6: Sanitize pre-existing items on items-based components.
  // When the LLM places schema-like objects directly in props.items (e.g.
  // Timeline items with children: [{component: "Typography.Text", ...}]),
  // React will crash with "Objects are not valid as a React child".
  // Fix: detect and convert schema-like children to rendered ReactElements.
  if (isItemsBased && Array.isArray(resolvedProps.items)) {
    resolvedProps.items = resolvedProps.items.map((item: any, i: number) => {
      if (!item || typeof item !== 'object') return item;
      // Check if item.children contains schema-like objects
      if (Array.isArray(item.children)) {
        const hasSchemaNodes = item.children.some(
          (c: any) => c && typeof c === 'object' && typeof c.component === 'string',
        );
        if (hasSchemaNodes) {
          return {
            ...item,
            key: item.key ?? item.id ?? `item-${i}`,
            children: item.children.map((c: any, j: number) => {
              if (c && typeof c === 'object' && typeof c.component === 'string') {
                // This is a schema node in the items — render as a simple element
                const Comp = resolver.resolve(c.component);
                if (Comp) {
                  const itemChildren = Array.isArray(c.children)
                    ? c.children.map((gc: any) =>
                      gc && typeof gc === 'object' && typeof gc.component === 'string'
                        ? createElement(resolver.resolve(gc.component) ?? Fragment, { key: gc.id ?? j, ...gc.props }, ...(Array.isArray(gc.children) ? gc.children.filter((x: any) => typeof x === 'string') : typeof gc.children === 'string' ? [gc.children] : []))
                        : gc,
                    )
                    : typeof c.children === 'string' ? [c.children] : [];
                  return createElement(Comp, { key: c.id ?? `schema-item-${i}-${j}`, ...c.props }, ...itemChildren);
                }
              }
              return c;
            }),
          };
        }
      }
      return item;
    });
  }

  // Step 11: children
  let children: ReactNode = resolvedProps.children;
  if (node.childrenFn) {
    children = evalExpr(node.childrenFn, ctx);
  } else if (node.compiledChildren && node.compiledChildren.length > 0
    && !isItemsBased) {
    children = node.compiledChildren.map((child, i) =>
      renderChild(child, child.id ?? i, extraContext),
    );
  }

  // Step 12: 错误边界
  let element = node.componentType === 'Form'
    ? createElement(
      FormRuntimeBinder,
      node.id
        ? {
          Comp,
          resolvedProps,
          children,
          nodeId: node.id,
          runtime,
        }
        : {
          Comp,
          resolvedProps,
          children,
          runtime,
        },
    )
    : createElement(Comp, resolvedProps, children);
  if (node.errorBoundary) {
    element = createElement(
      ErrorBoundary,
      { fallback: node.errorBoundary.fallback, extraContext },
      element,
    );
  }

  // Step 13: return
  return element;
}
