import type React from 'react';
import type { ComponentContract, SchemaNode } from '@shenbi/schema';
import type { PluginContext } from './context';

export interface OrderedContribution {
  id: string;
  order?: number;
}

export function mergeContributions<T extends OrderedContribution>(
  builtin: readonly T[],
  extensions?: readonly T[],
): T[] {
  const merged = new Map<string, T>();
  for (const item of builtin) {
    merged.set(item.id, item);
  }
  for (const item of extensions ?? []) {
    merged.set(item.id, item);
  }
  return [...merged.values()].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
}

export type ActivityBarSection = 'main' | 'bottom';

export type ActivityBarTarget =
  | { type: 'panel'; panelId: string }
  | { type: 'action' }
  | { type: 'tab'; tabId: string };

export interface ActivityBarItemIconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export interface ActivityBarItemContribution extends OrderedContribution {
  label: string;
  icon: React.ComponentType<ActivityBarItemIconProps>;
  active?: boolean;
  section?: ActivityBarSection;
  target?: ActivityBarTarget;
  /** @deprecated Use target instead. */
  targetSidebarTabId?: string;
  onClick?: () => void;
}

export interface SchemaTreeNode {
  id: string;
  type: string;
  name?: string;
  children?: SchemaTreeNode[];
  isHidden?: boolean;
}

export interface SidebarTabRenderContext {
  contracts?: ComponentContract[];
  treeNodes?: SchemaTreeNode[];
  selectedNodeId?: string;
  onSelectNode?: (nodeId: string) => void;
  onInsertComponent?: (componentType: string) => void;
  onStartDragComponent?: (componentType: string) => void;
  onEndDragComponent?: () => void;
  pluginContext?: PluginContext;
}

export interface SidebarTabContribution extends OrderedContribution {
  label: string;
  render: (context: SidebarTabRenderContext) => React.ReactNode;
}

export interface PrimaryPanelContribution extends OrderedContribution {
  label: string;
  render: (context: SidebarTabRenderContext) => React.ReactNode;
}

export interface FileContextPanelRenderContext extends SidebarTabRenderContext {
  activeFileId?: string;
  activeFileName?: string;
  activeFileType?: string;
}

export interface FileContextPanelContribution extends OrderedContribution {
  label: string;
  fileTypes?: string[];
  defaultActive?: boolean;
  render: (context: FileContextPanelRenderContext) => React.ReactNode;
}

export interface InspectorTabRenderContext {
  selectedNode?: SchemaNode;
  contract?: ComponentContract;
  onPatchProps?: (patch: Record<string, unknown>) => void;
  onPatchColumns?: (columns: unknown[]) => void;
  onPatchStyle?: (patch: Record<string, unknown>) => void;
  onPatchEvents?: (patch: Record<string, unknown>) => void;
  onPatchLogic?: (patch: Record<string, unknown>) => void;
  pluginContext?: PluginContext;
}

export interface InspectorTabContribution extends OrderedContribution {
  label: string;
  render: (context: InspectorTabRenderContext) => React.ReactNode;
}

export interface AuxiliaryPanelContribution extends OrderedContribution {
  label: string;
  defaultOpen?: boolean;
  defaultWidth?: number;
  render: (context: PluginContext) => React.ReactNode;
}

export interface MenuContribution extends OrderedContribution {
  label: string;
  commandId: string;
  when?: string;
  enabledWhen?: string;
  section?: 'primary' | 'secondary';
  target?: 'toolbar-start' | 'toolbar-end';
  group?: string;
}

export type ContextMenuArea = 'canvas' | 'sidebar' | 'inspector' | 'activity-bar';

export interface ContextMenuContribution extends OrderedContribution {
  label: string;
  commandId: string;
  when?: string;
  enabledWhen?: string;
  area?: ContextMenuArea;
  group?: string;
}
