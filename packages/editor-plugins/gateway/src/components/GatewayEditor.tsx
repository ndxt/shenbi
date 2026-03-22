import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type { CanvasRendererHostRuntime } from '@shenbi/editor-plugin-api';
import type { CanvasToolMode } from '@shenbi/editor-ui';
import { GatewayCanvas } from './GatewayCanvas';
import type {
  GatewayDocumentSchema,
} from '../types';
import {
  createDefaultGatewayDocument,
  gatewayDocumentToGraph,
  isGatewayDocumentSchema,
} from '../gateway-document';
import type { GatewayHostAdapter } from '../gateway-host-adapter';

export interface GatewayEditorProps {
  /** Document schema from .api.json (if existing file) */
  documentSchema?: GatewayDocumentSchema;
  /** Called when the gateway changes (for dirty tracking) */
  onDirty?: () => void;
  /** Called with updated document schema for persistence */
  onSave?: (schema: GatewayDocumentSchema) => void;
  hostAdapter?: GatewayHostAdapter;
  activeCanvasTool?: CanvasToolMode | undefined;
  setActiveCanvasTool?: ((mode: CanvasToolMode) => void) | undefined;
  onCanvasRuntimeReady?: ((runtime: CanvasRendererHostRuntime | null) => void) | undefined;
}

export function GatewayEditor({
  documentSchema,
  onDirty,
  onSave,
  hostAdapter,
  activeCanvasTool,
  setActiveCanvasTool,
  onCanvasRuntimeReady,
}: GatewayEditorProps) {
  const fallbackDocument = useMemo(() => (
    createDefaultGatewayDocument(
      hostAdapter?.fileId ?? documentSchema?.id ?? 'gateway',
      hostAdapter?.fileName ?? documentSchema?.name ?? 'API Workflow',
    )
  ), [documentSchema?.id, documentSchema?.name, hostAdapter?.fileId, hostAdapter?.fileName]);
  const initialGraph = useMemo(
    () => gatewayDocumentToGraph(documentSchema ?? fallbackDocument),
    [documentSchema, fallbackDocument],
  );
  const [nodes, setNodes] = useState(initialGraph.nodes);
  const [edges, setEdges] = useState(initialGraph.edges);
  const [viewport, setViewport] = useState(initialGraph.viewport);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hostAdapterRef = useRef(hostAdapter);

  useEffect(() => {
    hostAdapterRef.current = hostAdapter;
  }, [hostAdapter]);

  useEffect(() => {
    setNodes(initialGraph.nodes);
    setEdges(initialGraph.edges);
    setViewport(initialGraph.viewport);
  }, [initialGraph]);

  useEffect(() => {
    const activeHostAdapter = hostAdapterRef.current;
    if (!activeHostAdapter) {
      return undefined;
    }

    let disposed = false;
    void activeHostAdapter.loadDocument()
      .then((loaded) => {
        if (disposed) {
          return;
        }
        if (!loaded || !isGatewayDocumentSchema(loaded)) {
          const fallbackGraph = gatewayDocumentToGraph(fallbackDocument);
          setNodes(fallbackGraph.nodes);
          setEdges(fallbackGraph.edges);
          setViewport(fallbackGraph.viewport);
          return;
        }
        const nextGraph = gatewayDocumentToGraph(loaded);
        setNodes(nextGraph.nodes);
        setEdges(nextGraph.edges);
        setViewport(nextGraph.viewport);
      })
      .catch((error) => {
        if (disposed) {
          return;
        }
        activeHostAdapter.notifyError(
          error instanceof Error
            ? error.message
            : 'Failed to load gateway document',
        );
      });

    return () => {
      disposed = true;
    };
  }, [fallbackDocument, hostAdapter?.fileId, hostAdapter?.fileName]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!saveTimerRef.current) {
      return;
    }
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
  }, [hostAdapter?.fileId]);

  const persistDocument = useCallback((nextDocument: GatewayDocumentSchema) => {
    onSave?.(nextDocument);
    if (!hostAdapter) {
      return;
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      void hostAdapter.saveDocument(nextDocument).catch((error) => {
        hostAdapter.notifyError(
          error instanceof Error
            ? error.message
            : 'Failed to save gateway document',
        );
      });
      saveTimerRef.current = null;
    }, 150);
  }, [hostAdapter, onSave]);

  return (
    <ReactFlowProvider>
      <GatewayCanvas
        {...(hostAdapter ? {
          documentId: hostAdapter.fileId,
          documentName: hostAdapter.fileName,
        } : {
          documentId: documentSchema?.id ?? fallbackDocument.id,
          documentName: documentSchema?.name ?? fallbackDocument.name,
        })}
        {...(activeCanvasTool ? { activeCanvasTool } : {})}
        {...(setActiveCanvasTool ? { onActiveCanvasToolChange: setActiveCanvasTool } : {})}
        {...(onCanvasRuntimeReady ? { onCanvasRuntimeReady } : {})}
        nodes={nodes}
        edges={edges}
        onNodesChange={setNodes}
        onEdgesChange={setEdges}
        onDocumentChange={(nextDocument) => {
          setViewport(nextDocument.viewport);
          persistDocument(nextDocument);
        }}
        {...(onDirty ? { onDirty } : {})}
        {...(viewport ? { initialViewport: viewport } : {})}
      />
    </ReactFlowProvider>
  );
}
