import {
  type AuxiliaryPanelContribution,
  mergeContributions,
  type ActivityBarItemContribution,
  type InspectorTabContribution,
  type SidebarTabContribution,
} from './contributions';
import type { PluginContext } from './context';

export interface PluginCommandContribution {
  id: string;
  title: string;
  order?: number;
  execute: (context: PluginContext, payload?: unknown) => void | Promise<void>;
}

export interface PluginShortcutContribution {
  id: string;
  commandId: string;
  keybinding: string;
  order?: number;
  when?: string;
}

export interface PluginContributes {
  activityBarItems?: ActivityBarItemContribution[];
  sidebarTabs?: SidebarTabContribution[];
  inspectorTabs?: InspectorTabContribution[];
  auxiliaryPanels?: AuxiliaryPanelContribution[];
  commands?: PluginCommandContribution[];
  shortcuts?: PluginShortcutContribution[];
}

export interface EditorPluginManifest {
  id: string;
  name: string;
  version?: string;
  contributes?: PluginContributes;
  activate?: (
    context: PluginContext,
  ) => void | (() => void) | Promise<void | (() => void)>;
}

export interface ResolvedPluginContributes {
  activityBarItems: ActivityBarItemContribution[];
  sidebarTabs: SidebarTabContribution[];
  inspectorTabs: InspectorTabContribution[];
  auxiliaryPanels: AuxiliaryPanelContribution[];
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
  const sidebarTabs: SidebarTabContribution[] = [];
  const inspectorTabs: InspectorTabContribution[] = [];
  const auxiliaryPanels: AuxiliaryPanelContribution[] = [];
  const commands: PluginCommandContribution[] = [];
  const shortcuts: PluginShortcutContribution[] = [];

  for (const plugin of plugins ?? []) {
    const contributes = plugin.contributes;
    if (!contributes) {
      continue;
    }
    activityBarItems.push(...(contributes.activityBarItems ?? []));
    sidebarTabs.push(...(contributes.sidebarTabs ?? []));
    inspectorTabs.push(...(contributes.inspectorTabs ?? []));
    auxiliaryPanels.push(...(contributes.auxiliaryPanels ?? []));
    commands.push(...(contributes.commands ?? []));
    shortcuts.push(...(contributes.shortcuts ?? []));
  }

  return {
    activityBarItems: mergeContributions([], activityBarItems),
    sidebarTabs: mergeContributions([], sidebarTabs),
    inspectorTabs: mergeContributions([], inspectorTabs),
    auxiliaryPanels: mergeContributions([], auxiliaryPanels),
    commands: mergeContributions([], commands),
    shortcuts: mergeContributions([], shortcuts),
  };
}
