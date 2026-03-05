import type { PageSchema } from '@shenbi/schema';
import type { EditorStateSnapshot } from './types';

type EditorStateListener = (state: EditorStateSnapshot) => void;

export class EditorState {
  private schema: PageSchema;
  private selectedNodeId: string | undefined;
  private canUndo = false;
  private canRedo = false;
  private listeners = new Set<EditorStateListener>();

  constructor(initialSchema: PageSchema) {
    this.schema = initialSchema;
  }

  getSchema(): PageSchema {
    return this.schema;
  }

  setSchema(schema: PageSchema): void {
    this.schema = schema;
    this.notify();
  }

  getSelectedNodeId(): string | undefined {
    return this.selectedNodeId;
  }

  setSelectedNodeId(id: string | undefined): void {
    this.selectedNodeId = id;
    this.notify();
  }

  setHistoryFlags(canUndo: boolean, canRedo: boolean): void {
    if (this.canUndo === canUndo && this.canRedo === canRedo) {
      return;
    }
    this.canUndo = canUndo;
    this.canRedo = canRedo;
    this.notify();
  }

  getSnapshot(): EditorStateSnapshot {
    return {
      schema: this.schema,
      ...(this.selectedNodeId ? { selectedNodeId: this.selectedNodeId } : {}),
      canUndo: this.canUndo,
      canRedo: this.canRedo,
    };
  }

  restoreSnapshot(snapshot: EditorStateSnapshot): void {
    this.schema = snapshot.schema;
    this.selectedNodeId = snapshot.selectedNodeId;
    this.canUndo = snapshot.canUndo;
    this.canRedo = snapshot.canRedo;
    this.notify();
  }

  subscribe(listener: EditorStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
