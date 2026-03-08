import { createElement, useMemo, type ReactElement } from 'react';
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
  const contextValue = useMemo(
    () => ({ runtime, resolver }),
    [runtime, resolver],
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

    if (!isOpen) return null;

    return createElement(NodeRenderer, {
      key: dialogId,
      node: dialog,
      extraContext: { dialogPayload: payload, dialogId },
    });
  });

  // React 19: 直接用 <ShenbiContext> 作为 Provider
  return createElement(
    PageErrorBoundary,
    null,
    createElement(
      ShenbiContext,
      { value: contextValue },
      bodyElements,
      dialogElements,
    ),
  );
}
