import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type { CanvasRendererHostRuntime, CanvasRendererDocumentContext } from '@shenbi/editor-plugin-api';
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
import { useGatewayHistory } from '../hooks/useGatewayHistory';

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
  /** Document lifecycle context from the host (save/undo/dirty) */
  documentContext?: CanvasRendererDocumentContext | undefined;
}

export function GatewayEditor({
  documentSchema,
  onDirty,
  onSave,
  hostAdapter,
  activeCanvasTool,
  setActiveCanvasTool,
  onCanvasRuntimeReady,
  documentContext,
}: GatewayEditorProps) {
  const fallbackDocument = useMemo(() => (
    createDefaultGatewayDocument(
      hostAdapter?.fileId ?? documentSchema?.id ?? 'gateway',
      hostAdapter?.fileName ?? documentSchema?.name ?? 'API Workflow',
    )
  ), [documentSchema?.id, documentSchema?.name, hostAdapter?.fileId, hostAdapter?.fileName]);

  // History integration
  const history = useGatewayHistory(documentSchema ?? fallbackDocument);

  const initialGraph = useMemo(
    () => gatewayDocumentToGraph(history.document),
    // Only recompute when history.document identity changes (undo/redo/reset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history.document],
  );
  const [nodes, setNodes] = useState(initialGraph.nodes);
  const [edges, setEdges] = useState(initialGraph.edges);
  const [viewport, setViewport] = useState(initialGraph.viewport);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hostAdapterRef = useRef(hostAdapter);

  useEffect(() => {
    hostAdapterRef.current = hostAdapter;
  }, [hostAdapter]);

  // Sync graph state when history.document changes (undo/redo/reset)
  const prevDocumentRef = useRef(history.document);
  useEffect(() => {
    if (history.document !== prevDocumentRef.current) {
      prevDocumentRef.current = history.document;
      const graph = gatewayDocumentToGraph(history.document);
      setNodes(graph.nodes);
      setEdges(graph.edges);
      setViewport(graph.viewport);
    }
  }, [history.document]);

  // Load document from host adapter on mount / file change
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
          history.reset(fallbackDocument);
          return;
        }
        history.reset(loaded);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallbackDocument, hostAdapter?.fileId, hostAdapter?.fileName]);

  // Cleanup save timer
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

  // --- Keyboard shortcuts (Ctrl+Z/Y/S) ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCtrlOrMeta = event.ctrlKey || event.metaKey;
      if (!isCtrlOrMeta) return;

      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        history.undo();
      } else if (event.key === 'z' && event.shiftKey) {
        event.preventDefault();
        history.redo();
      } else if (event.key === 'y') {
        event.preventDefault();
        history.redo();
      } else if (event.key === 's') {
        event.preventDefault();
        const doc = history.document;
        if (hostAdapter) {
          void hostAdapter.saveDocument(doc).then(() => {
            history.markSaved();
          }).catch((error) => {
            hostAdapter.notifyError(
              error instanceof Error ? error.message : 'Failed to save',
            );
          });
        }
        onSave?.(doc);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [history, hostAdapter, onSave]);

  // --- Document lifecycle: wire to host context ---

  // Report dirty state to host
  useEffect(() => {
    documentContext?.markDirty(history.isDirty);
  }, [documentContext, history.isDirty]);

  // Report undo/redo state to host
  useEffect(() => {
    documentContext?.reportUndoRedoState({
      canUndo: history.canUndo,
      canRedo: history.canRedo,
    });
  }, [documentContext, history.canUndo, history.canRedo]);

  // Register save callback
  useEffect(() => {
    if (!documentContext) return undefined;
    return documentContext.onSaveRequest(() => {
      // Explicit save: write current document to file system
      const doc = history.document;
      if (hostAdapter) {
        void hostAdapter.saveDocument(doc).then(() => {
          history.markSaved();
        }).catch((error) => {
          hostAdapter.notifyError(
            error instanceof Error ? error.message : 'Failed to save',
          );
        });
      }
      onSave?.(doc);
    });
  }, [documentContext, history, hostAdapter, onSave]);

  // Register undo callback
  useEffect(() => {
    if (!documentContext) return undefined;
    return documentContext.onUndoRequest(() => {
      history.undo();
    });
  }, [documentContext, history]);

  // Register redo callback
  useEffect(() => {
    if (!documentContext) return undefined;
    return documentContext.onRedoRequest(() => {
      history.redo();
    });
  }, [documentContext, history]);

  // --- Persistence (debounced auto-save + history push) ---

  const persistDocument = useCallback((nextDocument: GatewayDocumentSchema) => {
    // Push to history (creates undo point + marks dirty)
    history.pushState(nextDocument);
    onDirty?.();
    onSave?.(nextDocument);

    // Debounced auto-save to file system
    if (!hostAdapter) {
      return;
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      void hostAdapter.saveDocument(nextDocument)
        .then(() => {
          history.markSaved();
        })
        .catch((error) => {
          hostAdapter.notifyError(
            error instanceof Error
              ? error.message
              : 'Failed to save gateway document',
          );
        });
      saveTimerRef.current = null;
    }, 800);
  }, [hostAdapter, onSave, onDirty, history]);

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
