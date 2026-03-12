import { createElement, useMemo, useRef, useCallback, type ReactElement } from 'react';
import type { PageSchema } from '@shenbi/schema';
import type { ComponentResolver, PageRuntime, CompiledNode } from '../types/contracts';
import { compileSchema } from '../compiler/schema';
import { ShenbiContext, NodeRenderer, PageErrorBoundary } from './node-renderer';

export interface ShenbiPageProps {
  schema: PageSchema;
  resolver: ComponentResolver;
  runtime: PageRuntime;
  compiledBody: CompiledNode | CompiledNode[];
  compiledDialogs?: CompiledNode[];
}

export function ShenbiPage({
  schema,
  resolver,
  runtime,
  compiledBody,
  compiledDialogs,
}: ShenbiPageProps): ReactElement | null {
  const containerRef = useRef<HTMLDivElement>(null);

  const getPopupContainer = useCallback((): HTMLElement => {
    return containerRef.current ?? document.body;
  }, []);

  const contextValue = useMemo(
    () => ({ runtime, resolver, getPopupContainer }),
    [runtime, resolver, getPopupContainer],
  );

  const bodyElements = Array.isArray(compiledBody)
    ? compiledBody.map((node, i) =>
      createElement(NodeRenderer, { key: node.id ?? i, node }),
    )
    : createElement(NodeRenderer, { node: compiledBody });

  const resolvedDialogs = useMemo<CompiledNode[] | undefined>(() => {
    if (compiledDialogs && compiledDialogs.length > 0) {
      return compiledDialogs;
    }
    if (!schema.dialogs || schema.dialogs.length === 0) {
      return undefined;
    }
    return compileSchema(schema.dialogs, resolver) as CompiledNode[];
  }, [compiledDialogs, resolver, schema.dialogs]);

  const dialogElements = resolvedDialogs?.map((dialog, i) => {
    const dialogId = dialog.id ?? `dialog_${i}`;
    const isDrawer = dialog.componentType === 'Drawer';
    const visibleKey = isDrawer ? `__drawer_${dialogId}` : `__dialog_${dialogId}`;
    const isOpen = runtime.state[visibleKey] === true;
    const payload = runtime.dialogPayloads[dialogId];

    debugger;

    // 始终渲染，通过 open 状态控制显隐，让 Ant Design 处理开关动画和遮罩交互
    return createElement(NodeRenderer, {
      key: dialogId,
      node: dialog,
      extraContext: { dialogPayload: payload, dialogId },
      open: isOpen,
      ...(isDrawer
        ? { onClose: () => { debugger; runtime.dispatch({ type: 'SET', key: visibleKey, value: false }) } }
        : { onCancel: () => { debugger; runtime.dispatch({ type: 'SET', key: visibleKey, value: false }) } }),
    });
  });

  // 页面根容器：position: relative 使浮层能够正确相对于页面定位
  const containerStyle = { position: 'relative' as const, height: '100%' };

  // React 19: 直接用 <ShenbiContext> 作为 Provider
  return createElement(
    PageErrorBoundary,
    null,
    createElement(
      ShenbiContext,
      { value: contextValue },
      createElement(
        'div',
        { ref: containerRef, style: containerStyle, 'data-shenbi-page-root': true },
        bodyElements,
        dialogElements,
      ),
    ),
  );
}
