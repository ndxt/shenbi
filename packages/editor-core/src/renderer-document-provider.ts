// ---------------------------------------------------------------------------
// RendererDocumentProvider — DocumentProvider for renderer-owned documents.
//
// Structurally compatible with CanvasRendererDocumentContext (duck typing)
// so it can be passed directly as the renderer's `documentContext` prop.
// Also implements the standard DocumentProvider interface for host-side use.
// ---------------------------------------------------------------------------

import type { FileContent, FileType } from './adapters/file-storage';
import type { DocumentProvider, DocumentProviderState } from './document-provider';

type StateListener = (state: DocumentProviderState) => void;

/**
 * Implements DocumentProvider for documents owned by a canvas renderer plugin.
 *
 * Structurally satisfies `CanvasRendererDocumentContext` (from editor-plugin-api)
 * via duck typing — no import needed. This means the provider can be passed
 * directly as a renderer's `documentContext` prop.
 *
 * The renderer calls `markDirty`, `replaceDocument`, `reportUndoRedoState`
 * to push state into this provider, which the host reads via `getState()`.
 */
export class RendererDocumentProvider implements DocumentProvider {
  readonly fileId: string;
  readonly fileType: FileType;

  private isDirty = false;
  private canUndoFlag = false;
  private canRedoFlag = false;
  private document: FileContent | undefined;
  private readonly listeners = new Set<StateListener>();

  // Callback registries for host-initiated actions
  private readonly saveCallbacks = new Set<() => void>();
  private readonly undoCallbacks = new Set<() => void>();
  private readonly redoCallbacks = new Set<() => void>();

  constructor(args: { fileId: string; fileType: FileType; initialContent?: FileContent }) {
    this.fileId = args.fileId;
    this.fileType = args.fileType;
    this.document = args.initialContent;
  }

  // ── DocumentProvider interface ───────────────────────────

  getState(): DocumentProviderState {
    return {
      fileId: this.fileId,
      fileType: this.fileType,
      isDirty: this.isDirty,
      canUndo: this.canUndoFlag,
      canRedo: this.canRedoFlag,
    };
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  getDocument(): FileContent | undefined {
    return this.document;
  }

  save(): void {
    for (const cb of this.saveCallbacks) cb();
  }

  undo(): void {
    for (const cb of this.undoCallbacks) cb();
  }

  redo(): void {
    for (const cb of this.redoCallbacks) cb();
  }

  dispose(): void {
    this.saveCallbacks.clear();
    this.undoCallbacks.clear();
    this.redoCallbacks.clear();
    this.listeners.clear();
  }

  // ── Renderer-facing API (structurally matches CanvasRendererDocumentContext) ──

  /** Notify dirty state change (matches CRDC.markDirty). */
  markDirty(dirty: boolean): void {
    if (this.isDirty === dirty) return;
    this.isDirty = dirty;
    this.notify();
  }

  /** Replace the host-visible working document (matches CRDC.replaceDocument). */
  replaceDocument(content: FileContent): void {
    this.document = content;
  }

  /** Backward-compatible alias for replaceDocument (matches CRDC.syncSchema). */
  syncSchema(content: FileContent): void {
    this.replaceDocument(content);
  }

  /** Renderer reports undo/redo availability. */
  reportUndoRedoState(state: { canUndo: boolean; canRedo: boolean }): void {
    if (this.canUndoFlag === state.canUndo && this.canRedoFlag === state.canRedo) return;
    this.canUndoFlag = state.canUndo;
    this.canRedoFlag = state.canRedo;
    this.notify();
  }

  /** Register callback for host-initiated save. Returns unsubscribe. */
  onSaveRequest(callback: () => void): () => void {
    this.saveCallbacks.add(callback);
    return () => { this.saveCallbacks.delete(callback); };
  }

  /** Register callback for host-initiated undo. Returns unsubscribe. */
  onUndoRequest(callback: () => void): () => void {
    this.undoCallbacks.add(callback);
    return () => { this.undoCallbacks.delete(callback); };
  }

  /** Register callback for host-initiated redo. Returns unsubscribe. */
  onRedoRequest(callback: () => void): () => void {
    this.redoCallbacks.add(callback);
    return () => { this.redoCallbacks.delete(callback); };
  }

  // ── Internal ─────────────────────────────────────────────

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}
