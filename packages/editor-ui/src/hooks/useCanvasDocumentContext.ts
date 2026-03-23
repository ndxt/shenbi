// ---------------------------------------------------------------------------
// useCanvasDocumentContext — bridges canvas-renderer document lifecycle
// to the host editor shell (dirty tracking, save, undo/redo dispatch).
// ---------------------------------------------------------------------------

import { useCallback, useMemo, useRef } from 'react';
import type { CanvasRendererDocumentContext } from '@shenbi/editor-plugin-api';

type VoidCallback = () => void;

/**
 * Host-side hook that creates a `CanvasRendererDocumentContext` for canvas
 * renderers that manage their own document state (e.g. Gateway editor).
 *
 * The returned `context` is passed to the renderer via
 * `CanvasRendererRenderContext.document`. Call the returned `dispatch.*`
 * helpers from the host when the user triggers Ctrl+S / Ctrl+Z / Ctrl+Y.
 */
export function useCanvasDocumentContext(options: {
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
} {
  const saveCallbacksRef = useRef(new Set<VoidCallback>());
  const undoCallbacksRef = useRef(new Set<VoidCallback>());
  const redoCallbacksRef = useRef(new Set<VoidCallback>());
  const documentRef = useRef<Record<string, unknown> | undefined>(undefined);

  const onDirtyChangeRef = useRef(options.onDirtyChange);
  onDirtyChangeRef.current = options.onDirtyChange;
  const onSchemaChangeRef = useRef(options.onSchemaChange);
  onSchemaChangeRef.current = options.onSchemaChange;
  const onUndoRedoStateChangeRef = useRef(options.onUndoRedoStateChange);
  onUndoRedoStateChangeRef.current = options.onUndoRedoStateChange;

  const markDirty = useCallback((dirty: boolean) => {
    onDirtyChangeRef.current(dirty);
  }, []);

  const replaceDocument = useCallback((schema: Record<string, unknown>) => {
    documentRef.current = schema;
    onSchemaChangeRef.current?.(schema);
  }, []);

  const getDocument = useCallback(() => documentRef.current, []);

  const onSaveRequest = useCallback((callback: VoidCallback) => {
    saveCallbacksRef.current.add(callback);
    return () => { saveCallbacksRef.current.delete(callback); };
  }, []);

  const onUndoRequest = useCallback((callback: VoidCallback) => {
    undoCallbacksRef.current.add(callback);
    return () => { undoCallbacksRef.current.delete(callback); };
  }, []);

  const onRedoRequest = useCallback((callback: VoidCallback) => {
    redoCallbacksRef.current.add(callback);
    return () => { redoCallbacksRef.current.delete(callback); };
  }, []);

  const reportUndoRedoState = useCallback((state: { canUndo: boolean; canRedo: boolean }) => {
    onUndoRedoStateChangeRef.current(state);
  }, []);

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
    save: () => { for (const cb of saveCallbacksRef.current) cb(); },
    undo: () => { for (const cb of undoCallbacksRef.current) cb(); },
    redo: () => { for (const cb of redoCallbacksRef.current) cb(); },
  }), []);

  return { context, dispatch };
}
