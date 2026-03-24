// ---------------------------------------------------------------------------
// useCanvasDocumentContext — bridges canvas-renderer document lifecycle
// to the host editor shell (dirty tracking, save, undo/redo dispatch).
//
// Creates a RendererDocumentProvider that structurally satisfies
// CanvasRendererDocumentContext. The provider is passed directly as the
// renderer's `documentContext` prop — no extra wrapping needed.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { RendererDocumentProvider } from '@shenbi/editor-core';
import type { CanvasRendererDocumentContext } from '@shenbi/editor-plugin-api';
import type { DocumentProvider } from '@shenbi/editor-core';

/**
 * Host-side hook that creates a `RendererDocumentProvider` for canvas
 * renderers that manage their own document state (e.g. Gateway editor).
 *
 * The provider structurally satisfies `CanvasRendererDocumentContext`,
 * so it can be passed directly as `documentContext` to any renderer.
 *
 * Also returns `dispatch` helpers for host-initiated save/undo/redo.
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

  // Intercept replaceDocument to also forward schema to host
  const origReplaceDocument = useMemo(() => provider.replaceDocument.bind(provider), [provider]);
  useEffect(() => {
    provider.replaceDocument = (content) => {
      origReplaceDocument(content);
      onSchemaChangeRef.current?.(content as Record<string, unknown>);
    };
    provider.syncSchema = provider.replaceDocument;
    return () => {
      provider.replaceDocument = origReplaceDocument;
      provider.syncSchema = origReplaceDocument;
    };
  }, [origReplaceDocument, provider]);

  // The provider structurally satisfies CanvasRendererDocumentContext
  const context = provider as unknown as CanvasRendererDocumentContext;

  const dispatch = useMemo(() => ({
    save: () => provider.save(),
    undo: () => provider.undo(),
    redo: () => provider.redo(),
  }), [provider]);

  return { context, dispatch, provider };
}
