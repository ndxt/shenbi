// ---------------------------------------------------------------------------
// useGatewayHistory — undo/redo + dirty tracking for gateway documents
// ---------------------------------------------------------------------------

import { useCallback, useRef, useState } from 'react';
import { History } from '@shenbi/editor-core';
import type { GatewayDocumentSchema } from '../types';

export interface GatewayHistoryState {
  /** Current document state */
  document: GatewayDocumentSchema;
  /** Whether the document has unsaved modifications */
  isDirty: boolean;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Push a new document state (creates an undo point) */
  pushState: (doc: GatewayDocumentSchema) => void;
  /** Undo to previous state; returns the restored document or undefined */
  undo: () => GatewayDocumentSchema | undefined;
  /** Redo to next state; returns the restored document or undefined */
  redo: () => GatewayDocumentSchema | undefined;
  /** Mark the current state as the saved baseline (clears dirty) */
  markSaved: () => void;
  /** Replace the document without creating an undo point (e.g. initial load) */
  reset: (doc: GatewayDocumentSchema) => void;
}

export function useGatewayHistory(
  initialDocument: GatewayDocumentSchema,
): GatewayHistoryState {
  const historyRef = useRef<History<GatewayDocumentSchema> | null>(null);
  if (!historyRef.current) {
    historyRef.current = new History(initialDocument, { maxSize: 100 });
  }

  const [document, setDocument] = useState(initialDocument);
  const [isDirty, setIsDirty] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Track the saved snapshot for dirty comparison
  const savedSnapshotRef = useRef(initialDocument);

  const syncHistoryFlags = useCallback(() => {
    const h = historyRef.current!;
    setCanUndo(h.canUndo());
    setCanRedo(h.canRedo());
  }, []);

  const pushState = useCallback((doc: GatewayDocumentSchema) => {
    const h = historyRef.current!;
    h.push(doc);
    setDocument(doc);
    setIsDirty(true);
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  const undo = useCallback(() => {
    const h = historyRef.current!;
    const prev = h.undo();
    if (prev === undefined) return undefined;
    setDocument(prev);
    setIsDirty(prev !== savedSnapshotRef.current);
    syncHistoryFlags();
    return prev;
  }, [syncHistoryFlags]);

  const redo = useCallback(() => {
    const h = historyRef.current!;
    const next = h.redo();
    if (next === undefined) return undefined;
    setDocument(next);
    setIsDirty(next !== savedSnapshotRef.current);
    syncHistoryFlags();
    return next;
  }, [syncHistoryFlags]);

  const markSaved = useCallback(() => {
    const h = historyRef.current!;
    savedSnapshotRef.current = h.getCurrent();
    setIsDirty(false);
  }, []);

  const reset = useCallback((doc: GatewayDocumentSchema) => {
    const h = historyRef.current!;
    h.clear(doc);
    savedSnapshotRef.current = doc;
    setDocument(doc);
    setIsDirty(false);
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  return {
    document,
    isDirty,
    canUndo,
    canRedo,
    pushState,
    undo,
    redo,
    markSaved,
    reset,
  };
}
