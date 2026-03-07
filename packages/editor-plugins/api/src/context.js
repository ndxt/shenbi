export function getPluginSchema(context) {
    return context.document?.getSchema?.() ?? context.getSchema?.();
}
export function getPluginDocumentPatchService(context) {
    if (context.document?.patchSelectedNode) {
        return context.document.patchSelectedNode;
    }
    if (context.patchNodeProps
        || context.patchNodeColumns
        || context.patchNodeStyle
        || context.patchNodeEvents
        || context.patchNodeLogic) {
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
export function replacePluginSchema(context, schema) {
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
export function getPluginSelectedNode(context) {
    return context.selection?.getSelectedNode?.() ?? context.getSelectedNode?.();
}
export function getPluginSelectedNodeId(context) {
    return context.selection?.getSelectedNodeId?.() ?? getPluginSelectedNode(context)?.id;
}
export function executePluginCommand(context, commandId, payload) {
    return context.commands?.execute(commandId, payload) ?? context.executeCommand?.(commandId, payload);
}
export function getPluginNotifications(context) {
    return context.notifications ?? context.notify;
}
