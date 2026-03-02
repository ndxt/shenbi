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
          colConfig.render = (text: any, record: any, index: number) =>
          {
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
