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

export interface CanvasRendererRenderContext {
  activeFileId?: string;
  activeFileName?: string;
  activeFileType?: string;
  pluginContext?: PluginContext;
  /** The actual page content to render inside the canvas surface */
  children?: React.ReactNode;
  /** Render mode: 'direct' DOM or 'iframe' isolation */
  renderMode?: 'direct' | 'iframe';
  /** Current theme name (e.g. 'light', 'dark') */
  theme?: string;
  /** Whether the canvas is read-only */
  canvasReadOnly?: boolean;
  /** Callback when a node is selected on the canvas */
  onSelectNode?: (nodeId: string) => void;
  /** Callback when the canvas selection is cleared */
  onDeselectNode?: () => void;
  /** Currently selected node schema ID */
  selectedNodeSchemaId?: string;
  /** Currently selected node tree ID */
  selectedNodeTreeId?: string;
  /** Currently hovered node schema ID */
  hoveredNodeSchemaId?: string | null;
  /** Breadcrumb ancestor items for the selection overlay */
  breadcrumbItems?: Array<{ id: string; label: string }>;
  /** Callback when a breadcrumb ancestor is selected */
  onBreadcrumbSelect?: (nodeId: string) => void;
  /** Callback when a breadcrumb ancestor is hovered */
  onBreadcrumbHover?: (nodeId: string | null) => void;
  /** Check if a drop target can accept children */
  canCanvasDropInsideNode?: (nodeSchemaId: string) => boolean;
  /** Callback when a component is inserted via drag-drop */
  onInsertComponent?: (componentType: string, target: unknown) => void;
  /** Callback when the selected node is moved via drag-drop */
  onMoveSelectedNode?: (target: unknown) => void;
  /** Whether the selected node can be deleted */
  canDeleteSelectedNode?: boolean;
  /** Whether the selected node can be duplicated */
  canDuplicateSelectedNode?: boolean;
  /** Whether the selected node can be moved up */
  canMoveSelectedNodeUp?: boolean;
  /** Whether the selected node can be moved down */
  canMoveSelectedNodeDown?: boolean;
  /** Selection overlay action buttons */
  selectionOverlayActions?: Array<{
    id: string;
    title: string;
    icon?: React.ReactNode;
    disabled?: boolean;
    onRun?: () => void;
  }>;
  /** Handler for pointer-based node selection on the canvas surface */
  onSurfacePointerSelection?: (target: EventTarget | null) => void;
  /** CSS class for the canvas cursor (e.g. 'cursor-grabbing', 'canvas-cursor-grab') */
  canvasCursorClassName?: string;
  /** Callback when the CanvasSurface is ready */
  onCanvasSurfaceReady?: (surface: unknown) => void;
  /** Callback when the canvas context menu is opened */
  onCanvasContextMenu?: (event: React.MouseEvent) => void;
  /** Callback for sidebar drag component start */
  onSidebarStartDragComponent?: (componentType: string) => void;
  /** Callback for sidebar drag component end */
  onSidebarEndDragComponent?: () => void;
  /** Current active canvas tool mode (e.g. 'select', 'pan') */
  activeCanvasTool?: string;
  /** Callback to change the active canvas tool mode */
  setActiveCanvasTool?: (mode: string) => void;
}

export interface CanvasRendererContribution extends OrderedContribution {
  /** File types this renderer handles (e.g. ['api']) */
  fileTypes: string[];
  render: (context: CanvasRendererRenderContext) => React.ReactNode;
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
