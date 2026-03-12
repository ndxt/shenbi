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

  // Backward-compatible aliases during migration.
  /** @deprecated Use document.getSchema instead. */
  getSchema?: () => PageSchema;
  /** @deprecated Use document.replaceSchema instead. */
  replaceSchema?: (schema: PageSchema) => void;
  /** @deprecated Use selection.getSelectedNode instead. */
  getSelectedNode?: () => SchemaNode | undefined;
  /** @deprecated Use document.patchSelectedNode.props instead. */
  patchNodeProps?: (patch: Record<string, unknown>) => void;
  /** @deprecated Use document.patchSelectedNode.columns instead. */
  patchNodeColumns?: (columns: unknown[]) => void;
  /** @deprecated Use document.patchSelectedNode.style instead. */
  patchNodeStyle?: (patch: Record<string, unknown>) => void;
  /** @deprecated Use document.patchSelectedNode.events instead. */
  patchNodeEvents?: (patch: Record<string, unknown>) => void;
  /** @deprecated Use document.patchSelectedNode.logic instead. */
  patchNodeLogic?: (patch: Record<string, unknown>) => void;
  /** @deprecated Use commands.execute instead. */
  executeCommand?: (commandId: string, payload?: unknown) => unknown | Promise<unknown>;
  /** @deprecated Use notifications instead. */
  notify?: PluginNotifications;
}

export function getPluginSchema(context: PluginContext): PageSchema | undefined {
  return context.document?.getSchema?.() ?? context.getSchema?.();
}

export function getPluginDocumentPatchService(context: PluginContext): PluginDocumentPatchService | undefined {
  if (context.document?.patchSelectedNode) {
    return context.document.patchSelectedNode;
  }
  if (
    context.patchNodeProps
    || context.patchNodeColumns
    || context.patchNodeStyle
    || context.patchNodeEvents
    || context.patchNodeLogic
  ) {
    return {
      ...(context.patchNodeProps ? { props: context.patchNodeProps } : {}),
      ...(context.patchNodeColumns ? { columns: context.patchNodeColumns } : {}),
      ...(context.patchNodeStyle ? { style: context.patchNodeStyle } : {}),
      ...(context.patchNodeEvents ? { events: context.patchNodeEvents } : {}),
      ...(context.patchNodeLogic ? { logic: context.patchNodeLogic } : {}),
    };
  }
  return undefined;
}

export function replacePluginSchema(context: PluginContext, schema: PageSchema): boolean {
  if (context.document?.replaceSchema) {
    context.document.replaceSchema(schema);
    return true;
  }
  if (context.replaceSchema) {
    context.replaceSchema(schema);
    return true;
  }
  return false;
}

export function getPluginSelectedNode(context: PluginContext): SchemaNode | undefined {
  return context.selection?.getSelectedNode?.() ?? context.getSelectedNode?.();
}

export function getPluginSelectedNodeId(context: PluginContext): string | undefined {
  return context.selection?.getSelectedNodeId?.() ?? getPluginSelectedNode(context)?.id;
}

export function executePluginCommand(
  context: PluginContext,
  commandId: string,
  payload?: unknown,
): unknown | Promise<unknown> | undefined {
  return context.commands?.execute(commandId, payload) ?? context.executeCommand?.(commandId, payload);
}

export function getPluginNotifications(context: PluginContext): PluginNotifications | undefined {
  return context.notifications ?? context.notify;
}

export function getPluginWorkspaceId(context: PluginContext): string | undefined {
  return context.workspace?.getWorkspaceId();
}

export function getPluginPersistence(context: PluginContext): PluginPersistenceService | undefined {
  return context.persistence;
}
