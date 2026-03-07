import { mergeContributions, } from './contributions';
export function defineEditorPlugin(plugin) {
    return plugin;
}
export function collectPluginContributes(plugins) {
    const activityBarItems = [];
    const sidebarTabs = [];
    const inspectorTabs = [];
    const auxiliaryPanels = [];
    const menus = [];
    const contextMenus = [];
    const commands = [];
    const shortcuts = [];
    for (const plugin of plugins ?? []) {
        const contributes = plugin.contributes;
        if (!contributes) {
            continue;
        }
        activityBarItems.push(...(contributes.activityBarItems ?? []));
        sidebarTabs.push(...(contributes.sidebarTabs ?? []));
        inspectorTabs.push(...(contributes.inspectorTabs ?? []));
        auxiliaryPanels.push(...(contributes.auxiliaryPanels ?? []));
        menus.push(...(contributes.menus ?? []));
        contextMenus.push(...(contributes.contextMenus ?? []));
        commands.push(...(contributes.commands ?? []));
        shortcuts.push(...(contributes.shortcuts ?? []));
    }
    return {
        activityBarItems: mergeContributions([], activityBarItems),
        sidebarTabs: mergeContributions([], sidebarTabs),
        inspectorTabs: mergeContributions([], inspectorTabs),
        auxiliaryPanels: mergeContributions([], auxiliaryPanels),
        menus: mergeContributions([], menus),
        contextMenus: mergeContributions([], contextMenus),
        commands: mergeContributions([], commands),
        shortcuts: mergeContributions([], shortcuts),
    };
}
