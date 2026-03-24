// ---------------------------------------------------------------------------
// DocumentProvider — standard lifecycle for all document types.
//
// Page documents and renderer-owned documents (Gateway, etc.) both implement
// this interface so the host shell can treat them uniformly.
// ---------------------------------------------------------------------------

import type { FileContent, FileType } from './adapters/file-storage';

/**
 * A read-only snapshot of a document's state, used by the host to drive UI
 * (toolbar save/undo/redo buttons, dirty indicators, etc.).
 */
export interface DocumentProviderState {
  readonly fileId: string;
  readonly fileType: FileType;
  readonly isDirty: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

/**
 * Standard lifecycle interface for all document types managed by the editor.
 *
 * Implementations:
 * - **PageDocumentProvider**: delegates to EditorState + History (editor-core)
 * - **RendererDocumentProvider**: wraps the callback-based
 *   CanvasRendererDocumentContext for third-party canvas plugins
 */
export interface DocumentProvider {
  /** Unique identifier for this document (same as TabState.fileId). */
  readonly fileId: string;

  /** File type this provider handles ('page' | 'api' | ...). */
  readonly fileType: FileType;

  // ── State ────────────────────────────────────────────────

  /** Get the current read-only snapshot of the document state. */
  getState(): DocumentProviderState;

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: (state: DocumentProviderState) => void): () => void;

  // ── Document content ─────────────────────────────────────

  /**
   * Return the current working document content.
   * For page documents this is a PageSchema; for renderer documents
   * it may be any JSON-serialisable structure.
   */
  getDocument(): FileContent | undefined;

  // ── Commands ─────────────────────────────────────────────

  /** Save the document. */
  save(): void | Promise<void>;

  /** Undo the last change (if canUndo). */
  undo(): void;

  /** Redo the last undone change (if canRedo). */
  redo(): void;

  // ── Lifecycle ────────────────────────────────────────────

  /** Called when the document becomes the active tab. */
  activate?(): void;

  /** Called when the document is about to become inactive (tab switch). */
  deactivate?(): void;

  /** Called when the document tab is closed. Clean up subscriptions. */
  dispose?(): void;
}

/**
 * Factory function that creates a DocumentProvider for a given file type.
 * Plugins register factories to support custom document types.
 */
export type DocumentProviderFactory = (args: {
  fileId: string;
  fileType: FileType;
  initialContent: FileContent;
}) => DocumentProvider;
