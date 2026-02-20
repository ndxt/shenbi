import { createElement, useMemo, type ReactElement } from 'react';
import type { PageSchema } from '@shenbi/schema';
import type { ComponentResolver, PageRuntime, CompiledNode } from '../types/contracts';
import { ShenbiContext, NodeRenderer } from './node-renderer';

export interface ShenbiPageProps {
  schema: PageSchema;
  resolver: ComponentResolver;
  runtime: PageRuntime;
  compiledBody: CompiledNode | CompiledNode[];
  compiledDialogs?: CompiledNode[];
}

export function ShenbiPage({
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

  const dialogElements = compiledDialogs?.map((dialog, i) => {
    const dialogId = dialog.id ?? `dialog_${i}`;
    const isOpen = runtime.state[`__dialog_${dialogId}`] === true;
    const payload = runtime.dialogPayloads[dialogId];

    if (!isOpen) return null;

    return createElement(NodeRenderer, {
      key: dialogId,
      node: dialog,
      extraContext: { dialogPayload: payload },
    });
  });

  // React 19: 直接用 <ShenbiContext> 作为 Provider
  return createElement(
    ShenbiContext,
    { value: contextValue },
    bodyElements,
    dialogElements,
  );
}
