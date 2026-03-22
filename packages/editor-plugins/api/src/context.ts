import type { PageSchema, SchemaNode } from '@shenbi/schema';

export interface PluginCommandService {
  execute: (commandId: string, payload?: unknown) => unknown | Promise<unknown>;
}

export interface PluginWorkspaceService {
  getWorkspaceId: () => string;
}

export interface PluginPersistenceService {
  getJSON: <T>(namespace: string, key: string) => Promise<T | undefined>;
  setJSON: <T>(namespace: string, key: string, value: T) => Promise<void>;
  remove: (namespace: string, key: string) => Promise<void>;
}

export interface PluginNotifications {
  info?: (message: string) => void;
  success?: (message: string) => void;
  warning?: (message: string) => void;
  error?: (message: string) => void;
}

export interface PluginSelectionService {
  getSelectedNode?: () => SchemaNode | undefined;
  getSelectedNodeId?: () => string | undefined;
  subscribe?: (listener: (selectedNodeId: string | undefined) => void) => () => void;
}

export interface PluginDocumentPatchService {
  props?: (patch: Record<string, unknown>) => void;
  columns?: (columns: unknown[]) => void;
  style?: (patch: Record<string, unknown>) => void;
  events?: (patch: Record<string, unknown>) => void;
  logic?: (patch: Record<string, unknown>) => void;
}

export interface PluginDocumentService {
  getSchema?: () => PageSchema;
  replaceSchema?: (schema: PageSchema) => void;
  patchSelectedNode?: PluginDocumentPatchService;
  subscribe?: (listener: (schema: PageSchema) => void) => () => void;
}

export interface PluginFileSystemService {
  createFile(name: string, fileType: string, content: Record<string, unknown>, parentId?: string): Promise<string>;
  readFile(fileId: string): Promise<Record<string, unknown>>;
  writeFile(fileId: string, content: Record<string, unknown>): Promise<void>;
}

export interface PluginContext {
  commands?: PluginCommandService;
  document?: PluginDocumentService;
  selection?: PluginSelectionService;
  workspace?: PluginWorkspaceService;
  persistence?: PluginPersistenceService;
  notifications?: PluginNotifications;
  filesystem?: PluginFileSystemService;
}

export function getPluginDocumentAccess(context: PluginContext) {
  return {
    getSchema: () => context.document?.getSchema?.(),
    replaceSchema: (schema: PageSchema) => {
      if (context.document?.replaceSchema) {
        context.document.replaceSchema(schema);
        return true;
      }
      return false;
    },
    patchSelectedNode: context.document?.patchSelectedNode,
    subscribe: (listener: (schema: PageSchema) => void) => context.document?.subscribe?.(listener),
  };
}

export function getPluginSelectionAccess(context: PluginContext) {
  return {
    getSelectedNode: () => context.selection?.getSelectedNode?.(),
    getSelectedNodeId: () => context.selection?.getSelectedNodeId?.() ?? context.selection?.getSelectedNode?.()?.id,
    subscribe: (listener: (selectedNodeId: string | undefined) => void) => context.selection?.subscribe?.(listener),
  };
}

export function getPluginCommandAccess(context: PluginContext) {
  return {
    canExecute: () => Boolean(context.commands?.execute),
    execute: (commandId: string, payload?: unknown) => (
      context.commands?.execute(commandId, payload)
    ),
  };
}

export function getPluginFeedbackAccess(context: PluginContext) {
  return {
    notifications: context.notifications,
  };
}

export function getPluginWorkspaceAccess(context: PluginContext) {
  return {
    getWorkspaceId: () => context.workspace?.getWorkspaceId(),
  };
}

export function getPluginStorageAccess(context: PluginContext) {
  return {
    persistence: context.persistence,
    filesystem: context.filesystem,
  };
}
