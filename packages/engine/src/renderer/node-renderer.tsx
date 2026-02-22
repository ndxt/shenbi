import {
  createElement,
  Fragment,
  type ReactElement,
  type ReactNode,
  Component,
  createContext,
  useContext,
} from 'react';
import type { ExpressionContext } from '@shenbi/schema';
import type {
  CompiledNode,
  CompiledColumn,
  ShenbiContextValue,
  CompiledExpression,
} from '../types/contracts';

// ===== Context =====

export const ShenbiContext = createContext<ShenbiContextValue | null>(null);

export function useShenbi(): ShenbiContextValue {
  const ctx = useContext(ShenbiContext);
  if (!ctx) {
    throw new Error('useShenbi must be used within <ShenbiContext>');
  }
  return ctx;
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

// ===== NodeRenderer =====

export interface NodeRendererProps {
  node: CompiledNode;
  extraContext?: Record<string, any> | undefined;
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

export function NodeRenderer({ node, extraContext }: NodeRendererProps): ReactElement | null {
  const { runtime, resolver } = useShenbi();
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

  // Step 6: 绑定 events
  if (node.events) {
    for (const [eventName, chain] of Object.entries(node.events)) {
      resolvedProps[eventName] = (...args: any[]) => {
        runtime.executeActions(chain, args[0]);
      };
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

  // Step 8: show 条件
  if (node.showFn) {
    const showResult = evalExpr(node.showFn, ctx);
    if (!showResult) {
      resolvedProps.style = { ...resolvedProps.style, display: 'none' };
    }
  }

  // ref 绑定 (React 19: ref 是普通 prop)
  if (node.id && Comp !== Fragment) {
    resolvedProps.ref = (el: any) => {
      if (el) runtime.registerRef(node.id!, el);
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

  // Step 10: columns
  if (node.compiledColumns) {
    resolvedProps.columns = node.compiledColumns
      .filter((col) => !col.ifFn || evalExpr(col.ifFn, ctx))
      .map((col: CompiledColumn) => {
        const colConfig: Record<string, any> = { ...col.config };
        if (col.compiledRender) {
          const renderNode = col.compiledRender;
          colConfig.render = (text: any, record: any, index: number) =>
            renderChild(renderNode, `col_${index}`, { ...extraContext, text, record, index });
        }
        return colConfig;
      });
  }

  // Step 11: children
  let children: ReactNode = resolvedProps.children;
  if (node.childrenFn) {
    children = evalExpr(node.childrenFn, ctx);
  } else if (node.compiledChildren && node.compiledChildren.length > 0) {
    children = node.compiledChildren.map((child, i) =>
      renderChild(child, child.id ?? i, extraContext),
    );
  }

  // Step 12: 错误边界
  let element = createElement(Comp, resolvedProps, children);
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
