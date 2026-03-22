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

export interface CanvasRendererHostRuntime {
  zoomIn?: (() => void) | undefined;
  zoomOut?: (() => void) | undefined;
  resetZoom?: (() => void) | undefined;
  fitCanvas?: (() => void) | undefined;
  centerCanvas?: (() => void) | undefined;
  focusSelection?: (() => void) | undefined;
  getScale?: (() => number) | undefined;
  startSidebarDragComponent?: ((componentType: string) => void) | undefined;
  endSidebarDragComponent?: (() => void) | undefined;
  isSpacePanActive?: (() => boolean) | undefined;
  isCanvasPanning?: (() => boolean) | undefined;
  hasCanvasDragSession?: (() => boolean) | undefined;
}

export interface CanvasRendererSelectionContext {
  onSelectNode?: ((nodeId: string) => void) | undefined;
  onDeselectNode?: (() => void) | undefined;
  selectedNodeSchemaId?: string | undefined;
  selectedNodeTreeId?: string | undefined;
  hoveredNodeSchemaId?: string | null | undefined;
  breadcrumbItems?: Array<{ id: string; label: string }> | undefined;
  onBreadcrumbSelect?: ((nodeId: string) => void) | undefined;
  onBreadcrumbHover?: ((nodeId: string | null) => void) | undefined;
}

export interface CanvasRendererEditingContext {
  canDropInsideNode?: ((nodeSchemaId: string) => boolean) | undefined;
  onInsertComponent?: ((componentType: string, target: unknown) => void) | undefined;
  onMoveSelectedNode?: ((target: unknown) => void) | undefined;
  canDeleteSelectedNode?: boolean | undefined;
  canDuplicateSelectedNode?: boolean | undefined;
  canMoveSelectedNodeUp?: boolean | undefined;
  canMoveSelectedNodeDown?: boolean | undefined;
}

export interface CanvasRendererOverlayContext {
  selectionActions?: Array<{
    id: string;
    title: string;
    icon?: React.ReactNode;
    disabled?: boolean;
    onRun?: () => void;
  }> | undefined;
  onSurfacePointerSelection?: ((target: EventTarget | null) => void) | undefined;
  cursorClassName?: string | undefined;
  onSurfaceReady?: ((surface: unknown) => void) | undefined;
  onContextMenu?: ((event: React.MouseEvent) => void) | undefined;
}

export interface CanvasRendererInteractionContext {
  activeTool?: string | undefined;
  setActiveTool?: ((mode: string) => void) | undefined;
  onRuntimeReady?: ((runtime: CanvasRendererHostRuntime | null) => void) | undefined;
}

export interface CanvasRendererHostContext {
  selection: CanvasRendererSelectionContext;
  editing: CanvasRendererEditingContext;
  overlay: CanvasRendererOverlayContext;
  interaction: CanvasRendererInteractionContext;
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
  canvasHost: CanvasRendererHostContext;
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
