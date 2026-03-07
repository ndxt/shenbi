import { type AuxiliaryPanelContribution, type ContextMenuContribution, type MenuContribution, type ActivityBarItemContribution, type InspectorTabContribution, type SidebarTabContribution } from './contributions';
import type { PluginContext } from './context';
export interface PluginCommandContribution {
    id: string;
    title: string;
    category?: string;
    description?: string;
    aliases?: string[];
    keywords?: string[];
    order?: number;
    when?: string;
    enabledWhen?: string;
    execute: (context: PluginContext, payload?: unknown) => void | Promise<void>;
}
export interface PluginShortcutContribution {
    id: string;
    commandId: string;
    keybinding: string;
    order?: number;
    priority?: number;
    when?: string;
}
export type EditorPluginCleanup = () => void;
export type EditorPluginActivateResult = void | EditorPluginCleanup | Promise<void | EditorPluginCleanup>;
export interface PluginContributes {
    activityBarItems?: ActivityBarItemContribution[];
    sidebarTabs?: SidebarTabContribution[];
    inspectorTabs?: InspectorTabContribution[];
    auxiliaryPanels?: AuxiliaryPanelContribution[];
    menus?: MenuContribution[];
    contextMenus?: ContextMenuContribution[];
    commands?: PluginCommandContribution[];
    shortcuts?: PluginShortcutContribution[];
}
export interface EditorPluginManifest {
    id: string;
    name: string;
    version?: string;
    contributes?: PluginContributes;
    activate?: (context: PluginContext) => EditorPluginActivateResult;
}
export interface ResolvedPluginContributes {
    activityBarItems: ActivityBarItemContribution[];
    sidebarTabs: SidebarTabContribution[];
    inspectorTabs: InspectorTabContribution[];
    auxiliaryPanels: AuxiliaryPanelContribution[];
    menus: MenuContribution[];
    contextMenus: ContextMenuContribution[];
    commands: PluginCommandContribution[];
    shortcuts: PluginShortcutContribution[];
}
export declare function defineEditorPlugin(plugin: EditorPluginManifest): EditorPluginManifest;
export declare function collectPluginContributes(plugins?: readonly EditorPluginManifest[]): ResolvedPluginContributes;
//# sourceMappingURL=plugin.d.ts.map