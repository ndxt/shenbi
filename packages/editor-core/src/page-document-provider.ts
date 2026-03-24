import type { PageSchema } from '@shenbi/schema';
import type { DocumentProvider, DocumentProviderState } from './document-provider';
import type { EditorStateSnapshot } from './types';

type StateListener = (state: DocumentProviderState) => void;

interface PageDocumentProviderEditorState {
  getSnapshot(): EditorStateSnapshot;
  subscribe(listener: (snapshot: EditorStateSnapshot) => void): () => void;
  getSchema(): PageSchema;
}

interface PageDocumentProviderCommands {
  execute(commandId: string, args?: unknown): Promise<unknown>;
}

export class PageDocumentProvider implements DocumentProvider {
  readonly fileId: string;
  readonly fileType = 'page' as const;

  private readonly state: PageDocumentProviderEditorState;
  private readonly commands: PageDocumentProviderCommands;
  private readonly listeners = new Set<StateListener>();
  private readonly unsubscribeState: () => void;
  private currentState: DocumentProviderState;

  constructor(args: {
    fileId: string;
    state: PageDocumentProviderEditorState;
    commands: PageDocumentProviderCommands;
  }) {
    this.fileId = args.fileId;
    this.state = args.state;
    this.commands = args.commands;
    this.currentState = this.computeState(args.state.getSnapshot());
    this.unsubscribeState = args.state.subscribe((snapshot) => {
      const nextState = this.computeState(snapshot);
      if (
        nextState.isDirty === this.currentState.isDirty
        && nextState.canUndo === this.currentState.canUndo
        && nextState.canRedo === this.currentState.canRedo
      ) {
        return;
      }
      this.currentState = nextState;
      this.notify();
    });
  }

  getState(): DocumentProviderState {
    return this.currentState;
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getDocument(): PageSchema | undefined {
    const snapshot = this.state.getSnapshot();
    if (snapshot.currentFileId !== this.fileId) {
      return undefined;
    }
    return this.state.getSchema();
  }

  save(): void {
    void this.commands.execute('tab.save');
  }

  undo(): void {
    void this.commands.execute('editor.undo');
  }

  redo(): void {
    void this.commands.execute('editor.redo');
  }

  dispose(): void {
    this.unsubscribeState();
    this.listeners.clear();
  }

  private computeState(snapshot: EditorStateSnapshot): DocumentProviderState {
    if (snapshot.currentFileId !== this.fileId) {
      return {
        fileId: this.fileId,
        fileType: this.fileType,
        isDirty: false,
        canUndo: false,
        canRedo: false,
      };
    }
    return {
      fileId: this.fileId,
      fileType: this.fileType,
      isDirty: snapshot.isDirty,
      canUndo: snapshot.canUndo,
      canRedo: snapshot.canRedo,
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.currentState);
    }
  }
}
