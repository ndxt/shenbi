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
  onClick?: () => void;
}

export interface SchemaTreeNode {
  id: string;
  type: string;
  name?: string;
  children?: SchemaTreeNode[];
  isHidden?: boolean;
}

interface FileContributionContext {
  id?: string | undefined;
  name?: string | undefined;
  type?: string | undefined;
}

interface PluginEnvironmentContext {
  pluginContext?: PluginContext;
}

interface SidebarTabSelectionContext {
  treeNodes?: SchemaTreeNode[];
  selectedNodeId?: string | undefined;
  onSelectNode?: ((nodeId: string) => void) | undefined;
}

interface SidebarTabCommandsContext {
  onInsertComponent?: ((componentType: string) => void) | undefined;
  onStartDragComponent?: ((componentType: string) => void) | undefined;
  onEndDragComponent?: (() => void) | undefined;
}

interface SidebarTabEnvironmentContext extends PluginEnvironmentContext {
  contracts?: ComponentContract[];
}

export interface SidebarTabRenderContext {
  file?: FileContributionContext;
  selection: SidebarTabSelectionContext;
  commands: SidebarTabCommandsContext;
  environment: SidebarTabEnvironmentContext;
}

interface LabeledRenderContribution<TContext> extends OrderedContribution {
  label: string;
  render: (context: TContext) => React.ReactNode;
}

export type SidebarTabContribution = LabeledRenderContribution<SidebarTabRenderContext>;

export type PrimaryPanelContribution = LabeledRenderContribution<SidebarTabRenderContext>;

export interface FileContextPanelContribution extends LabeledRenderContribution<SidebarTabRenderContext> {
  fileTypes?: string[];
  defaultActive?: boolean;
}

interface InspectorTabSelectionContext {
  selectedNode?: SchemaNode;
  contract?: ComponentContract;
}

interface InspectorTabEditingContext {
  onPatchProps?: ((patch: Record<string, unknown>) => void) | undefined;
  onPatchColumns?: ((columns: unknown[]) => void) | undefined;
  onPatchStyle?: ((patch: Record<string, unknown>) => void) | undefined;
  onPatchEvents?: ((patch: Record<string, unknown>) => void) | undefined;
  onPatchLogic?: ((patch: Record<string, unknown>) => void) | undefined;
}

export interface InspectorTabRenderContext {
  selection: InspectorTabSelectionContext;
  editing: InspectorTabEditingContext;
}

export type InspectorTabContribution = LabeledRenderContribution<InspectorTabRenderContext>;

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

interface CanvasRendererSelectionContext {
  onSelectNode?: ((nodeId: string) => void) | undefined;
  onDeselectNode?: (() => void) | undefined;
  selectedNodeSchemaId?: string | undefined;
  selectedNodeTreeId?: string | undefined;
  hoveredNodeSchemaId?: string | null | undefined;
  breadcrumbItems?: Array<{ id: string; label: string }> | undefined;
  onBreadcrumbSelect?: ((nodeId: string) => void) | undefined;
  onBreadcrumbHover?: ((nodeId: string | null) => void) | undefined;
}

interface CanvasRendererEditingContext {
  canDropInsideNode?: ((nodeSchemaId: string) => boolean) | undefined;
  onInsertComponent?: ((componentType: string, target: unknown) => void) | undefined;
  onMoveSelectedNode?: ((target: unknown) => void) | undefined;
  canDeleteSelectedNode?: boolean | undefined;
  canDuplicateSelectedNode?: boolean | undefined;
  canMoveSelectedNodeUp?: boolean | undefined;
  canMoveSelectedNodeDown?: boolean | undefined;
}

interface CanvasRendererOverlayContext {
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

interface CanvasRendererInteractionContext {
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

interface CanvasRendererSurfaceContext {
  /** The actual page content to render inside the canvas surface */
  children?: React.ReactNode;
  /** Render mode: 'direct' DOM or 'iframe' isolation */
  renderMode?: 'direct' | 'iframe';
  /** Current theme name (e.g. 'light', 'dark') */
  theme?: string;
  /** Whether the canvas is read-only */
  readOnly?: boolean;
}

export interface CanvasRendererDocumentContext {
  /** Notify the host that the document's dirty state changed */
  markDirty: (dirty: boolean) => void;
  /** Register callback for host-initiated save (Ctrl+S). Returns unsubscribe. */
  onSaveRequest: (callback: () => void) => (() => void);
  /** Register callback for host-initiated undo (Ctrl+Z). Returns unsubscribe. */
  onUndoRequest: (callback: () => void) => (() => void);
  /** Register callback for host-initiated redo (Ctrl+Y). Returns unsubscribe. */
  onRedoRequest: (callback: () => void) => (() => void);
  /** Report undo/redo availability to the host UI (toolbar buttons) */
  reportUndoRedoState: (state: { canUndo: boolean; canRedo: boolean }) => void;
}

export interface CanvasRendererRenderContext {
  file: FileContributionContext;
  surface: CanvasRendererSurfaceContext;
  environment: PluginEnvironmentContext;
  canvasHost: CanvasRendererHostContext;
  /** Document lifecycle hooks — save, undo/redo, dirty tracking */
  document?: CanvasRendererDocumentContext;
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
