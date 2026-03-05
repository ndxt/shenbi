import type { PageSchema } from '@shenbi/schema';

export interface Disposable {
  dispose(): void;
}

export interface EditorStateSnapshot {
  schema: PageSchema;
  selectedNodeId?: string;
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
  'file:opened': { fileId: string };
  'file:saved': { fileId: string };
}
