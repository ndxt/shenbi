import type { PageSchema } from '@shenbi/schema';
import type { FSNodeMetadata } from './adapters/file-storage';

export interface Disposable {
  dispose(): void;
}

export interface EditorStateSnapshot {
  schema: PageSchema;
  selectedNodeId?: string;
  currentFileId?: string;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

export interface EditorEventMap {
  'node:selected': { nodeId: string };
  'node:deselected': { nodeId: string };
  'schema:changed': { schema: PageSchema };
  'command:executed': { commandId: string };
  'history:pushed': void;
  'history:undo': void;
  'history:redo': void;
  'plugin:activated': { pluginId: string };
  'file:currentChanged': { fileId?: string };
  'file:opened': { fileId: string };
  'file:saved': { fileId: string; source?: 'manual' | 'auto' };
  'file:deleted': { fileId: string };

  // File system events
  'fs:nodeCreated': { node: FSNodeMetadata };
  'fs:nodeDeleted': { nodeId: string; path: string };
  'fs:nodeRenamed': { nodeId: string; oldName: string; newName: string };
  'fs:nodeMoved': { nodeId: string; oldParentId: string | null; newParentId: string | null };
  'fs:treeChanged': undefined;

  // Tab events
  'tab:opened': { fileId: string };
  'tab:closed': { fileId: string };
  'tab:activated': { fileId: string };
  'tab:dirtyChanged': { fileId: string; isDirty: boolean };
  'tab:stateChanged': {
    fileId: string;
    isDirty: boolean;
    isGenerating?: boolean;
    readOnlyReason?: string;
    generationUpdatedAt?: number;
  };
}
