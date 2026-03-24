// ---------------------------------------------------------------------------
// useCanvasDocumentContext — bridges canvas-renderer document lifecycle
// to the host editor shell (dirty tracking, save, undo/redo dispatch).
//
// Internally backed by RendererDocumentProvider (DocumentProvider interface),
// while exposing the legacy CanvasRendererDocumentContext for backward compat.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { RendererDocumentProvider } from '@shenbi/editor-core';
import type { CanvasRendererDocumentContext } from '@shenbi/editor-plugin-api';
import type { DocumentProvider } from '@shenbi/editor-core';

/**
 * Host-side hook that creates a `CanvasRendererDocumentContext` for canvas
 * renderers that manage their own document state (e.g. Gateway editor).
 *
 * The returned `context` is passed to the renderer via
 * `CanvasRendererRenderContext.document`. Call the returned `dispatch.*`
 * helpers from the host when the user triggers Ctrl+S / Ctrl+Z / Ctrl+Y.
 *
 * Also exposes the underlying `DocumentProvider` for new code that wants
 * the standard interface.
 */
export function useCanvasDocumentContext(options: {
  fileId?: string | undefined;
  fileType?: string | undefined;
  onDirtyChange: (dirty: boolean) => void;
  onSchemaChange?: ((schema: Record<string, unknown>) => void) | undefined;
  onUndoRedoStateChange: (state: { canUndo: boolean; canRedo: boolean }) => void;
}): {
  context: CanvasRendererDocumentContext;
  dispatch: {
    save: () => void;
    undo: () => void;
    redo: () => void;
  };
  provider: DocumentProvider;
} {
  const providerRef = useRef<RendererDocumentProvider | null>(null);
  if (!providerRef.current) {
    providerRef.current = new RendererDocumentProvider({
      fileId: options.fileId ?? '',
      fileType: (options.fileType ?? 'api') as 'page' | 'api',
    });
  }
  const provider = providerRef.current;

  const onDirtyChangeRef = useRef(options.onDirtyChange);
  onDirtyChangeRef.current = options.onDirtyChange;
  const onSchemaChangeRef = useRef(options.onSchemaChange);
  onSchemaChangeRef.current = options.onSchemaChange;
  const onUndoRedoStateChangeRef = useRef(options.onUndoRedoStateChange);
  onUndoRedoStateChangeRef.current = options.onUndoRedoStateChange;

  // Subscribe to provider state changes and forward to host callbacks
  useEffect(() => {
    return provider.subscribe((state) => {
      onDirtyChangeRef.current(state.isDirty);
      onUndoRedoStateChangeRef.current({ canUndo: state.canUndo, canRedo: state.canRedo });
    });
  }, [provider]);

  const markDirty = useCallback((dirty: boolean) => {
    provider.reportDirty(dirty);
  }, [provider]);

  const replaceDocument = useCallback((schema: Record<string, unknown>) => {
    provider.reportDocument(schema);
    onSchemaChangeRef.current?.(schema);
  }, [provider]);

  const getDocument = useCallback(() => {
    return provider.getDocument() as Record<string, unknown> | undefined;
  }, [provider]);

  const onSaveRequest = useCallback((callback: () => void) => {
    return provider.onSaveRequest(callback);
  }, [provider]);

  const onUndoRequest = useCallback((callback: () => void) => {
    return provider.onUndoRequest(callback);
  }, [provider]);

  const onRedoRequest = useCallback((callback: () => void) => {
    return provider.onRedoRequest(callback);
  }, [provider]);

  const reportUndoRedoState = useCallback((state: { canUndo: boolean; canRedo: boolean }) => {
    provider.reportUndoRedoState(state);
  }, [provider]);

  const context = useMemo<CanvasRendererDocumentContext>(() => ({
    markDirty,
    getDocument,
    replaceDocument,
    syncSchema: replaceDocument,
    onSaveRequest,
    onUndoRequest,
    onRedoRequest,
    reportUndoRedoState,
  }), [getDocument, markDirty, onSaveRequest, onUndoRequest, onRedoRequest, replaceDocument, reportUndoRedoState]);

  const dispatch = useMemo(() => ({
    save: () => provider.save(),
    undo: () => provider.undo(),
    redo: () => provider.redo(),
  }), [provider]);

  return { context, dispatch, provider };
}
