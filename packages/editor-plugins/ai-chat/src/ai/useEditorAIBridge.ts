import { useEffect, useMemo, useRef } from 'react';
import type { ComponentContract, PageSchema } from '@shenbi/schema';
import {
  createEditorAIBridge,
  type EditorAIBridge,
  type EditorBridgeSnapshot,
} from './editor-ai-bridge';

export interface UseEditorAIBridgeOptions {
  schema: PageSchema;
  selectedNodeId?: string | undefined;
  replaceSchema: (schema: PageSchema) => void;
  getAvailableComponents: () => ComponentContract[];
  execute?: ((commandId: string, args?: unknown) => Promise<{ success: boolean; error?: string }>) | undefined;
}

export function useEditorAIBridge(options: UseEditorAIBridgeOptions): EditorAIBridge {
  const listenersRef = useRef(new Set<(snapshot: EditorBridgeSnapshot) => void>());
  const snapshotRef = useRef<EditorBridgeSnapshot>({
    schema: options.schema,
    ...(options.selectedNodeId ? { selectedNodeId: options.selectedNodeId } : {}),
  });

  useEffect(() => {
    const nextSnapshot: EditorBridgeSnapshot = {
      schema: options.schema,
      ...(options.selectedNodeId ? { selectedNodeId: options.selectedNodeId } : {}),
    };
    snapshotRef.current = nextSnapshot;
    for (const listener of listenersRef.current) {
      listener(nextSnapshot);
    }
  }, [options.schema, options.selectedNodeId]);

  return useMemo(() => createEditorAIBridge({
    getSnapshot: () => snapshotRef.current,
    replaceSchema: options.replaceSchema,
    getAvailableComponents: options.getAvailableComponents,
    execute: options.execute ?? (async (cmd, args) => {
      if (cmd === 'schema.replace') {
        options.replaceSchema((args as any).schema);
        return { success: true };
      }
      return { success: false, error: 'Command not supported in standalone useEditorAIBridge' };
    }),
    subscribe: (listener) => {
      listenersRef.current.add(listener);
      listener(snapshotRef.current);
      return () => {
        listenersRef.current.delete(listener);
      };
    },
  }), [options.getAvailableComponents, options.replaceSchema]);
}
