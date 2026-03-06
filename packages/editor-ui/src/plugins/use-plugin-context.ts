import { useEffect, useMemo, useRef } from 'react';
import type { PageSchema, SchemaNode } from '@shenbi/schema';
import type {
  PluginContext,
  PluginDocumentPatchService,
  PluginNotifications,
} from '@shenbi/editor-plugin-api';

export interface UsePluginContextOptions {
  schema: PageSchema;
  selectedNode: SchemaNode | undefined;
  selectedNodeId: string | undefined;
  replaceSchema: (schema: PageSchema) => void;
  patchSelectedNode: PluginDocumentPatchService;
  executeCommand: (commandId: string, payload?: unknown) => unknown | Promise<unknown>;
  notifications?: PluginNotifications;
}

export function usePluginContext(options: UsePluginContextOptions): PluginContext {
  const activeSchemaRef = useRef(options.schema);
  const selectedNodeRef = useRef(options.selectedNode);
  const selectedNodeIdRef = useRef(options.selectedNodeId);
  const documentListenersRef = useRef(new Set<(schema: PageSchema) => void>());
  const selectionListenersRef = useRef(new Set<(nodeId: string | undefined) => void>());

  useEffect(() => {
    activeSchemaRef.current = options.schema;
    for (const listener of documentListenersRef.current) {
      listener(options.schema);
    }
  }, [options.schema]);

  useEffect(() => {
    selectedNodeRef.current = options.selectedNode;
    selectedNodeIdRef.current = options.selectedNodeId;
    for (const listener of selectionListenersRef.current) {
      listener(options.selectedNodeId);
    }
  }, [options.selectedNode, options.selectedNodeId]);

  return useMemo<PluginContext>(() => ({
    document: {
      getSchema: () => activeSchemaRef.current,
      replaceSchema: options.replaceSchema,
      patchSelectedNode: options.patchSelectedNode,
      subscribe: (listener) => {
        documentListenersRef.current.add(listener);
        listener(activeSchemaRef.current);
        return () => {
          documentListenersRef.current.delete(listener);
        };
      },
    },
    selection: {
      getSelectedNode: () => selectedNodeRef.current,
      getSelectedNodeId: () => selectedNodeIdRef.current,
      subscribe: (listener) => {
        selectionListenersRef.current.add(listener);
        listener(selectedNodeIdRef.current);
        return () => {
          selectionListenersRef.current.delete(listener);
        };
      },
    },
    commands: {
      execute: options.executeCommand,
    },
    ...(options.notifications ? { notifications: options.notifications } : {}),
  }), [options.executeCommand, options.notifications, options.patchSelectedNode, options.replaceSchema]);
}
