import { useCallback, useEffect, useRef, useState } from 'react';
import type { PageSchema } from '@shenbi/schema';
import {
  createEditor,
  LocalFileStorageAdapter,
  type EditorStateSnapshot,
  type FileStorageAdapter,
} from '@shenbi/editor-core';

export type EditorSessionMode = 'shell' | 'scenarios';

export interface EditorSessionEditor {
  state: {
    getSnapshot(): EditorStateSnapshot;
    getSchema(): PageSchema;
    setSelectedNodeId(nextNodeId: string | undefined): void;
    subscribe(listener: (snapshot: EditorStateSnapshot) => void): () => void;
  };
  commands: {
    execute(commandId: string, args?: unknown): Promise<unknown>;
  };
  destroy(): void;
}

export interface UseEditorSessionOptions {
  mode: EditorSessionMode;
  initialShellSchema: PageSchema;
  updateScenarioSchema: (updater: (schema: PageSchema) => PageSchema) => void;
  onError?: (message: string) => void;
  fileStorage?: FileStorageAdapter;
  createEditorInstance?: () => EditorSessionEditor;
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
  const editorRef = useRef<EditorSessionEditor | null>(null);
  if (!editorRef.current) {
    if (options.createEditorInstance) {
      editorRef.current = options.createEditorInstance();
    } else {
      editorRef.current = createEditor({
        initialSchema: options.initialShellSchema,
        fileStorage: options.fileStorage ?? new LocalFileStorageAdapter(),
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
      options.onError?.(`节点更新失败: ${getErrorMessage(error)}`);
    });
  }, [editor, options]);

  const updateActiveSchema = useCallback((updater: (schema: PageSchema) => PageSchema) => {
    if (options.mode === 'shell') {
      const nextSchema = updater(editor.state.getSchema());
      void editor.commands.execute('schema.replace', { schema: nextSchema }).catch((error) => {
        options.onError?.(`Schema 更新失败: ${getErrorMessage(error)}`);
      });
      return;
    }
    options.updateScenarioSchema(updater);
  }, [editor, options]);

  return {
    editor,
    shellSnapshot,
    setShellSelectedNodeId,
    executeShellNodeCommand,
    updateActiveSchema,
  };
}
