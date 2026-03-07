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
export declare function getPluginSchema(context: PluginContext): PageSchema | undefined;
export declare function getPluginDocumentPatchService(context: PluginContext): PluginDocumentPatchService | undefined;
export declare function replacePluginSchema(context: PluginContext, schema: PageSchema): boolean;
export declare function getPluginSelectedNode(context: PluginContext): SchemaNode | undefined;
export declare function getPluginSelectedNodeId(context: PluginContext): string | undefined;
export declare function executePluginCommand(context: PluginContext, commandId: string, payload?: unknown): unknown | Promise<unknown> | undefined;
export declare function getPluginNotifications(context: PluginContext): PluginNotifications | undefined;
//# sourceMappingURL=context.d.ts.map