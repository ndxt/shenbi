import { useCallback, useEffect, useRef, useState } from 'react';
import type { PageSchema } from '@shenbi/schema';
import {
  createEditor,
  MemoryFileStorageAdapter,
  type DocumentSessionManager,
  type EditorStateSnapshot,
  type FileStorageAdapter,
} from '@shenbi/editor-core';

export type EditorSessionMode = 'shell' | 'scenarios';

export interface EditorSessionEditor {
  state: {
    getSnapshot(): EditorStateSnapshot;
    getSchema(): PageSchema;
    setSelectedNodeId(nextNodeId: string | undefined): void;
    restoreSnapshot(snapshot: EditorStateSnapshot): void;
    subscribe(listener: (snapshot: EditorStateSnapshot) => void): () => void;
  };
  commands: {
    execute(commandId: string, args?: unknown): Promise<unknown>;
  };
  eventBus?: {
    on: (event: any, listener: (...args: any[]) => void) => () => void;
  } | undefined;
  sessions?: DocumentSessionManager | undefined;
  destroy(): void;
}

export interface UseEditorSessionOptions {
  mode: EditorSessionMode;
  initialShellSchema: PageSchema;
  updateScenarioSchema: (updater: (schema: PageSchema) => PageSchema) => void;
  onError?: ((message: string) => void) | undefined;
  fileStorage?: FileStorageAdapter | undefined;
  createEditorInstance?: (() => EditorSessionEditor) | undefined;
}

export interface UseEditorSessionResult {
  editor: EditorSessionEditor;
  shellSnapshot: EditorStateSnapshot;
  setShellSelectedNodeId: (nextNodeId: string | undefined) => void;
  executeShellNodeCommand: (commandId: string, args: Record<string, unknown>) => void;
  updateActiveSchema: (updater: (schema: PageSchema) => PageSchema) => void;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'unknown error';
}

export function useEditorSession(options: UseEditorSessionOptions): UseEditorSessionResult {
  const { mode, initialShellSchema, updateScenarioSchema, onError, fileStorage, createEditorInstance } = options;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const editorRef = useRef<EditorSessionEditor | null>(null);
  if (!editorRef.current) {
    if (createEditorInstance) {
      editorRef.current = createEditorInstance();
    } else {
      editorRef.current = createEditor({
        initialSchema: initialShellSchema,
        fileStorage: fileStorage ?? new MemoryFileStorageAdapter(),
      });
    }
  }
  const editor = editorRef.current;
  const [shellSnapshot, setShellSnapshot] = useState<EditorStateSnapshot>(() => editor.state.getSnapshot());

  useEffect(() => {
    setShellSnapshot(editor.state.getSnapshot());
    const unsubscribe = editor.state.subscribe((snapshot) => {
      setShellSnapshot(snapshot);
    });
    return unsubscribe;
  }, [editor]);

  useEffect(() => () => {
    editor.destroy();
  }, [editor]);

  const setShellSelectedNodeId = useCallback((nextNodeId: string | undefined) => {
    editor.state.setSelectedNodeId(nextNodeId);
  }, [editor]);

  const executeShellNodeCommand = useCallback((commandId: string, args: Record<string, unknown>) => {
    void editor.commands.execute(commandId, args).catch((error) => {
      onErrorRef.current?.(`节点更新失败: ${getErrorMessage(error)}`);
    });
  }, [editor]);

  const updateActiveSchema = useCallback((updater: (schema: PageSchema) => PageSchema) => {
    if (mode === 'shell') {
      const nextSchema = updater(editor.state.getSchema());
      void editor.commands.execute('schema.replace', { schema: nextSchema }).catch((error) => {
        onErrorRef.current?.(`Schema 更新失败: ${getErrorMessage(error)}`);
      });
      return;
    }
    updateScenarioSchema(updater);
  }, [editor, mode, updateScenarioSchema]);

  return {
    editor,
    shellSnapshot,
    setShellSelectedNodeId,
    executeShellNodeCommand,
    updateActiveSchema,
  };
}
