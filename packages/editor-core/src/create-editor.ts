import type { PageSchema } from '@shenbi/schema';
import { CommandManager } from './command';
import { EditorState } from './editor-state';
import { EventBus } from './event-bus';
import { History } from './history';
import type { EditorEventMap, EditorStateSnapshot } from './types';
import { LocalFileStorageAdapter, type FileStorageAdapter } from './adapters/file-storage';

export interface CreateEditorOptions {
  initialSchema?: PageSchema;
  historyMaxSize?: number;
  fileStorage?: FileStorageAdapter;
}

export interface EditorInstance {
  state: EditorState;
  history: History<EditorStateSnapshot>;
  commands: CommandManager;
  eventBus: EventBus<EditorEventMap>;
  destroy(): void;
}

function createEmptySchema(): PageSchema {
  return {
    id: 'page',
    name: 'page',
    body: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSchemaNode(value: unknown): boolean {
  return isRecord(value) && typeof value.component === 'string';
}

function validatePageSchema(schema: unknown): asserts schema is PageSchema {
  if (!isRecord(schema)) {
    throw new Error('schema must be an object');
  }
  if (schema.id !== undefined && typeof schema.id !== 'string') {
    throw new Error('schema.id must be a string');
  }
  if (schema.name !== undefined && typeof schema.name !== 'string') {
    throw new Error('schema.name must be a string');
  }
  if (!('body' in schema)) {
    throw new Error('schema.body is required');
  }
  const body = schema.body;
  const isValidBody = Array.isArray(body)
    ? body.every((item) => isSchemaNode(item))
    : isSchemaNode(body);
  if (!isValidBody) {
    throw new Error('schema.body must be a schema node or schema node array');
  }
}

function extractSchemaFromArgs(args: unknown): PageSchema {
  if (!isRecord(args) || !('schema' in args)) {
    throw new Error('schema.replace expects args: { schema }');
  }
  const schema = args.schema;
  validatePageSchema(schema);
  return schema;
}

function extractFileIdFromArgs(args: unknown): string {
  if (!isRecord(args) || typeof args.fileId !== 'string' || args.fileId.trim().length === 0) {
    throw new Error('file command expects args: { fileId: string }');
  }
  return args.fileId.trim();
}

function extractFileNameFromArgs(args: unknown): string {
  if (!isRecord(args) || typeof args.name !== 'string' || args.name.trim().length === 0) {
    throw new Error('file.saveAs expects args: { name: string }');
  }
  return args.name.trim();
}

function registerBuiltinCommands(
  state: EditorState,
  history: History<EditorStateSnapshot>,
  commands: CommandManager,
  eventBus: EventBus<EditorEventMap>,
  fileStorage: FileStorageAdapter,
): void {
  commands.register({
    id: 'schema.replace',
    label: 'Replace Schema',
    execute(currentState, args) {
      const schema = extractSchemaFromArgs(args);
      currentState.setSchema(schema);
      eventBus.emit('schema:changed', { schema });
    },
  });

  commands.register({
    id: 'editor.undo',
    label: 'Undo',
    recordHistory: false,
    execute(currentState) {
      const snapshot = history.undo();
      if (!snapshot) {
        return;
      }
      currentState.restoreSnapshot({
        ...snapshot,
        canUndo: history.canUndo(),
        canRedo: history.canRedo(),
      });
      eventBus.emit('history:undo', undefined);
    },
  });

  commands.register({
    id: 'editor.redo',
    label: 'Redo',
    recordHistory: false,
    execute(currentState) {
      const snapshot = history.redo();
      if (!snapshot) {
        return;
      }
      currentState.restoreSnapshot({
        ...snapshot,
        canUndo: history.canUndo(),
        canRedo: history.canRedo(),
      });
      eventBus.emit('history:redo', undefined);
    },
  });

  commands.register({
    id: 'file.openSchema',
    label: 'Open File',
    async execute(_currentState, args) {
      const fileId = extractFileIdFromArgs(args);
      const schema = await fileStorage.read(fileId);
      await commands.execute('schema.replace', { schema });
      eventBus.emit('file:opened', { fileId });
    },
  });

  commands.register({
    id: 'file.saveSchema',
    label: 'Save File',
    recordHistory: false,
    async execute(currentState, args) {
      const fileId = extractFileIdFromArgs(args);
      await fileStorage.write(fileId, currentState.getSchema());
      eventBus.emit('file:saved', { fileId });
    },
  });

  commands.register({
    id: 'file.saveAs',
    label: 'Save As',
    recordHistory: false,
    async execute(currentState, args) {
      const name = extractFileNameFromArgs(args);
      if (!fileStorage.saveAs) {
        throw new Error('saveAs is not supported by current adapter');
      }
      const fileId = await fileStorage.saveAs(name, currentState.getSchema());
      eventBus.emit('file:saved', { fileId });
    },
  });
}

export function createEditor(options: CreateEditorOptions = {}): EditorInstance {
  const initialSchema = options.initialSchema ?? createEmptySchema();
  const state = new EditorState(initialSchema);
  const history = new History<EditorStateSnapshot>(
    state.getSnapshot(),
    options.historyMaxSize === undefined ? {} : { maxSize: options.historyMaxSize },
  );
  const eventBus = new EventBus<EditorEventMap>();
  const commands = new CommandManager(state, history, eventBus);
  const fileStorage = options.fileStorage ?? new LocalFileStorageAdapter();

  registerBuiltinCommands(state, history, commands, eventBus, fileStorage);

  return {
    state,
    history,
    commands,
    eventBus,
    destroy() {
      eventBus.clear();
    },
  };
}
