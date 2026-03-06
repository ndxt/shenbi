import type { PageSchema, SchemaNode } from '@shenbi/schema';
import {
  mergeContributions,
  type ActivityBarItemContribution,
  type InspectorTabContribution,
  type SidebarTabContribution,
} from './contributions';

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
  commands?: PluginCommandContribution[];
  shortcuts?: PluginShortcutContribution[];
}

export interface PluginNotifications {
  info?: (message: string) => void;
  success?: (message: string) => void;
  warning?: (message: string) => void;
  error?: (message: string) => void;
}

export interface PluginContext {
  getSchema?: () => PageSchema;
  replaceSchema?: (schema: PageSchema) => void;
  getSelectedNode?: () => SchemaNode | undefined;
  patchNodeProps?: (patch: Record<string, unknown>) => void;
  patchNodeColumns?: (columns: unknown[]) => void;
  patchNodeStyle?: (patch: Record<string, unknown>) => void;
  patchNodeEvents?: (patch: Record<string, unknown>) => void;
  patchNodeLogic?: (patch: Record<string, unknown>) => void;
  executeCommand?: (commandId: string, payload?: unknown) => void | Promise<void>;
  notify?: PluginNotifications;
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
    commands.push(...(contributes.commands ?? []));
    shortcuts.push(...(contributes.shortcuts ?? []));
  }

  return {
    activityBarItems: mergeContributions([], activityBarItems),
    sidebarTabs: mergeContributions([], sidebarTabs),
    inspectorTabs: mergeContributions([], inspectorTabs),
    commands: mergeContributions([], commands),
    shortcuts: mergeContributions([], shortcuts),
  };
}
