import { useEffect, useMemo, useRef } from 'react';
import type { ComponentContract, PageSchema } from '@shenbi/schema';
import {
  createEditorAIBridge,
  type EditorAIBridge,
  type EditorBridgeSnapshot,
} from './editor-ai-bridge';

export interface UseEditorAIBridgeOptions {
  schema: PageSchema;
  selectedNodeId?: string;
  replaceSchema: (schema: PageSchema) => void;
  getAvailableComponents: () => ComponentContract[];
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
    subscribe: (listener) => {
      listenersRef.current.add(listener);
      listener(snapshotRef.current);
      return () => {
        listenersRef.current.delete(listener);
      };
    },
  }), [options.getAvailableComponents, options.replaceSchema]);
}
