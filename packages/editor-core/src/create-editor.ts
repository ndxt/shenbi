import type { PageSchema, SchemaNode } from '@shenbi/schema';
import { CommandManager } from './command';
import { DocumentSessionManager } from './document-session';
import { EditorState } from './editor-state';
import { EventBus } from './event-bus';
import { History } from './history';
import type { EditorEventMap, EditorStateSnapshot } from './types';
import {
  MemoryFileStorageAdapter,
  type FileContent,
  type FileStorageAdapter,
  type FileType,
} from './adapters/file-storage';
import type { VirtualFileSystemAdapter } from './adapters/virtual-fs';
import { TabManager, type TabState } from './tab-manager';
import {
  appendSchemaNode,
  insertSchemaNodeAt,
  moveSchemaNode,
  patchSchemaNodeColumns,
  patchSchemaNodeEvents,
  patchSchemaNodeLogic,
  patchSchemaNodeProps,
  removeSchemaNode,
  patchSchemaNodeStyle,
} from './schema-editor';

export interface CreateEditorOptions {
  initialSchema?: PageSchema;
  historyMaxSize?: number;
  fileStorage?: FileStorageAdapter;
  vfs?: VirtualFileSystemAdapter;
  tabManager?: TabManager;
  projectId?: string;
}

export interface EditorInstance {
  state: EditorState;
  history: History<EditorStateSnapshot>;
  commands: CommandManager;
  eventBus: EventBus<EditorEventMap>;
  tabManager?: TabManager | undefined;
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

function validateFileContent(fileType: FileType, content: unknown): asserts content is FileContent {
  if (fileType === 'page') {
    validatePageSchema(content);
    return;
  }
  if (!isRecord(content)) {
    throw new Error(`${fileType} file content must be an object`);
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

function extractRestoreArgs(args: unknown): { schema: PageSchema; isDirty?: boolean } {
  if (!isRecord(args) || !('schema' in args)) {
    throw new Error('schema.restore expects args: { schema, isDirty?: boolean }');
  }
  const schema = args.schema;
  validatePageSchema(schema);
  if (Object.prototype.hasOwnProperty.call(args, 'isDirty')) {
    if (typeof args.isDirty !== 'boolean') {
      throw new Error('schema.restore expects args: { schema, isDirty?: boolean }');
    }
    return { schema, isDirty: args.isDirty };
  }
  return { schema };
}

function extractEditorSnapshotArgs(args: unknown): EditorStateSnapshot {
  if (!isRecord(args) || !isRecord(args.snapshot)) {
    throw new Error('editor.restoreSnapshot expects args: { snapshot }');
  }
  const snapshot = args.snapshot;
  if (!('schema' in snapshot)) {
    throw new Error('editor.restoreSnapshot expects args: { snapshot }');
  }

  const schema = snapshot.schema;
  validatePageSchema(schema);

  if (snapshot.selectedNodeId !== undefined && typeof snapshot.selectedNodeId !== 'string') {
    throw new Error('editor.restoreSnapshot expects snapshot.selectedNodeId to be a string');
  }

  if (snapshot.currentFileId !== undefined && typeof snapshot.currentFileId !== 'string') {
    throw new Error('editor.restoreSnapshot expects snapshot.currentFileId to be a string');
  }

  if (typeof snapshot.isDirty !== 'boolean') {
    throw new Error('editor.restoreSnapshot expects snapshot.isDirty to be a boolean');
  }

  return {
    schema,
    ...(typeof snapshot.selectedNodeId === 'string'
      ? { selectedNodeId: snapshot.selectedNodeId }
      : {}),
    ...(typeof snapshot.currentFileId === 'string'
      ? { currentFileId: snapshot.currentFileId }
      : {}),
    isDirty: snapshot.isDirty,
    canUndo: false,
    canRedo: false,
  };
}

function extractFileIdFromArgs(args: unknown): string {
  if (!isRecord(args) || typeof args.fileId !== 'string' || args.fileId.trim().length === 0) {
    throw new Error('file command expects args: { fileId: string }');
  }
  return args.fileId.trim();
}

function extractOptionalFileIdFromArgs(args: unknown): string | undefined {
  if (!isRecord(args) || args.fileId === undefined) {
    return undefined;
  }
  if (typeof args.fileId !== 'string' || args.fileId.trim().length === 0) {
    throw new Error('file.saveSchema expects args: { fileId?: string }');
  }
  return args.fileId.trim();
}

function extractFileNameFromArgs(args: unknown): string {
  if (!isRecord(args) || typeof args.name !== 'string' || args.name.trim().length === 0) {
    throw new Error('file.saveAs expects args: { name: string }');
  }
  return args.name.trim();
}

function extractWriteSchemaArgs(args: unknown): { fileId: string; schema: PageSchema } {
  if (!isRecord(args) || typeof args.fileId !== 'string' || args.fileId.trim().length === 0 || !('schema' in args)) {
    throw new Error('file.writeSchema expects args: { fileId: string, schema: PageSchema }');
  }
  const schema = args.schema;
  validatePageSchema(schema);
  return {
    fileId: args.fileId.trim(),
    schema,
  };
}

function extractTabSyncStateArgs(args: unknown, fileType: FileType): {
  fileId: string;
  schema?: FileContent;
  selectedNodeId?: string;
  isDirty?: boolean;
  isGenerating?: boolean;
  readOnlyReason?: string | undefined;
  generationUpdatedAt?: number;
} {
  if (!isRecord(args) || typeof args.fileId !== 'string' || args.fileId.trim().length === 0) {
    throw new Error('tab.syncState expects args: { fileId: string, ... }');
  }

  const result: {
    fileId: string;
    schema?: FileContent;
    selectedNodeId?: string;
    isDirty?: boolean;
    isGenerating?: boolean;
    readOnlyReason?: string | undefined;
    generationUpdatedAt?: number;
  } = {
    fileId: args.fileId.trim(),
  };

  if (Object.prototype.hasOwnProperty.call(args, 'schema')) {
    validateFileContent(fileType, args.schema);
    result.schema = args.schema;
  }
  if (Object.prototype.hasOwnProperty.call(args, 'selectedNodeId')) {
    if (args.selectedNodeId !== undefined && typeof args.selectedNodeId !== 'string') {
      throw new Error('tab.syncState expects selectedNodeId to be a string');
    }
    if (typeof args.selectedNodeId === 'string') {
      result.selectedNodeId = args.selectedNodeId;
    }
  }
  if (Object.prototype.hasOwnProperty.call(args, 'isDirty')) {
    if (typeof args.isDirty !== 'boolean') {
      throw new Error('tab.syncState expects isDirty to be a boolean');
    }
    result.isDirty = args.isDirty;
  }
  if (Object.prototype.hasOwnProperty.call(args, 'isGenerating')) {
    if (typeof args.isGenerating !== 'boolean') {
      throw new Error('tab.syncState expects isGenerating to be a boolean');
    }
    result.isGenerating = args.isGenerating;
  }
  if (Object.prototype.hasOwnProperty.call(args, 'readOnlyReason')) {
    if (args.readOnlyReason !== undefined && args.readOnlyReason !== null && typeof args.readOnlyReason !== 'string') {
      throw new Error('tab.syncState expects readOnlyReason to be a string');
    }
    if (typeof args.readOnlyReason === 'string') {
      result.readOnlyReason = args.readOnlyReason;
    }
  }
  if (Object.prototype.hasOwnProperty.call(args, 'generationUpdatedAt')) {
    if (!Number.isFinite(args.generationUpdatedAt)) {
      throw new Error('tab.syncState expects generationUpdatedAt to be a finite number');
    }
    result.generationUpdatedAt = Number(args.generationUpdatedAt);
  }

  return result;
}

function createVFSFileStorageAdapter(
  vfs: VirtualFileSystemAdapter,
  projectId: string,
): FileStorageAdapter {
  return {
    async list() {
      const nodes = await vfs.listTree(projectId);
      return nodes
        .filter((node) => node.type === 'file')
        .map((node) => ({
          id: node.id,
          name: node.name,
          updatedAt: node.updatedAt,
          ...(node.size !== undefined ? { size: node.size } : {}),
        }));
    },
    async read(fileId) {
      return await vfs.readFile(projectId, fileId) as PageSchema;
    },
    async write(fileId, schema) {
      const existingNode = await vfs.getNode(projectId, fileId);
      if (!existingNode || existingNode.type !== 'file') {
        throw new Error(`File not found: ${fileId}`);
      }
      await vfs.writeFile(projectId, fileId, schema);
    },
    async saveAs(name, schema) {
      const node = await vfs.createFile(projectId, null, name, 'page', {
        ...schema,
        name,
      });
      return node.id;
    },
    async delete(fileId) {
      await vfs.deleteFile(projectId, fileId);
    },
  };
}

function extractTreeIdFromArgs(args: unknown, commandId: string): string {
  if (!isRecord(args) || typeof args.treeId !== 'string' || args.treeId.trim().length === 0) {
    throw new Error(`${commandId} expects args: { treeId: string, ... }`);
  }
  return args.treeId.trim();
}

function extractPatchFromArgs(args: unknown, commandId: string): Record<string, unknown> {
  if (!isRecord(args) || !isRecord(args.patch)) {
    throw new Error(`${commandId} expects args: { treeId: string, patch: object }`);
  }
  return args.patch;
}

function extractColumnsFromArgs(args: unknown): unknown {
  if (!isRecord(args) || !Object.prototype.hasOwnProperty.call(args, 'columns')) {
    throw new Error('node.patchColumns expects args: { treeId: string, columns: unknown }');
  }
  return args.columns;
}

function extractSchemaNodeFromArgs(args: unknown, commandId: string): SchemaNode {
  if (!isRecord(args) || !isSchemaNode(args.node)) {
    throw new Error(`${commandId} expects args: { node: SchemaNode, ... }`);
  }
  return args.node as SchemaNode;
}

function extractOptionalParentTreeIdFromArgs(args: unknown, commandId: string): string | undefined {
  if (!isRecord(args) || args.parentTreeId === undefined) {
    return undefined;
  }
  if (typeof args.parentTreeId !== 'string' || args.parentTreeId.trim().length === 0) {
    throw new Error(`${commandId} expects args: { parentTreeId?: string, ... }`);
  }
  return args.parentTreeId.trim();
}

function extractIndexFromArgs(args: unknown, commandId: string): number {
  if (!isRecord(args) || !Number.isInteger(args.index)) {
    throw new Error(`${commandId} expects args: { index: number, ... }`);
  }
  return Number(args.index);
}

function extractMoveNodeArgs(args: unknown): {
  sourceTreeId: string;
  targetParentTreeId?: string;
  index: number;
} {
  if (!isRecord(args) || typeof args.sourceTreeId !== 'string' || !Number.isInteger(args.index)) {
    throw new Error('node.move expects args: { sourceTreeId: string, targetParentTreeId?: string, index: number }');
  }
  if (
    Object.prototype.hasOwnProperty.call(args, 'targetParentTreeId')
    && args.targetParentTreeId !== undefined
    && args.targetParentTreeId !== 'dialogs'
    && (typeof args.targetParentTreeId !== 'string' || args.targetParentTreeId.trim().length === 0)
  ) {
    throw new Error('node.move expects args: { sourceTreeId: string, targetParentTreeId?: string, index: number }');
  }
  return {
    sourceTreeId: args.sourceTreeId.trim(),
    ...(typeof args.targetParentTreeId === 'string' || args.targetParentTreeId === 'dialogs'
      ? { targetParentTreeId: args.targetParentTreeId }
      : {}),
    index: Number(args.index),
  };
}

function registerBuiltinCommands(
  state: EditorState,
  history: History<EditorStateSnapshot>,
  commands: CommandManager,
  eventBus: EventBus<EditorEventMap>,
  fileStorage: FileStorageAdapter,
): void {
  const updateCurrentFileId = (currentState: EditorState, fileId: string | undefined): void => {
    if (currentState.getCurrentFileId() === fileId) {
      return;
    }
    currentState.setCurrentFileId(fileId);
    eventBus.emit('file:currentChanged', fileId ? { fileId } : {});
  };

  commands.register({
    id: 'schema.replace',
    label: 'Replace Schema',
    execute(currentState, args) {
      const schema = extractSchemaFromArgs(args);
      currentState.setSchema(schema);
      currentState.setDirty(true);
      eventBus.emit('schema:changed', { schema });
    },
  });

  commands.register({
    id: 'schema.restore',
    label: 'Restore Schema',
    recordHistory: false,
    execute(currentState, args) {
      const { schema, isDirty } = extractRestoreArgs(args);
      const currentSnapshot = history.getCurrent();
      if (currentSnapshot.schema === schema) {
        currentState.restoreSnapshot({
          ...currentSnapshot,
          canUndo: history.canUndo(),
          canRedo: history.canRedo(),
        });
      } else {
        currentState.setSchema(schema);
        if (typeof isDirty === 'boolean') {
          currentState.setDirty(isDirty);
        }
      }
      eventBus.emit('schema:changed', { schema });
    },
  });

  commands.register({
    id: 'editor.restoreSnapshot',
    label: 'Restore Editor Snapshot',
    recordHistory: false,
    execute(currentState, args) {
      const snapshot = extractEditorSnapshotArgs(args);
      const previousFileId = currentState.getCurrentFileId();
      currentState.restoreSnapshot(snapshot);
      history.clear(currentState.getSnapshot());
      currentState.setHistoryFlags(history.canUndo(), history.canRedo());
      if (previousFileId !== snapshot.currentFileId) {
        eventBus.emit('file:currentChanged', snapshot.currentFileId ? { fileId: snapshot.currentFileId } : {});
      }
      eventBus.emit('schema:changed', { schema: snapshot.schema });
    },
  });

  commands.register({
    id: 'node.append',
    label: 'Append Node',
    recordHistory: false,
    execute(currentState, args) {
      const node = extractSchemaNodeFromArgs(args, 'node.append');
      const parentTreeId = extractOptionalParentTreeIdFromArgs(args, 'node.append');
      const previousSchema = currentState.getSchema();
      const nextSchema = appendSchemaNode(previousSchema, node, parentTreeId);
      if (nextSchema === previousSchema) {
        return;
      }
      currentState.setSchema(nextSchema);
      currentState.setDirty(true);
      eventBus.emit('schema:changed', { schema: nextSchema });
    },
  });

  commands.register({
    id: 'node.insertAt',
    label: 'Insert Node At',
    recordHistory: false,
    execute(currentState, args) {
      const node = extractSchemaNodeFromArgs(args, 'node.insertAt');
      const index = extractIndexFromArgs(args, 'node.insertAt');
      const parentTreeId = extractOptionalParentTreeIdFromArgs(args, 'node.insertAt');
      const previousSchema = currentState.getSchema();
      const nextSchema = insertSchemaNodeAt(previousSchema, node, index, parentTreeId);
      if (nextSchema === previousSchema) {
        return;
      }
      currentState.setSchema(nextSchema);
      currentState.setDirty(true);
      eventBus.emit('schema:changed', { schema: nextSchema });
    },
  });

  commands.register({
    id: 'node.remove',
    label: 'Remove Node',
    recordHistory: false,
    execute(currentState, args) {
      const treeId = extractTreeIdFromArgs(args, 'node.remove');
      const previousSchema = currentState.getSchema();
      const nextSchema = removeSchemaNode(previousSchema, treeId);
      if (nextSchema === previousSchema) {
        return;
      }
      currentState.setSchema(nextSchema);
      currentState.setDirty(true);
      eventBus.emit('schema:changed', { schema: nextSchema });
    },
  });

  commands.register({
    id: 'node.move',
    label: 'Move Node',
    recordHistory: false,
    execute(currentState, args) {
      const { sourceTreeId, targetParentTreeId, index } = extractMoveNodeArgs(args);
      const previousSchema = currentState.getSchema();
      const nextSchema = moveSchemaNode(previousSchema, sourceTreeId, targetParentTreeId, index);
      if (nextSchema === previousSchema) {
        return;
      }
      currentState.setSchema(nextSchema);
      currentState.setDirty(true);
      eventBus.emit('schema:changed', { schema: nextSchema });
    },
  });

  commands.register({
    id: 'node.patchProps',
    label: 'Patch Node Props',
    execute(currentState, args) {
      const treeId = extractTreeIdFromArgs(args, 'node.patchProps');
      const patch = extractPatchFromArgs(args, 'node.patchProps');
      const previousSchema = currentState.getSchema();
      const nextSchema = patchSchemaNodeProps(previousSchema, treeId, patch);
      if (nextSchema === previousSchema) {
        return;
      }
      currentState.setSchema(nextSchema);
      currentState.setDirty(true);
      eventBus.emit('schema:changed', { schema: nextSchema });
    },
  });

  commands.register({
    id: 'node.patchEvents',
    label: 'Patch Node Events',
    execute(currentState, args) {
      const treeId = extractTreeIdFromArgs(args, 'node.patchEvents');
      const patch = extractPatchFromArgs(args, 'node.patchEvents');
      const previousSchema = currentState.getSchema();
      const nextSchema = patchSchemaNodeEvents(previousSchema, treeId, patch);
      if (nextSchema === previousSchema) {
        return;
      }
      currentState.setSchema(nextSchema);
      currentState.setDirty(true);
      eventBus.emit('schema:changed', { schema: nextSchema });
    },
  });

  commands.register({
    id: 'node.patchStyle',
    label: 'Patch Node Style',
    execute(currentState, args) {
      const treeId = extractTreeIdFromArgs(args, 'node.patchStyle');
      const patch = extractPatchFromArgs(args, 'node.patchStyle');
      const previousSchema = currentState.getSchema();
      const nextSchema = patchSchemaNodeStyle(previousSchema, treeId, patch);
      if (nextSchema === previousSchema) {
        return;
      }
      currentState.setSchema(nextSchema);
      currentState.setDirty(true);
      eventBus.emit('schema:changed', { schema: nextSchema });
    },
  });

  commands.register({
    id: 'node.patchLogic',
    label: 'Patch Node Logic',
    execute(currentState, args) {
      const treeId = extractTreeIdFromArgs(args, 'node.patchLogic');
      const patch = extractPatchFromArgs(args, 'node.patchLogic');
      const previousSchema = currentState.getSchema();
      const nextSchema = patchSchemaNodeLogic(previousSchema, treeId, patch);
      if (nextSchema === previousSchema) {
        return;
      }
      currentState.setSchema(nextSchema);
      currentState.setDirty(true);
      eventBus.emit('schema:changed', { schema: nextSchema });
    },
  });

  commands.register({
    id: 'node.patchColumns',
    label: 'Patch Node Columns',
    execute(currentState, args) {
      const treeId = extractTreeIdFromArgs(args, 'node.patchColumns');
      const columns = extractColumnsFromArgs(args);
      const previousSchema = currentState.getSchema();
      const nextSchema = patchSchemaNodeColumns(previousSchema, treeId, columns);
      if (nextSchema === previousSchema) {
        return;
      }
      currentState.setSchema(nextSchema);
      currentState.setDirty(true);
      eventBus.emit('schema:changed', { schema: nextSchema });
    },
  });

  commands.register({
    id: 'history.beginBatch',
    label: 'Begin History Batch',
    recordHistory: false,
    execute() {
      history.lock();
    },
  });

  commands.register({
    id: 'history.commitBatch',
    label: 'Commit History Batch',
    recordHistory: false,
    execute(currentState) {
      const didCommit = history.commit();
      currentState.setHistoryFlags(history.canUndo(), history.canRedo());
      if (didCommit) {
        eventBus.emit('history:pushed', undefined);
      }
    },
  });

  commands.register({
    id: 'history.discardBatch',
    label: 'Discard History Batch',
    recordHistory: false,
    execute(currentState) {
      const restoredSnapshot = history.discard();
      if (!restoredSnapshot) {
        currentState.setHistoryFlags(history.canUndo(), history.canRedo());
        return;
      }
      currentState.restoreSnapshot({
        ...restoredSnapshot,
        canUndo: history.canUndo(),
        canRedo: history.canRedo(),
      });
    },
  });

  commands.register({
    id: 'editor.undo',
    label: 'Undo',
    recordHistory: false,
    canExecute: () => !history.isLocked() && history.canUndo(),
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
    canExecute: () => !history.isLocked() && history.canRedo(),
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
    id: 'file.listSchemas',
    label: 'List Files',
    recordHistory: false,
    async execute() {
      return fileStorage.list();
    },
  });

  commands.register({
    id: 'file.openSchema',
    label: 'Open File',
    async execute(currentState, args) {
      const fileId = extractFileIdFromArgs(args);
      const schema = await fileStorage.read(fileId);
      await commands.execute('schema.replace', { schema });
      updateCurrentFileId(currentState, fileId);
      currentState.setDirty(false);
      eventBus.emit('file:opened', { fileId });
    },
  });

  commands.register({
    id: 'file.readSchema',
    label: 'Read File',
    recordHistory: false,
    async execute(_currentState, args) {
      const fileId = extractFileIdFromArgs(args);
      return fileStorage.read(fileId);
    },
  });

  commands.register({
    id: 'file.saveSchema',
    label: 'Save File',
    recordHistory: false,
    async execute(currentState, args) {
      const fileIdFromArgs = extractOptionalFileIdFromArgs(args);
      const fileId = fileIdFromArgs ?? currentState.getCurrentFileId();
      if (!fileId) {
        throw new Error('file.saveSchema requires current file, please open or saveAs first');
      }
      await fileStorage.write(fileId, currentState.getSchema());
      updateCurrentFileId(currentState, fileId);
      currentState.setDirty(false);
      eventBus.emit('file:saved', { fileId });
    },
  });

  commands.register({
    id: 'file.writeSchema',
    label: 'Write File',
    recordHistory: false,
    async execute(_currentState, args) {
      const { fileId, schema } = extractWriteSchemaArgs(args);
      await fileStorage.write(fileId, schema);
      eventBus.emit('file:saved', { fileId, source: 'auto' });
      eventBus.emit('fs:treeChanged', undefined);
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
      updateCurrentFileId(currentState, fileId);
      currentState.setDirty(false);
      eventBus.emit('file:saved', { fileId });
      return fileId;
    },
  });

  commands.register({
    id: 'file.deleteSchema',
    label: 'Delete File',
    recordHistory: false,
    async execute(currentState, args) {
      const fileId = extractFileIdFromArgs(args);
      if (!fileStorage.delete) {
        throw new Error('delete is not supported by current adapter');
      }
      await fileStorage.delete(fileId);
      if (currentState.getCurrentFileId() === fileId) {
        updateCurrentFileId(currentState, undefined);
      }
      eventBus.emit('file:deleted', { fileId });
    },
  });
}

function createDefaultApiContent(name: string): Record<string, unknown> {
  return {
    id: `gateway-${Date.now()}`,
    name,
    type: 'api-gateway',
    nodes: [
      { id: 'start-1', kind: 'start', label: '开始', position: { x: 100, y: 200 }, config: {} },
      { id: 'end-1', kind: 'end', label: '返回结果', position: { x: 600, y: 200 }, config: {} },
    ],
    edges: [
      { id: 'edge_default', source: 'start-1', sourceHandle: 'request', target: 'end-1', targetHandle: 'result' },
    ],
  };
}

function registerVFSCommands(
  commands: CommandManager,
  eventBus: EventBus<EditorEventMap>,
  vfs: VirtualFileSystemAdapter,
  projectId: string,
  tabManager?: TabManager,
): void {
  commands.register({
    id: 'fs.createFile',
    label: 'Create File',
    recordHistory: false,
    async execute(_currentState, args) {
      if (!isRecord(args) || typeof args.name !== 'string') {
        throw new Error('fs.createFile expects args: { name, fileType, parentId? }');
      }
      const parentId = typeof args.parentId === 'string' ? args.parentId : null;
      const fileType = (typeof args.fileType === 'string' ? args.fileType : 'page') as FileType;
      const content = isRecord(args.content)
        ? args.content
        : fileType === 'api'
          ? createDefaultApiContent(args.name)
          : { id: 'page', name: args.name, body: [] };
      const node = await vfs.createFile(projectId, parentId, args.name, fileType, content);
      eventBus.emit('fs:nodeCreated', { node });
      eventBus.emit('fs:treeChanged', undefined);
      return node;
    },
  });

  commands.register({
    id: 'fs.createDirectory',
    label: 'Create Directory',
    recordHistory: false,
    async execute(_currentState, args) {
      if (!isRecord(args) || typeof args.name !== 'string') {
        throw new Error('fs.createDirectory expects args: { name, parentId? }');
      }
      const parentId = typeof args.parentId === 'string' ? args.parentId : null;
      const node = await vfs.createDirectory(projectId, parentId, args.name);
      eventBus.emit('fs:nodeCreated', { node });
      eventBus.emit('fs:treeChanged', undefined);
      return node;
    },
  });

  commands.register({
    id: 'fs.deleteNode',
    label: 'Delete Node',
    recordHistory: false,
    async execute(_currentState, args) {
      if (!isRecord(args) || typeof args.nodeId !== 'string') {
        throw new Error('fs.deleteNode expects args: { nodeId }');
      }
      const node = await vfs.getNode(projectId, args.nodeId);
      if (!node) {
        throw new Error(`Node not found: ${args.nodeId}`);
      }
      if (node.type === 'directory') {
        // Close tabs for all files in the directory before deleting
        if (tabManager) {
          const allNodes = await vfs.listTree(projectId);
          const collectFileIds = (parentId: string, ids: Set<string>) => {
            for (const n of allNodes) {
              if (n.parentId === parentId) {
                if (n.type === 'file') ids.add(n.id);
                else collectFileIds(n.id, ids);
              }
            }
          };
          const fileIds = new Set<string>();
          collectFileIds(args.nodeId, fileIds);
          for (const fid of fileIds) {
            if (tabManager.getTab(fid)) {
              await commands.execute('tab.close', { fileId: fid });
            }
          }
        }
        await vfs.deleteDirectory(projectId, args.nodeId, true);
      } else {
        // Close the tab for this file if open
        if (tabManager?.getTab(args.nodeId)) {
          await commands.execute('tab.close', { fileId: args.nodeId });
        }
        await vfs.deleteFile(projectId, args.nodeId);
      }
      eventBus.emit('fs:nodeDeleted', { nodeId: args.nodeId, path: node.path });
      eventBus.emit('fs:treeChanged', undefined);
    },
  });

  commands.register({
    id: 'fs.rename',
    label: 'Rename Node',
    recordHistory: false,
    async execute(_currentState, args) {
      if (!isRecord(args) || typeof args.nodeId !== 'string' || typeof args.newName !== 'string') {
        throw new Error('fs.rename expects args: { nodeId, newName }');
      }
      const oldNode = await vfs.getNode(projectId, args.nodeId);
      const oldName = oldNode?.name ?? '';
      const node = await vfs.rename(projectId, args.nodeId, args.newName);
      eventBus.emit('fs:nodeRenamed', { nodeId: args.nodeId, oldName, newName: args.newName });
      eventBus.emit('fs:treeChanged', undefined);
      return node;
    },
  });

  commands.register({
    id: 'fs.move',
    label: 'Move Node',
    recordHistory: false,
    async execute(_currentState, args) {
      if (!isRecord(args) || typeof args.nodeId !== 'string') {
        throw new Error('fs.move expects args: { nodeId, newParentId }');
      }
      const oldNode = await vfs.getNode(projectId, args.nodeId);
      const oldParentId = oldNode?.parentId ?? null;
      const newParentId = typeof args.newParentId === 'string' ? args.newParentId : null;
      const afterNodeId = 'afterNodeId' in args
        ? (args.afterNodeId as string | null)
        : undefined;
      const node = await vfs.move(projectId, args.nodeId, newParentId, afterNodeId);
      eventBus.emit('fs:nodeMoved', { nodeId: args.nodeId, oldParentId, newParentId });
      eventBus.emit('fs:treeChanged', undefined);
      return node;
    },
  });

  commands.register({
    id: 'fs.refreshTree',
    label: 'Refresh File Tree',
    recordHistory: false,
    async execute() {
      const nodes = await vfs.listTree(projectId);
      eventBus.emit('fs:treeChanged', undefined);
      return nodes;
    },
  });

  commands.register({
    id: 'fs.readFile',
    label: 'Read File',
    recordHistory: false,
    async execute(_currentState, args) {
      if (!isRecord(args) || typeof args.fileId !== 'string') {
        throw new Error('fs.readFile expects args: { fileId }');
      }
      return vfs.readFile(projectId, args.fileId);
    },
  });

  commands.register({
    id: 'fs.writeFile',
    label: 'Write File',
    recordHistory: false,
    async execute(_currentState, args) {
      if (!isRecord(args) || typeof args.fileId !== 'string' || !isRecord(args.content)) {
        throw new Error('fs.writeFile expects args: { fileId, content }');
      }
      await vfs.writeFile(projectId, args.fileId, args.content);
    },
  });

  commands.register({
    id: 'fs.listTree',
    label: 'List File Tree',
    recordHistory: false,
    async execute() {
      return vfs.listTree(projectId);
    },
  });
}

function registerTabCommands(
  state: EditorState,
  history: History<EditorStateSnapshot>,
  commands: CommandManager,
  eventBus: EventBus<EditorEventMap>,
  tabManager: TabManager,
  sessions: DocumentSessionManager,
  vfs?: VirtualFileSystemAdapter,
  projectId?: string,
): void {
  const ensureSessionForTab = (tab: TabState) => {
    const existing = sessions.getSession(tab.fileId);
    if (existing) return existing;
    // Session not yet initialised — this should only happen during
    // workspace hydration where content is loaded separately.
    return undefined;
  };
  const getSessionSnapshot = (fileId: string) => {
    const tab = tabManager.getTab(fileId);
    if (tab) {
      ensureSessionForTab(tab);
    }
    return sessions.getSession(fileId);
  };

  const syncRendererTabCache = (fileId: string): void => {
    const session = sessions.getSession(fileId);
    if (!session) {
      return;
    }
    tabManager.updateTab(fileId, {
      isDirty: session.dirty,
    });
  };

  const restoreEditorForTab = async (tab: TabState): Promise<void> => {
    const session = getSessionSnapshot(tab.fileId);
    if (!session) {
      throw new Error(`Document session not found: ${tab.fileId}`);
    }

    // Restore per-tab history snapshot if available
    const savedHistory = tabManager.getHistorySnapshot(tab.fileId);
    const previousFileId = state.getCurrentFileId();

    if (session.owner === 'renderer') {
      const snapshot: EditorStateSnapshot = {
        schema: createEmptySchema(),
        currentFileId: tab.fileId,
        isDirty: session.dirty,
        canUndo: false,
        canRedo: false,
      };
      state.restoreSnapshot(snapshot);
      if (savedHistory) {
        history.importSnapshot(savedHistory as ReturnType<typeof history.exportSnapshot>);
      } else {
        history.clear(state.getSnapshot());
      }
      state.setHistoryFlags(history.canUndo(), history.canRedo());
      if (previousFileId !== tab.fileId) {
        eventBus.emit('file:currentChanged', { fileId: tab.fileId });
      }
      eventBus.emit('schema:changed', { schema: snapshot.schema });
      return;
    }

    validatePageSchema(session.workingContent);
    const snapshot: EditorStateSnapshot = {
      schema: session.workingContent as PageSchema,
      currentFileId: tab.fileId,
      isDirty: session.dirty,
      ...(tab.selectedNodeId ? { selectedNodeId: tab.selectedNodeId } : {}),
      canUndo: false,
      canRedo: false,
    };
    state.restoreSnapshot(snapshot);
    if (savedHistory) {
      history.importSnapshot(savedHistory as ReturnType<typeof history.exportSnapshot>);
    } else {
      history.clear(state.getSnapshot());
    }
    state.setHistoryFlags(history.canUndo(), history.canRedo());
    if (previousFileId !== tab.fileId) {
      eventBus.emit('file:currentChanged', { fileId: tab.fileId });
    }
    eventBus.emit('schema:changed', { schema: snapshot.schema });
  };

  const syncEditorStateToTab = (tab: TabState, currentState: EditorState): void => {
    const snapshot = currentState.getSnapshot();
    const session = getSessionSnapshot(tab.fileId);
    if (!session) {
      return;
    }

    // Save per-tab history snapshot before switching away
    tabManager.saveHistorySnapshot(tab.fileId, history.exportSnapshot());

    if (session.owner === 'renderer') {
      sessions.markDirty(tab.fileId, snapshot.isDirty);
      tabManager.updateTab(tab.fileId, {
        isDirty: snapshot.isDirty,
      });
      return;
    }
    const schema = currentState.getSchema();
    sessions.updateWorkingContent(tab.fileId, schema, snapshot.isDirty);
    tabManager.updateTab(tab.fileId, {
      selectedNodeId: snapshot.selectedNodeId,
      isDirty: snapshot.isDirty,
    });
  };

  const restoreEmptyEditor = async (): Promise<void> => {
    const previousFileId = state.getCurrentFileId();
    const snapshot: EditorStateSnapshot = {
      schema: createEmptySchema(),
      isDirty: false,
      canUndo: false,
      canRedo: false,
    };
    state.restoreSnapshot(snapshot);
    history.clear(state.getSnapshot());
    state.setHistoryFlags(false, false);
    if (previousFileId) {
      eventBus.emit('file:currentChanged', {});
    }
    eventBus.emit('schema:changed', { schema: snapshot.schema });
  };

  commands.register({
    id: 'tab.open',
    label: 'Open Tab',
    recordHistory: false,
    async execute(currentState, args) {
      if (!isRecord(args) || typeof args.fileId !== 'string') {
        throw new Error('tab.open expects args: { fileId }');
      }
      const fileId = args.fileId;
      const existingTab = tabManager.getTab(fileId);

      if (existingTab) {
        const currentTab = tabManager.getActiveTab();
        if (currentTab && currentTab.fileId !== fileId) {
          syncEditorStateToTab(currentTab, currentState);
        }
        await restoreEditorForTab(existingTab);
        tabManager.activateTab(fileId);
        eventBus.emit('tab:activated', { fileId });
        return;
      }

      if (!vfs || !projectId) {
        throw new Error('VFS not configured, cannot open tab');
      }
      const content = await vfs.readFile(projectId, fileId);

      const node = await vfs.getNode(projectId, fileId);
      if (!node) {
        throw new Error(`File node not found: ${fileId}`);
      }
      const fileType = node.fileType ?? 'page';
      validateFileContent(fileType, content);
      const session = sessions.ensureSession({
        fileId,
        fileType,
        content,
      });

      const currentTab = tabManager.getActiveTab();
      if (currentTab) {
        syncEditorStateToTab(currentTab, currentState);
      }

      tabManager.openTab(fileId, {
        filePath: node.path,
        fileType,
        fileName: node.name,
        isDirty: session.dirty,
      });
      await restoreEditorForTab(tabManager.getTab(fileId)!);
      eventBus.emit('tab:opened', { fileId });
      eventBus.emit('tab:activated', { fileId });
    },
  });

  commands.register({
    id: 'tab.close',
    label: 'Close Tab',
    recordHistory: false,
    async execute(currentState, args) {
      if (!isRecord(args) || typeof args.fileId !== 'string') {
        throw new Error('tab.close expects args: { fileId }');
      }
      const fileId = args.fileId;
      const wasActive = tabManager.getActiveTabId() === fileId;

      tabManager.closeTab(fileId);
      sessions.removeSession(fileId);
      eventBus.emit('tab:closed', { fileId });

      if (wasActive) {
        const nextTab = tabManager.getActiveTab();
        if (nextTab) {
          await restoreEditorForTab(nextTab);
          eventBus.emit('tab:activated', { fileId: nextTab.fileId });
        } else {
          await restoreEmptyEditor();
        }
      }
    },
  });

  commands.register({
    id: 'tab.activate',
    label: 'Activate Tab',
    recordHistory: false,
    async execute(currentState, args) {
      if (!isRecord(args) || typeof args.fileId !== 'string') {
        throw new Error('tab.activate expects args: { fileId }');
      }
      const fileId = args.fileId;
      const tab = tabManager.getTab(fileId);
      if (!tab) return;

      const currentTab = tabManager.getActiveTab();
      if (currentTab && currentTab.fileId !== fileId) {
        syncEditorStateToTab(currentTab, currentState);
      }

      await restoreEditorForTab(tab);
      tabManager.activateTab(fileId);
      eventBus.emit('tab:activated', { fileId });
    },
  });

  commands.register({
    id: 'tab.syncState',
    label: 'Sync Tab State',
    recordHistory: false,
    async execute(_currentState, args) {
      const incomingFileId = extractFileIdFromArgs(args);
      const existingTab = tabManager.getTab(incomingFileId);
      if (!existingTab) {
        return { synced: false };
      }
      const {
        fileId,
        schema,
        selectedNodeId,
        isDirty,
        isGenerating,
        readOnlyReason,
        generationUpdatedAt,
      } = extractTabSyncStateArgs(args, existingTab.fileType);
      const session = getSessionSnapshot(fileId);
      if (!session) {
        return { synced: false };
      }
      if (schema !== undefined) {
        sessions.updateWorkingContent(fileId, schema, isDirty ?? session.dirty);
      } else if (typeof isDirty === 'boolean') {
        sessions.markDirty(fileId, isDirty);
      }

      const patch: Partial<Omit<TabState, 'fileId'>> = {
        ...(selectedNodeId !== undefined ? { selectedNodeId } : {}),
        ...(isDirty !== undefined ? { isDirty } : {}),
        ...(isGenerating !== undefined ? { isGenerating } : {}),
        ...(Object.prototype.hasOwnProperty.call(args as object, 'readOnlyReason')
          ? { readOnlyReason }
          : {}),
        ...(generationUpdatedAt !== undefined ? { generationUpdatedAt } : {}),
      };
      tabManager.updateTab(fileId, patch);

      const dirtyChanged = typeof isDirty === 'boolean' && existingTab.isDirty !== isDirty;
      const syncedTab = tabManager.getTab(fileId);
      if (!syncedTab) {
        return { synced: false };
      }
      if (session.owner === 'renderer') {
        syncRendererTabCache(fileId);
      }

      if (tabManager.getActiveTabId() === fileId) {
        // Lightweight state refresh for the active tab — do NOT call
        // restoreEditorForTab here, as that would clear/import history.
        // tab.syncState is an incremental update, not a tab switch.
        if (session.owner !== 'renderer' && schema !== undefined) {
          state.restoreSnapshot({
            ...state.getSnapshot(),
            schema: schema as PageSchema,
            isDirty: isDirty ?? session.dirty,
            ...(selectedNodeId !== undefined ? { selectedNodeId } : {}),
          });
        } else if (typeof isDirty === 'boolean') {
          state.setDirty(isDirty);
        }
      }

      if (dirtyChanged) {
        eventBus.emit('tab:dirtyChanged', { fileId, isDirty });
      }
      eventBus.emit('tab:stateChanged', {
        fileId,
        isDirty: syncedTab.isDirty,
        ...(syncedTab.isGenerating !== undefined ? { isGenerating: syncedTab.isGenerating } : {}),
        ...(syncedTab.readOnlyReason ? { readOnlyReason: syncedTab.readOnlyReason } : {}),
        ...(syncedTab.generationUpdatedAt !== undefined ? { generationUpdatedAt: syncedTab.generationUpdatedAt } : {}),
      });
      return { synced: true };
    },
  });

  commands.register({
    id: 'tab.closeOthers',
    label: 'Close Other Tabs',
    recordHistory: false,
    async execute(currentState, args) {
      if (!isRecord(args) || typeof args.fileId !== 'string') {
        throw new Error('tab.closeOthers expects args: { fileId }');
      }
      const fileId = args.fileId;
      const closedIds = tabManager.getTabs()
        .map((t) => t.fileId)
        .filter((id) => id !== fileId);

      const currentActiveId = tabManager.getActiveTabId();
      if (currentActiveId === fileId) {
        syncEditorStateToTab({ ...tabManager.getTab(fileId)!, fileId }, currentState);
      }

      tabManager.closeOtherTabs(fileId);
      for (const closedId of closedIds) {
        sessions.removeSession(closedId);
      }

      for (const closedId of closedIds) {
        eventBus.emit('tab:closed', { fileId: closedId });
      }

      if (currentActiveId !== fileId) {
        const tab = tabManager.getTab(fileId);
        if (tab) {
          await restoreEditorForTab(tab);
          eventBus.emit('tab:activated', { fileId });
        }
      }
    },
  });

  commands.register({
    id: 'tab.closeAll',
    label: 'Close All Tabs',
    recordHistory: false,
    async execute(currentState) {
      const closedIds = tabManager.getTabs().map((t) => t.fileId);
      tabManager.closeAllTabs();
      for (const closedId of closedIds) {
        sessions.removeSession(closedId);
      }
      for (const closedId of closedIds) {
        eventBus.emit('tab:closed', { fileId: closedId });
      }
      await restoreEmptyEditor();
    },
  });

  commands.register({
    id: 'tab.closeSaved',
    label: 'Close Saved Tabs',
    recordHistory: false,
    async execute(currentState) {
      const currentActiveTab = tabManager.getActiveTab();
      if (currentActiveTab) {
        syncEditorStateToTab(currentActiveTab, currentState);
      }

      const previousActiveId = tabManager.getActiveTabId();
      const closedIds = tabManager.getTabs()
        .filter((tab) => !tab.isDirty)
        .map((tab) => tab.fileId);

      tabManager.closeSavedTabs();

      for (const closedId of closedIds) {
        eventBus.emit('tab:closed', { fileId: closedId });
      }

      const nextActiveTab = tabManager.getActiveTab();
      if (!nextActiveTab) {
        await restoreEmptyEditor();
        return;
      }

      if (nextActiveTab.fileId !== previousActiveId) {
        await restoreEditorForTab(nextActiveTab);
        eventBus.emit('tab:activated', { fileId: nextActiveTab.fileId });
      }
    },
  });

  commands.register({
    id: 'tab.save',
    label: 'Save Current Tab',
    recordHistory: false,
    async execute(currentState, args) {
      const activeTab = tabManager.getActiveTab();
      if (!activeTab) {
        throw new Error('No active tab to save');
      }

      if (!vfs || !projectId) {
        throw new Error('VFS not configured, cannot save tab');
      }

      const source = isRecord(args) && args.source === 'auto' ? 'auto' : 'manual';
      const session = getSessionSnapshot(activeTab.fileId);
      if (!session) {
        throw new Error(`Document session not found: ${activeTab.fileId}`);
      }
      let content = session.workingContent;
      if (session.owner === 'page-editor') {
        content = currentState.getSchema();
        sessions.updateWorkingContent(activeTab.fileId, content, currentState.getIsDirty());
      }
      await vfs.writeFile(projectId, activeTab.fileId, content);
      sessions.replacePersistedContent(activeTab.fileId, content);
      tabManager.markDirty(activeTab.fileId, false);
      if (session.owner === 'page-editor') {
        currentState.setDirty(false);
      }
      eventBus.emit('tab:dirtyChanged', { fileId: activeTab.fileId, isDirty: false });
      eventBus.emit('file:saved', { fileId: activeTab.fileId, source });
    },
  });
}

export function createEditor(options: CreateEditorOptions = {}): EditorInstance {
  const initialSchema = options.initialSchema ?? createEmptySchema();
  const state = new EditorState(initialSchema);
  const sessions = new DocumentSessionManager();
  const history = new History<EditorStateSnapshot>(
    state.getSnapshot(),
    options.historyMaxSize === undefined ? {} : { maxSize: options.historyMaxSize },
  );
  const eventBus = new EventBus<EditorEventMap>();
  const commands = new CommandManager(state, history, eventBus);
  const fileStorage = options.vfs && options.projectId
    ? createVFSFileStorageAdapter(options.vfs, options.projectId)
    : options.fileStorage ?? new MemoryFileStorageAdapter();

  registerBuiltinCommands(state, history, commands, eventBus, fileStorage);

  if (options.vfs && options.projectId) {
    registerVFSCommands(commands, eventBus, options.vfs, options.projectId, options.tabManager);
  }

  const tabManager = options.tabManager;
  if (tabManager) {
    registerTabCommands(state, history, commands, eventBus, tabManager, sessions, options.vfs, options.projectId);
  }

  const unsubscribeState = tabManager
    ? state.subscribe((snapshot) => {
      const activeTabId = tabManager.getActiveTabId();
      if (!activeTabId) {
        return;
      }
      // During a tab switch, tabManager.activeTabId is already set to the
      // new tab but EditorState still holds the *previous* tab's data.
      // Skip the update when the active tab doesn't match the editor's
      // current file — restoreEditorForTab will set the correct state soon.
      if (snapshot.currentFileId && activeTabId !== snapshot.currentFileId) {
        return;
      }
      const activeTab = tabManager.getTab(activeTabId);
      if (!activeTab) {
        return;
      }
      const activeSession = sessions.getSession(activeTabId);
      if (!activeSession) {
        return;
      }

      // Only sync dirty state and history flags back to TabManager.
      // Schema and selectedNodeId are synced explicitly within commands.
      if (activeSession.owner === 'renderer') {
        if (activeTab.isDirty !== snapshot.isDirty) {
          sessions.markDirty(activeTabId, snapshot.isDirty);
          tabManager.updateTab(activeTabId, {
            isDirty: snapshot.isDirty,
          });
        }
        return;
      }

      // For page-editor tabs, sync dirty + selectedNodeId + DocumentSession
      // (commands modify EditorState, and we need TabManager + session in sync)
      if (
        activeTab.selectedNodeId === snapshot.selectedNodeId
        && activeTab.isDirty === snapshot.isDirty
      ) {
        // Still update DocumentSession even if tab metadata unchanged
        sessions.updateWorkingContent(activeTabId, snapshot.schema, snapshot.isDirty);
        return;
      }
      sessions.updateWorkingContent(activeTabId, snapshot.schema, snapshot.isDirty);
      tabManager.updateTab(activeTabId, {
        selectedNodeId: snapshot.selectedNodeId,
        isDirty: snapshot.isDirty,
      });
    })
    : undefined;

  return {
    state,
    history,
    commands,
    eventBus,
    tabManager,
    destroy() {
      unsubscribeState?.();
      eventBus.clear();
    },
  };
}
