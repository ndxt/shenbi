// ---------------------------------------------------------------------------
// useGatewayHistory — undo/redo + dirty tracking for gateway documents
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { History, type HistorySnapshot } from '@shenbi/editor-core';
import type { GatewayDocumentSchema } from '../types';

interface GatewayHistoryCacheEntry {
  snapshot: HistorySnapshot<GatewayDocumentSchema>;
  savedSnapshot: GatewayDocumentSchema;
}

const gatewayHistoryCache = new Map<string, GatewayHistoryCacheEntry>();

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
  /** Start a batched history update for continuous interactions like dragging */
  lock: () => void;
  /** Commit the current batched interaction as a single undo step */
  commit: () => boolean;
  /** Whether a batched interaction is currently in progress */
  isLocked: boolean;
}

export function useGatewayHistory(
  initialDocument: GatewayDocumentSchema,
  options?: {
    cacheKey?: string | undefined;
  },
): GatewayHistoryState {
  const cacheKey = options?.cacheKey;
  const cachedEntry = cacheKey ? gatewayHistoryCache.get(cacheKey) : undefined;
  const historyRef = useRef<History<GatewayDocumentSchema> | null>(null);
  if (!historyRef.current) {
    historyRef.current = new History(initialDocument, { maxSize: 100 });
    if (cachedEntry) {
      historyRef.current.importSnapshot(cachedEntry.snapshot);
    }
  }

  const history = historyRef.current;
  const [document, setDocument] = useState(history.getCurrent());
  const [isDirty, setIsDirty] = useState(cachedEntry ? cachedEntry.snapshot.current !== cachedEntry.savedSnapshot : false);
  const [canUndo, setCanUndo] = useState(history.canUndo());
  const [canRedo, setCanRedo] = useState(history.canRedo());
  const [isLocked, setIsLocked] = useState(false);

  // Track the saved snapshot for dirty comparison
  const savedSnapshotRef = useRef(cachedEntry?.savedSnapshot ?? initialDocument);

  const persistCache = useCallback(() => {
    if (!cacheKey) {
      return;
    }
    gatewayHistoryCache.set(cacheKey, {
      snapshot: historyRef.current!.exportSnapshot(),
      savedSnapshot: savedSnapshotRef.current,
    });
  }, [cacheKey]);

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
    persistCache();
  }, [persistCache, syncHistoryFlags]);

  const undo = useCallback(() => {
    const h = historyRef.current!;
    const prev = h.undo();
    if (prev === undefined) return undefined;
    setDocument(prev);
    setIsDirty(prev !== savedSnapshotRef.current);
    syncHistoryFlags();
    persistCache();
    return prev;
  }, [persistCache, syncHistoryFlags]);

  const redo = useCallback(() => {
    const h = historyRef.current!;
    const next = h.redo();
    if (next === undefined) return undefined;
    setDocument(next);
    setIsDirty(next !== savedSnapshotRef.current);
    syncHistoryFlags();
    persistCache();
    return next;
  }, [persistCache, syncHistoryFlags]);

  const markSaved = useCallback(() => {
    const h = historyRef.current!;
    savedSnapshotRef.current = h.getCurrent();
    setIsDirty(false);
    persistCache();
  }, [persistCache]);

  const reset = useCallback((doc: GatewayDocumentSchema) => {
    const h = historyRef.current!;
    h.clear(doc);
    savedSnapshotRef.current = doc;
    setDocument(doc);
    setIsDirty(false);
    setCanUndo(false);
    setCanRedo(false);
    setIsLocked(false);
    persistCache();
  }, [persistCache]);

  const lock = useCallback(() => {
    const h = historyRef.current!;
    h.lock();
    setIsLocked(h.isLocked());
  }, []);

  const commit = useCallback(() => {
    const h = historyRef.current!;
    const committed = h.commit();
    setDocument(h.getCurrent());
    setIsLocked(h.isLocked());
    setIsDirty(h.getCurrent() !== savedSnapshotRef.current);
    syncHistoryFlags();
    persistCache();
    return committed;
  }, [persistCache, syncHistoryFlags]);

  useEffect(() => {
    persistCache();
  }, [persistCache]);

  return useMemo(() => ({
    document,
    isDirty,
    canUndo,
    canRedo,
    pushState,
    undo,
    redo,
    markSaved,
    reset,
    lock,
    commit,
    isLocked,
  }), [document, isDirty, canUndo, canRedo, pushState, undo, redo, markSaved, reset, lock, commit, isLocked]);
}
