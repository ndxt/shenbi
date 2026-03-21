import {
  type AuxiliaryPanelContribution,
  type CanvasRendererContribution,
  type ContextMenuContribution,
  type FileContextPanelContribution,
  type MenuContribution,
  mergeContributions,
  type ActivityBarItemContribution,
  type InspectorTabContribution,
  type PrimaryPanelContribution,
  type SidebarTabContribution,
} from './contributions';
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
  primaryPanels?: PrimaryPanelContribution[];
  fileContextPanels?: FileContextPanelContribution[];
  sidebarTabs?: SidebarTabContribution[];
  inspectorTabs?: InspectorTabContribution[];
  auxiliaryPanels?: AuxiliaryPanelContribution[];
  canvasRenderers?: CanvasRendererContribution[];
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
  primaryPanels: PrimaryPanelContribution[];
  fileContextPanels: FileContextPanelContribution[];
  sidebarTabs: SidebarTabContribution[];
  inspectorTabs: InspectorTabContribution[];
  auxiliaryPanels: AuxiliaryPanelContribution[];
  canvasRenderers: CanvasRendererContribution[];
  menus: MenuContribution[];
  contextMenus: ContextMenuContribution[];
  commands: PluginCommandContribution[];
  shortcuts: PluginShortcutContribution[];
}

export function defineEditorPlugin(plugin: EditorPluginManifest): EditorPluginManifest {
  return plugin;
}

export function collectPluginContributes(
  plugins?: readonly EditorPluginManifest[],
): ResolvedPluginContributes {
  const activityBarItems: ActivityBarItemContribution[] = [];
  const primaryPanels: PrimaryPanelContribution[] = [];
  const fileContextPanels: FileContextPanelContribution[] = [];
  const sidebarTabs: SidebarTabContribution[] = [];
  const inspectorTabs: InspectorTabContribution[] = [];
  const auxiliaryPanels: AuxiliaryPanelContribution[] = [];
  const canvasRenderers: CanvasRendererContribution[] = [];
  const menus: MenuContribution[] = [];
  const contextMenus: ContextMenuContribution[] = [];
  const commands: PluginCommandContribution[] = [];
  const shortcuts: PluginShortcutContribution[] = [];

  for (const plugin of plugins ?? []) {
    const contributes = plugin.contributes;
    if (!contributes) {
      continue;
    }
    activityBarItems.push(...(contributes.activityBarItems ?? []));
    primaryPanels.push(...(contributes.primaryPanels ?? []));
    fileContextPanels.push(...(contributes.fileContextPanels ?? []));
    sidebarTabs.push(...(contributes.sidebarTabs ?? []));
    inspectorTabs.push(...(contributes.inspectorTabs ?? []));
    auxiliaryPanels.push(...(contributes.auxiliaryPanels ?? []));
    canvasRenderers.push(...(contributes.canvasRenderers ?? []));
    menus.push(...(contributes.menus ?? []));
    contextMenus.push(...(contributes.contextMenus ?? []));
    commands.push(...(contributes.commands ?? []));
    shortcuts.push(...(contributes.shortcuts ?? []));
  }

  return {
    activityBarItems: mergeContributions([], activityBarItems),
    primaryPanels: mergeContributions([], primaryPanels),
    fileContextPanels: mergeContributions([], fileContextPanels),
    sidebarTabs: mergeContributions([], sidebarTabs),
    inspectorTabs: mergeContributions([], inspectorTabs),
    auxiliaryPanels: mergeContributions([], auxiliaryPanels),
    canvasRenderers: mergeContributions([], canvasRenderers),
    menus: mergeContributions([], menus),
    contextMenus: mergeContributions([], contextMenus),
    commands: mergeContributions([], commands),
    shortcuts: mergeContributions([], shortcuts),
  };
}
