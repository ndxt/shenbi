import type { PageSchema, SchemaNode } from '@shenbi/schema';
import { CommandManager } from './command';
import { EditorState } from './editor-state';
import { EventBus } from './event-bus';
import { History } from './history';
import type { EditorEventMap, EditorStateSnapshot } from './types';
import { LocalFileStorageAdapter, type FileStorageAdapter, type FileType } from './adapters/file-storage';
import type { VirtualFileSystemAdapter } from './adapters/virtual-fs';
import { TabManager } from './tab-manager';
import {
  appendSchemaNode,
  insertSchemaNodeAt,
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
      const content = isRecord(args.content) ? args.content : { id: 'page', name: args.name, body: [] };
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
  vfs?: VirtualFileSystemAdapter,
  projectId?: string,
): void {
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
        // Save current active tab state before switching
        const currentTab = tabManager.getActiveTab();
        if (currentTab && currentTab.fileId !== fileId) {
          tabManager.updateTab(currentTab.fileId, {
            schema: currentState.getSchema(),
            selectedNodeId: currentState.getSnapshot().selectedNodeId,
            isDirty: currentState.getSnapshot().isDirty,
          });
        }

        tabManager.activateTab(fileId);
        // Restore tab state to editor
        await commands.execute('schema.restore', {
          schema: existingTab.schema,
          isDirty: existingTab.isDirty,
        });
        history.clear(state.getSnapshot());
        currentState.setCurrentFileId(fileId);
        eventBus.emit('tab:activated', { fileId });
        return;
      }

      // Read file content
      let schema: PageSchema;
      if (vfs && projectId) {
        const content = await vfs.readFile(projectId, fileId);
        schema = content as PageSchema;
      } else {
        throw new Error('VFS not configured, cannot open tab');
      }

      const node = await vfs.getNode(projectId, fileId);
      if (!node) {
        throw new Error(`File node not found: ${fileId}`);
      }

      // Save current active tab state before switching
      const currentTab = tabManager.getActiveTab();
      if (currentTab) {
        tabManager.updateTab(currentTab.fileId, {
          schema: currentState.getSchema(),
          selectedNodeId: currentState.getSnapshot().selectedNodeId,
          isDirty: currentState.getSnapshot().isDirty,
        });
      }

      tabManager.openTab(fileId, {
        filePath: node.path,
        fileType: node.fileType ?? 'page',
        fileName: node.name,
        schema,
        isDirty: false,
      });

      // Restore schema to editor
      await commands.execute('schema.restore', { schema, isDirty: false });
      history.clear(state.getSnapshot());
      currentState.setCurrentFileId(fileId);
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
      eventBus.emit('tab:closed', { fileId });

      if (wasActive) {
        const nextTab = tabManager.getActiveTab();
        if (nextTab) {
          await commands.execute('schema.restore', {
            schema: nextTab.schema,
            isDirty: nextTab.isDirty,
          });
          history.clear(state.getSnapshot());
          currentState.setCurrentFileId(nextTab.fileId);
          eventBus.emit('tab:activated', { fileId: nextTab.fileId });
        } else {
          // No tabs left, reset to empty
          const emptySchema: PageSchema = { id: 'page', name: 'page', body: [] };
          await commands.execute('schema.restore', { schema: emptySchema, isDirty: false });
          history.clear(state.getSnapshot());
          currentState.setCurrentFileId(undefined);
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

      // Save current active tab state
      const currentTab = tabManager.getActiveTab();
      if (currentTab && currentTab.fileId !== fileId) {
        tabManager.updateTab(currentTab.fileId, {
          schema: currentState.getSchema(),
          selectedNodeId: currentState.getSnapshot().selectedNodeId,
          isDirty: currentState.getSnapshot().isDirty,
        });
      }

      tabManager.activateTab(fileId);
      await commands.execute('schema.restore', {
        schema: tab.schema,
        isDirty: tab.isDirty,
      });
      history.clear(state.getSnapshot());
      currentState.setCurrentFileId(fileId);
      eventBus.emit('tab:activated', { fileId });
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

      // Save current editor state to the surviving tab if it's active
      const currentActiveId = tabManager.getActiveTabId();
      if (currentActiveId === fileId) {
        tabManager.updateTab(fileId, {
          schema: currentState.getSchema(),
          selectedNodeId: currentState.getSnapshot().selectedNodeId,
          isDirty: currentState.getSnapshot().isDirty,
        });
      }

      tabManager.closeOtherTabs(fileId);

      for (const closedId of closedIds) {
        eventBus.emit('tab:closed', { fileId: closedId });
      }

      // If the surviving tab wasn't the active one, restore its state
      if (currentActiveId !== fileId) {
        const tab = tabManager.getTab(fileId);
        if (tab) {
          await commands.execute('schema.restore', {
            schema: tab.schema,
            isDirty: tab.isDirty,
          });
          history.clear(state.getSnapshot());
          currentState.setCurrentFileId(fileId);
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
        eventBus.emit('tab:closed', { fileId: closedId });
      }
      const emptySchema: PageSchema = { id: 'page', name: 'page', body: [] };
      await commands.execute('schema.restore', { schema: emptySchema, isDirty: false });
      history.clear(state.getSnapshot());
      currentState.setCurrentFileId(undefined);
    },
  });

  commands.register({
    id: 'tab.save',
    label: 'Save Current Tab',
    recordHistory: false,
    async execute(currentState) {
      const activeTab = tabManager.getActiveTab();
      if (!activeTab) return;

      if (!vfs || !projectId) {
        throw new Error('VFS not configured, cannot save tab');
      }

      const schema = currentState.getSchema();
      await vfs.writeFile(projectId, activeTab.fileId, schema);
      tabManager.updateTab(activeTab.fileId, { schema });
      tabManager.markDirty(activeTab.fileId, false);
      currentState.setDirty(false);
      eventBus.emit('tab:dirtyChanged', { fileId: activeTab.fileId, isDirty: false });
      eventBus.emit('file:saved', { fileId: activeTab.fileId });
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

  if (options.vfs && options.projectId) {
    registerVFSCommands(commands, eventBus, options.vfs, options.projectId, options.tabManager);
  }

  const tabManager = options.tabManager;
  if (tabManager) {
    registerTabCommands(state, history, commands, eventBus, tabManager, options.vfs, options.projectId);
  }

  return {
    state,
    history,
    commands,
    eventBus,
    tabManager,
    destroy() {
      eventBus.clear();
    },
  };
}
