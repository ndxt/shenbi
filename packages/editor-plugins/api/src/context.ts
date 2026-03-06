import type { PageSchema, SchemaNode } from '@shenbi/schema';

export interface PluginCommandService {
  execute: (commandId: string, payload?: unknown) => unknown | Promise<unknown>;
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

export interface PluginContext {
  commands?: PluginCommandService;
  document?: PluginDocumentService;
  selection?: PluginSelectionService;
  notifications?: PluginNotifications;

  // Backward-compatible aliases during migration.
  getSchema?: () => PageSchema;
  replaceSchema?: (schema: PageSchema) => void;
  getSelectedNode?: () => SchemaNode | undefined;
  patchNodeProps?: (patch: Record<string, unknown>) => void;
  patchNodeColumns?: (columns: unknown[]) => void;
  patchNodeStyle?: (patch: Record<string, unknown>) => void;
  patchNodeEvents?: (patch: Record<string, unknown>) => void;
  patchNodeLogic?: (patch: Record<string, unknown>) => void;
  executeCommand?: (commandId: string, payload?: unknown) => unknown | Promise<unknown>;
  notify?: PluginNotifications;
}

export function getPluginSchema(context: PluginContext): PageSchema | undefined {
  return context.document?.getSchema?.() ?? context.getSchema?.();
}

export function replacePluginSchema(context: PluginContext, schema: PageSchema): void {
  context.document?.replaceSchema?.(schema);
  if (!context.document?.replaceSchema) {
    context.replaceSchema?.(schema);
  }
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
