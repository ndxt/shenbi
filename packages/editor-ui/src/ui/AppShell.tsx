import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Monitor,
  Smartphone,
  Tablet,
  Trash2,
} from 'lucide-react';
import {
  collectPluginContributes,
  type ContextMenuArea,
  type EditorPluginActivateResult,
  type EditorPluginCleanup,
  type EditorPluginManifest,
  type PluginContext,
} from '@shenbi/editor-plugin-api';
import type { TabState } from '@shenbi/editor-core';
import { ActivityBar } from './ActivityBar';
import { SelectionOverlay, type SelectionOverlayAction } from './SelectionOverlay';
import { Sidebar } from './Sidebar';
import { WorkbenchToolbar } from './WorkbenchToolbar';
import { EditorTabs } from './EditorTabs';
import { Inspector } from './Inspector';
import { AIPanel, type AIPanelProps } from './AIPanel';
import { CommandPalette, type CommandPaletteItem } from './CommandPalette';
import { ContextMenuOverlay, type ContextMenuItem } from './ContextMenuOverlay';
import { Console } from './Console';
import { StatusBar } from './StatusBar';
import { resolvePrimaryPanels, type PrimaryPanelContribution } from './primary-panels';
import '../styles/editor-ui.css';
import { useResize } from '../hooks/useResize';
import {
  createWorkspacePersistenceService,
  LocalWorkspacePersistenceAdapter,
  WORKSPACE_LAYOUT_NAMESPACE,
  WORKSPACE_PREFERENCES_NAMESPACE,
  WORKSPACE_WORKBENCH_KEY,
  type WorkspacePersistenceAdapter,
} from '../persistence/workspace-persistence';
import {
  evaluateShortcutWhen,
  evaluateWhenExpression,
  findMatchingShortcut,
  getShortcutEventContext,
} from '../shortcuts/shortcut-manager';
import {
  createHostCommandRegistry,
  hostCommandsToContextMenus,
  hostCommandsToMenus,
  hostCommandsToShortcuts,
} from '../commands/host-command-registry';
import {
  changeLanguage,
  detectBrowserLocale,
  useCurrentLocale,
  useTranslation,
  type SupportedLocale,
} from '@shenbi/i18n';

import { TitleBar } from './TitleBar';
import type { ActivityBarItemContribution, ActivityBarProps } from './ActivityBar';
import type { SidebarProps } from './Sidebar';
import type { InspectorProps } from './Inspector';
import type { ToolbarMenuItem } from './ToolbarMenus';
import { resolveActivityBarItems } from './activitybar-items';
import { CanvasSurface } from '../canvas/CanvasSurface';
import { resolveNodeDropIndicator, type CanvasDropIndicator } from '../canvas/drop-indicator';
import type {
  CanvasDropTarget,
  CanvasSurfaceHandle,
  CanvasToolMode,
  CanvasViewportState,
} from '../canvas/types';
import {
  STAGE_DEFAULT_WIDTH,
  STAGE_MIN_HEIGHT,
  MIN_CANVAS_SCALE,
  MAX_CANVAS_SCALE,
  CANVAS_ZOOM_PRESETS,
  CANVAS_WHEEL_ZOOM_SENSITIVITY,
  DEVICE_FRAME_PADDING,
  type DevicePreset,
} from '../canvas/constants';
import { createBuiltinSidebarTabs } from './sidebar-tabs';
import { CanvasToolRail } from './CanvasToolRail';
import { CanvasZoomHud } from './CanvasZoomHud';
import { DevicePreviewBar } from './DevicePreviewBar';

interface AppShellProps {
  children: React.ReactNode;
  workspaceId: string;
  renderMode?: 'direct' | 'iframe';
  canvasReadOnly?: boolean;
  toolbarExtra?: React.ReactNode;
  activityBarProps?: ActivityBarProps;
  sidebarProps?: SidebarProps;
  inspectorProps?: InspectorProps;
  aiPanelProps?: AIPanelProps;
  plugins?: EditorPluginManifest[];
  pluginContext?: PluginContext;
  persistenceAdapter?: WorkspacePersistenceAdapter;
  onCanvasSelectNode?: (nodeId: string) => void;
  /** 点击画布空白区域时取消选中 */
  onCanvasDeselectNode?: () => void;
  selectedNodeTreeId?: string;
  /** 当前选中节点的 schema node id（用于画布选中高亮框） */
  selectedNodeSchemaId?: string;
  canCanvasDropInsideNode?: (nodeSchemaId: string) => boolean;
  onCanvasInsertComponent?: (componentType: string, target: CanvasDropTarget) => void;
  onCanvasMoveSelectedNode?: (target: CanvasDropTarget) => void;
  canDeleteSelectedNode?: boolean;
  canDuplicateSelectedNode?: boolean;
  canMoveSelectedNodeUp?: boolean;
  canMoveSelectedNodeDown?: boolean;
  schemaName?: string | undefined;
  breadcrumbItems?: { id: string; label: string }[];
  /** 面包屑项被点击时回调 */
  onBreadcrumbSelect?: (nodeId: string) => void;
  /** 面包屡项 hover 时回调（传入 tree node ID 或 null） */
  onBreadcrumbHover?: (nodeId: string | null) => void;
  /** 面包屑 hover 对应的 schema node id（用于画布 hover 高亮） */
  hoveredNodeSchemaId?: string | null | undefined;
  /** Multi-tab mode */
  tabs?: TabState[] | undefined;
  activeTabId?: string | undefined;
  onActivateTab?: ((fileId: string) => void) | undefined;
  onCloseTab?: ((fileId: string) => void) | undefined;
  onCloseOtherTabs?: ((fileId: string) => void) | undefined;
  onCloseAllTabs?: (() => void) | undefined;
  onCloseSavedTabs?: (() => void) | undefined;
  onMoveTab?: ((fromIndex: number, toIndex: number) => void) | undefined;
  /** Title displayed in the title bar (defaults to 'Shenbi IDE') */
  title?: string;
  /** Subtitle displayed in the title bar (defaults to 'Editor UI Package') */
  subtitle?: string | undefined;
  /** User avatar URL to show in title bar */
  userAvatarUrl?: string | undefined;
  /** Username to show in title bar */
  userName?: string | undefined;
  /** Branch names for branch switcher */
  branches?: string[] | undefined;
  /** Called when user switches branch */
  onBranchChange?: ((branch: string) => void) | undefined;
  /** Called when user logs out */
  onLogout?: (() => void) | undefined;
  /** GitLab project URL */
  gitlabUrl?: string | undefined;
  /** Called when user clicks project name to open project manager */
  onOpenProjectManager?: (() => void) | undefined;
}

export type ThemeMode = 'light' | 'dark' | 'cursor' | 'webstorm-dark';

const MAX_RECENT_COMMANDS = 6;

const THEME_CLASSES = [
  'theme-light',
  'theme-dark',
  'theme-cursor',
  'theme-webstorm-light',
  'theme-webstorm-dark',
] as const;

const DEVICE_PRESETS: DevicePreset[] = [
  { id: 'phone', label: 'Phone', width: 375, icon: Smartphone, frame: 'phone' },
  { id: 'tablet', label: 'Tablet', width: 768, icon: Tablet, frame: 'tablet' },
  { id: 'desktop', label: 'Desktop', width: 1200, icon: Monitor, frame: 'monitor' },
];

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return Boolean(value) && typeof (value as Promise<unknown>).then === 'function';
}

function isCleanup(value: unknown): value is EditorPluginCleanup {
  return typeof value === 'function';
}

function resolveActivityItemPanelId(
  item: ActivityBarItemContribution,
  panels: PrimaryPanelContribution[],
): string | undefined {
  const targetPanelId = item.target?.type === 'panel'
    ? item.target.panelId
    : item.targetSidebarTabId;
  if (!targetPanelId) {
    return undefined;
  }
  return panels.some((panel) => panel.id === targetPanelId) ? targetPanelId : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isElementTarget(target: EventTarget | null): target is HTMLElement {
  return Boolean(target)
    && typeof (target as Node).nodeType === 'number'
    && (target as Node).nodeType === 1
    && typeof (target as HTMLElement).closest === 'function';
}

function resolveWheelZoomScale(currentScale: number, deltaY: number): number {
  const zoomFactor = Math.exp(-deltaY * CANVAS_WHEEL_ZOOM_SENSITIVITY);
  return clamp(currentScale * zoomFactor, MIN_CANVAS_SCALE, MAX_CANVAS_SCALE);
}

interface StoredLayoutState {
  showSidebar?: boolean;
  showInspector?: boolean;
  showConsole?: boolean;
  showAssistantPanel?: boolean;
  activeAuxiliaryPanelId?: string;
  activePrimaryPanelId?: string;
  showFileContextPanel?: boolean;
  activeFileContextTabId?: string;
  sidebarSize?: number;
  fileContextPanelSize?: number;
  inspectorSize?: number;
  assistantPanelSize?: number;
  consoleSize?: number;
}

interface StoredWorkbenchPreferences {
  theme?: ThemeMode;
  locale?: SupportedLocale;
}

interface CanvasDragSession {
  source: 'component' | 'selected-node';
  componentType?: string;
}

interface ZoomMenuState {
  open: boolean;
}

export function AppShell({
  children,
  workspaceId,
  renderMode = 'direct',
  canvasReadOnly = false,
  toolbarExtra,
  activityBarProps,
  sidebarProps,
  inspectorProps,
  aiPanelProps,
  plugins,
  pluginContext,
  persistenceAdapter,
  onCanvasSelectNode,
  onCanvasDeselectNode,
  selectedNodeTreeId,
  selectedNodeSchemaId,
  canCanvasDropInsideNode,
  onCanvasInsertComponent,
  onCanvasMoveSelectedNode,
  canDeleteSelectedNode,
  canDuplicateSelectedNode,
  canMoveSelectedNodeUp,
  canMoveSelectedNodeDown,
  schemaName,
  breadcrumbItems,
  onBreadcrumbSelect,
  onBreadcrumbHover,
  hoveredNodeSchemaId,
  tabs,
  activeTabId,
  onActivateTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseAllTabs,
  onCloseSavedTabs,
  onMoveTab,
  title,
  subtitle,
  userAvatarUrl,
  userName,
  branches,
  onBranchChange,
  onLogout,
  gitlabUrl,
  onOpenProjectManager,
}: AppShellProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const canvasScrollRef = React.useRef<HTMLElement | null>(null);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const [canvasSurface, setCanvasSurface] = React.useState<CanvasSurfaceHandle | null>(null);
  const [canvasScale, setCanvasScale] = React.useState(1);
  const canvasScaleRef = React.useRef(1);
  canvasScaleRef.current = canvasScale;
  const [stageContentHeight, setStageContentHeight] = React.useState(STAGE_MIN_HEIGHT);
  const stageContentHeightRef = React.useRef(STAGE_MIN_HEIGHT);
  const [activeCanvasTool, setActiveCanvasTool] = React.useState<CanvasToolMode>('select');
  const [activeDeviceId, setActiveDeviceId] = React.useState('desktop');
  const [showDeviceFrame, setShowDeviceFrame] = React.useState(false);
  const [customStageWidth, setCustomStageWidth] = React.useState(STAGE_DEFAULT_WIDTH);
  const activeDevice = DEVICE_PRESETS.find((p) => p.id === activeDeviceId) ?? DEVICE_PRESETS[2]!;
  const stageWidth = activeDeviceId === 'custom' ? customStageWidth : activeDevice.width;
  const stageWidthRef = React.useRef(stageWidth);
  stageWidthRef.current = stageWidth;
  const [canvasViewportState, setCanvasViewportState] = React.useState<CanvasViewportState>({
    scale: 1,
    scrollLeft: 0,
    scrollTop: 0,
    viewportWidth: 0,
    viewportHeight: 0,
  });
  const [isCanvasPanning, setIsCanvasPanning] = React.useState(false);
  const [canvasDragSession, setCanvasDragSession] = React.useState<CanvasDragSession | null>(null);
  const [canvasDropIndicator, setCanvasDropIndicator] = React.useState<CanvasDropIndicator | null>(null);
  const [zoomMenuState, setZoomMenuState] = React.useState<ZoomMenuState>({ open: false });
  const canvasChromeRef = React.useRef<HTMLDivElement | null>(null);
  const zoomMenuRef = React.useRef<HTMLDivElement | null>(null);
  const canvasScaleRafRef = React.useRef<number | null>(null);
  const spacePressedRef = React.useRef(false);
  const [isSpacePressed, setIsSpacePressed] = React.useState(false);
  const panSessionRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
  } | null>(null);
  const panInteractionCleanupRef = React.useRef<(() => void) | null>(null);
  const resolvedPersistenceAdapter = React.useMemo(
    () => persistenceAdapter ?? new LocalWorkspacePersistenceAdapter(),
    [persistenceAdapter],
  );
  const persistence = React.useMemo(
    () => createWorkspacePersistenceService(workspaceId, resolvedPersistenceAdapter),
    [resolvedPersistenceAdapter, workspaceId],
  );
  const [loadedLayoutState, setLoadedLayoutState] = React.useState<StoredLayoutState | null>(null);
  const [layoutHydrated, setLayoutHydrated] = React.useState(false);
  const [preferencesHydrated, setPreferencesHydrated] = React.useState(false);
  const [theme, setTheme] = React.useState<ThemeMode>('dark');
  const currentLocale = useCurrentLocale();
  const currentLocaleRef = React.useRef(currentLocale);
  currentLocaleRef.current = currentLocale;
  const { t } = useTranslation('editorUi');
  
  // Panel Visibility State
  const [showSidebar, setShowSidebar] = React.useState(true);
  const [showInspector, setShowInspector] = React.useState(true);
  const [showConsole, setShowConsole] = React.useState(true);
  const [showAssistantPanel, setShowAssistantPanel] = React.useState(false);
  const [showCommandPalette, setShowCommandPalette] = React.useState(false);
  const [contextMenuState, setContextMenuState] = React.useState<{
    open: boolean;
    area: ContextMenuArea;
    position: { x: number; y: number };
  }>({
    open: false,
    area: 'canvas',
    position: { x: 0, y: 0 },
  });
  const [activePrimaryPanelId, setActivePrimaryPanelId] = React.useState('');
  const [showFileContextPanel, setShowFileContextPanel] = React.useState(true);
  const [activeFileContextTabId, setActiveFileContextTabId] = React.useState('components');
  const [activeActivityItemId, setActiveActivityItemId] = React.useState('');
  const [activeAuxiliaryPanelId, setActiveAuxiliaryPanelId] = React.useState<string | undefined>();
  const [focusVersion, setFocusVersion] = React.useState(0);

  const [isMaximized, setIsMaximized] = React.useState(false);
  const recentCommandIdsRef = React.useRef<string[]>([]);
  const [previousPanelState, setPreviousPanelState] = React.useState({
    sidebar: true,
    inspector: true,
    console: true,
    assistantPanel: false,
  });

  const toggleMaximize = React.useCallback(() => {
    setIsMaximized((prevMaximized) => {
      if (prevMaximized) {
        // Restore previous panel state
        setPreviousPanelState((prev) => {
          setShowSidebar(prev.sidebar);
          setShowInspector(prev.inspector);
          setShowConsole(prev.console);
          setShowAssistantPanel(prev.assistantPanel);
          return prev;
        });
        return false;
      }
      // Save current panel state before maximizing
      setShowSidebar((prev) => { setPreviousPanelState((s) => ({ ...s, sidebar: prev })); return false; });
      setShowInspector((prev) => { setPreviousPanelState((s) => ({ ...s, inspector: prev })); return false; });
      setShowConsole((prev) => { setPreviousPanelState((s) => ({ ...s, console: prev })); return false; });
      setShowAssistantPanel((prev) => { setPreviousPanelState((s) => ({ ...s, assistantPanel: prev })); return false; });
      return true;
    });
  }, []);

  // Panel Size State
  const {
    size: sidebarSize,
    startResize: startSidebarResize,
    setSize: setSidebarSize,
  } = useResize(256, 160, 600);
  const {
    size: inspectorSize,
    startResize: startInspectorResize,
    setSize: setInspectorSize,
  } = useResize(256, 160, 600);
  const {
    size: fileContextPanelSize,
    startResize: startFileContextPanelResize,
    setSize: setFileContextPanelSize,
  } = useResize(256, 180, 600);
  const {
    size: aiPanelSize,
    startResize: startAIPanelResize,
    setSize: setAIPanelSize,
  } = useResize(300, 200, 800);
  const {
    size: consoleSize,
    startResize: startConsoleResize,
    setSize: setConsoleSize,
  } = useResize(192, 100, 800);
  // ---------- Infinite canvas: large static workspace ----------
  // Use a generously-sized workspace so the user can pan far in every direction.
  // Height grows dynamically only when content is very tall.
  const CANVAS_WS_BASE = 20000;  // base workspace dimension
  const CANVAS_WS_STAGE_TOP = 5000;  // stage Y offset inside workspace (lots of room above)

  const canvasWorkspaceWidth = CANVAS_WS_BASE;
  const canvasStageLeft = Math.round((CANVAS_WS_BASE - stageWidth * canvasScale) / 2);

  const canvasWorkspaceHeight = React.useMemo(() => {
    const stageVisualBottom = CANVAS_WS_STAGE_TOP
      + Math.max(stageContentHeight, STAGE_MIN_HEIGHT) * canvasScale;
    // Ensure at least 5000px of scroll space below the stage bottom
    return Math.max(CANVAS_WS_BASE, stageVisualBottom + 5000);
  }, [canvasScale, stageContentHeight]);
  const syncCanvasViewportState = React.useCallback(() => {
    const element = canvasScrollRef.current;
    if (!element) {
      return;
    }
    setCanvasViewportState({
      scale: canvasScale,
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop,
      viewportWidth: element.clientWidth,
      viewportHeight: element.clientHeight,
    });
  }, [canvasScale]);
  React.useEffect(() => () => {
    if (canvasScaleRafRef.current !== null) {
      cancelAnimationFrame(canvasScaleRafRef.current);
    }
  }, []);
  const clearCanvasPanInteractionGuards = React.useCallback(() => {
    panInteractionCleanupRef.current?.();
    panInteractionCleanupRef.current = null;
  }, []);
  const applyCanvasPanInteractionGuards = React.useCallback(() => {
    clearCanvasPanInteractionGuards();

    const canvasElement = canvasScrollRef.current;
    const ownerDocument = canvasSurface?.ownerDocument ?? null;
    const pageRoot = ownerDocument?.querySelector('[data-shenbi-page-root]') as HTMLElement | null;
    const previousPageRootPointerEvents = pageRoot?.style.pointerEvents ?? '';
    const preventNativeInteraction = (event: Event) => {
      event.preventDefault();
    };

    canvasElement?.classList.add('canvas-surface--panning');
    ownerDocument?.documentElement.classList.add('shenbi-canvas-panning');
    ownerDocument?.body.classList.add('shenbi-canvas-panning');
    if (pageRoot) {
      pageRoot.style.pointerEvents = 'none';
    }
    ownerDocument?.addEventListener('dragstart', preventNativeInteraction, true);
    ownerDocument?.addEventListener('selectstart', preventNativeInteraction, true);

    panInteractionCleanupRef.current = () => {
      canvasElement?.classList.remove('canvas-surface--panning');
      ownerDocument?.documentElement.classList.remove('shenbi-canvas-panning');
      ownerDocument?.body.classList.remove('shenbi-canvas-panning');
      if (pageRoot) {
        pageRoot.style.pointerEvents = previousPageRootPointerEvents;
      }
      ownerDocument?.removeEventListener('dragstart', preventNativeInteraction, true);
      ownerDocument?.removeEventListener('selectstart', preventNativeInteraction, true);
    };
  }, [canvasSurface, clearCanvasPanInteractionGuards]);
  React.useEffect(() => () => {
    clearCanvasPanInteractionGuards();
  }, [clearCanvasPanInteractionGuards]);

  const centerCanvasOnStage = React.useCallback((nextScale: number) => {
    const element = canvasScrollRef.current;
    if (!element) {
      return;
    }
    const scaledWidth = stageWidth * nextScale;
    const stageHeight = Math.max(stageContentHeightRef.current, STAGE_MIN_HEIGHT);
    const scaledHeight = stageHeight * nextScale;
    const wsStageLeft = Math.round((CANVAS_WS_BASE - scaledWidth) / 2);
    const nextScrollLeft = Math.max(
      0,
      wsStageLeft + scaledWidth / 2 - element.clientWidth / 2,
    );
    const nextScrollTop = Math.max(
      0,
      CANVAS_WS_STAGE_TOP + scaledHeight / 2 - element.clientHeight / 2,
    );
    element.scrollLeft = nextScrollLeft;
    element.scrollTop = nextScrollTop;
    setCanvasViewportState({
      scale: nextScale,
      scrollLeft: nextScrollLeft,
      scrollTop: nextScrollTop,
      viewportWidth: element.clientWidth,
      viewportHeight: element.clientHeight,
    });
  }, []);

  const updateCanvasScale = React.useCallback((
    nextScaleInput: number,
    anchor?: { clientX: number; clientY: number },
  ) => {
    const element = canvasScrollRef.current;
    const previousScale = canvasScaleRef.current;
    const nextScale = clamp(nextScaleInput, MIN_CANVAS_SCALE, MAX_CANVAS_SCALE);
    if (!element || nextScale === previousScale) {
      canvasScaleRef.current = nextScale;
      setCanvasScale(nextScale);
      return;
    }
    if (canvasScaleRafRef.current !== null) {
      cancelAnimationFrame(canvasScaleRafRef.current);
      canvasScaleRafRef.current = null;
    }

    if (!anchor) {
      canvasScaleRef.current = nextScale;
      setCanvasScale(nextScale);
      canvasScaleRafRef.current = requestAnimationFrame(() => {
        centerCanvasOnStage(nextScale);
        canvasScaleRafRef.current = null;
      });
      return;
    }

    const viewportRect = element.getBoundingClientRect();
    const pointerX = anchor.clientX - viewportRect.left;
    const pointerY = anchor.clientY - viewportRect.top;
    const stageRelativeX = element.scrollLeft + pointerX - canvasStageLeft;
    const stageRelativeY = element.scrollTop + pointerY - CANVAS_WS_STAGE_TOP;
    const scaledX = (stageRelativeX / previousScale) * nextScale;
    const scaledY = (stageRelativeY / previousScale) * nextScale;

    canvasScaleRef.current = nextScale;
    setCanvasScale(nextScale);
    canvasScaleRafRef.current = requestAnimationFrame(() => {
      const nextStageCenterX = Math.round(
        (CANVAS_WS_BASE - stageWidth * nextScale) / 2,
      );
      const nextScrollLeft = nextStageCenterX + scaledX - pointerX;
      const nextScrollTop = CANVAS_WS_STAGE_TOP + scaledY - pointerY;
      element.scrollLeft = Math.max(0, nextScrollLeft);
      element.scrollTop = Math.max(0, nextScrollTop);
      setCanvasViewportState({
        scale: nextScale,
        scrollLeft: element.scrollLeft,
        scrollTop: element.scrollTop,
        viewportWidth: element.clientWidth,
        viewportHeight: element.clientHeight,
      });
      canvasScaleRafRef.current = null;
    });
  }, [canvasStageLeft, centerCanvasOnStage]);

  const zoomCanvasIn = React.useCallback(() => {
    updateCanvasScale(canvasScale + 0.1);
  }, [canvasScale, updateCanvasScale]);

  const zoomCanvasOut = React.useCallback(() => {
    updateCanvasScale(canvasScale - 0.1);
  }, [canvasScale, updateCanvasScale]);

  const resetCanvasZoom = React.useCallback(() => {
    updateCanvasScale(1);
  }, [updateCanvasScale]);

  const fitCanvasToViewport = React.useCallback(() => {
    const element = canvasScrollRef.current;
    if (!element) {
      return;
    }
    const availableWidth = Math.max(element.clientWidth - 160, 320);
    const availableHeight = Math.max(element.clientHeight - 160, 240);
    const nextScale = clamp(
      Math.min(availableWidth / stageWidth, availableHeight / STAGE_MIN_HEIGHT),
      MIN_CANVAS_SCALE,
      MAX_CANVAS_SCALE,
    );
    setCanvasScale(nextScale);
    requestAnimationFrame(() => {
      centerCanvasOnStage(nextScale);
    });
  }, [centerCanvasOnStage]);
  const centerCanvasStage = React.useCallback(() => {
    centerCanvasOnStage(canvasScale);
  }, [canvasScale, centerCanvasOnStage]);
  const focusCanvasSelection = React.useCallback(() => {
    const element = canvasScrollRef.current;
    if (!element || !canvasSurface || !selectedNodeSchemaId) {
      return;
    }

    const selectedElement = canvasSurface.findNodeElement(selectedNodeSchemaId);
    if (!selectedElement) {
      return;
    }

    const rect = canvasSurface.getRelativeRect(selectedElement);
    const nextScrollLeft = canvasStageLeft + (rect.left + rect.width / 2) * canvasScale - element.clientWidth / 2;
    const nextScrollTop = CANVAS_WS_STAGE_TOP + (rect.top + rect.height / 2) * canvasScale - element.clientHeight / 2;
    element.scrollLeft = Math.max(0, nextScrollLeft);
    element.scrollTop = Math.max(0, nextScrollTop);
    syncCanvasViewportState();
  }, [canvasScale, canvasSurface, selectedNodeSchemaId, syncCanvasViewportState]);
  const updateCanvasScalePreset = React.useCallback((nextScale: number) => {
    updateCanvasScale(nextScale);
    setZoomMenuState({ open: false });
  }, [updateCanvasScale]);
  const pluginContributes = React.useMemo(
    () => collectPluginContributes(plugins),
    [plugins],
  );
  const activityItems = React.useMemo(
    () => [
      ...pluginContributes.activityBarItems,
      ...(activityBarProps?.items ?? []),
    ],
    [activityBarProps?.items, pluginContributes.activityBarItems],
  );
  const primaryPanels = React.useMemo(
    () => resolvePrimaryPanels(pluginContributes.primaryPanels),
    [pluginContributes.primaryPanels],
  );
  const resolvedActivityItems = React.useMemo(
    () => resolveActivityBarItems(activityItems),
    [activityItems],
  );
  const defaultActivityItemId = React.useMemo(() => {
    const preferred = resolvedActivityItems.find((item) => item.active)?.id;
    return preferred ?? resolvedActivityItems[0]?.id ?? '';
  }, [resolvedActivityItems]);
  const defaultPrimaryPanelId = React.useMemo(() => {
    const preferredItem = resolvedActivityItems.find((item) => item.id === defaultActivityItemId);
    return (
      (preferredItem ? resolveActivityItemPanelId(preferredItem, primaryPanels) : undefined)
      ?? primaryPanels[0]?.id
      ?? ''
    );
  }, [defaultActivityItemId, primaryPanels, resolvedActivityItems]);
  const activeActivityItem = React.useMemo(
    () => resolvedActivityItems.find((item) => item.id === activeActivityItemId),
    [activeActivityItemId, resolvedActivityItems],
  );
  const activeActivityPanelId = React.useMemo(
    () => (
      activeActivityItem
        ? resolveActivityItemPanelId(activeActivityItem, primaryPanels)
        : undefined
    ),
    [activeActivityItem, primaryPanels],
  );
  const legacySidebarTabs = React.useMemo(
    () => [
      ...createBuiltinSidebarTabs(),
      ...pluginContributes.sidebarTabs,
      ...(sidebarProps?.tabs ?? []),
    ],
    [pluginContributes.sidebarTabs, sidebarProps?.tabs],
  );
  const fileContextLegacyTabs = React.useMemo(
    () => legacySidebarTabs.filter((tab) => !primaryPanels.some((panel) => panel.id === tab.id)),
    [legacySidebarTabs, primaryPanels],
  );
  const inspectorTabs = React.useMemo(
    () => [
      ...pluginContributes.inspectorTabs,
      ...(inspectorProps?.tabs ?? []),
    ],
    [inspectorProps?.tabs, pluginContributes.inspectorTabs],
  );
  const activeEditorTab = React.useMemo(
    () => tabs?.find((tab) => tab.fileId === activeTabId) ?? tabs?.[0],
    [activeTabId, tabs],
  );
  const activeCanvasRenderer = React.useMemo(() => {
    if (!activeEditorTab?.fileType || activeEditorTab.fileType === 'page') {
      return undefined;
    }
    return pluginContributes.canvasRenderers.find(
      (renderer) => renderer.fileTypes.includes(activeEditorTab.fileType),
    );
  }, [activeEditorTab, pluginContributes.canvasRenderers]);
  const fileContextTabs = React.useMemo(() => {
    const fileType = activeEditorTab?.fileType;
    // Show file context panels for page files and for files that have a canvas renderer
    if (!fileType) {
      return [];
    }
    if (fileType !== 'page' && !activeCanvasRenderer) {
      return [];
    }
    const contextualTabs = pluginContributes.fileContextPanels
      .filter((panel) => {
        if (!panel.fileTypes || panel.fileTypes.length === 0) {
          return fileType === 'page';
        }
        return panel.fileTypes.includes(fileType);
      })
      .map((panel) => ({
        id: panel.id,
        label: panel.label,
        ...(panel.order !== undefined ? { order: panel.order } : {}),
        render: (context: Parameters<typeof panel.render>[0]) => panel.render({
          ...context,
          activeFileId: activeEditorTab.fileId,
          activeFileName: activeEditorTab.fileName,
          activeFileType: activeEditorTab.fileType,
        }),
      }));
    if (fileType === 'page') {
      return [...contextualTabs, ...fileContextLegacyTabs];
    }
    return contextualTabs;
  }, [activeEditorTab, activeCanvasRenderer, fileContextLegacyTabs, pluginContributes.fileContextPanels]);
  const activePrimaryPanel = React.useMemo(
    () => (
      activePrimaryPanelId
        ? primaryPanels.find((panel) => panel.id === activePrimaryPanelId)
        : undefined
    ),
    [activePrimaryPanelId, primaryPanels],
  );
  React.useEffect(() => {
    if (!activeActivityItemId) {
      setActiveActivityItemId(defaultActivityItemId);
      return;
    }
    const exists = resolvedActivityItems.some((item) => item.id === activeActivityItemId);
    if (!exists) {
      setActiveActivityItemId(defaultActivityItemId);
    }
  }, [activeActivityItemId, defaultActivityItemId, resolvedActivityItems]);
  React.useEffect(() => {
    if (!activeActivityItemId) {
      setActivePrimaryPanelId(defaultPrimaryPanelId);
      return;
    }
    if (!activeActivityPanelId) {
      if (activePrimaryPanelId !== '') {
        setActivePrimaryPanelId('');
      }
      return;
    }
    if (!activePrimaryPanelId) {
      setActivePrimaryPanelId(activeActivityPanelId);
      return;
    }
    const exists = primaryPanels.some((panel) => panel.id === activePrimaryPanelId);
    if (!exists) {
      setActivePrimaryPanelId(activeActivityPanelId);
    }
  }, [activeActivityItemId, activeActivityPanelId, activePrimaryPanelId, defaultPrimaryPanelId, primaryPanels]);
  React.useEffect(() => {
    if (activeEditorTab?.fileType === 'page' || activeCanvasRenderer) {
      setShowFileContextPanel(true);
    }
  }, [activeEditorTab?.fileType, activeCanvasRenderer]);
  const auxiliaryPanels = React.useMemo(() => {
    const panels = [...pluginContributes.auxiliaryPanels];
    if (aiPanelProps) {
      panels.push({
        id: 'legacy.ai-assistant',
        label: 'AI Assistant',
        order: 1000,
        defaultWidth: 300,
        render: (panelContext) => <AIPanel {...aiPanelProps} pluginContext={panelContext} />,
      });
    }
    return panels.sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  }, [aiPanelProps, pluginContributes.auxiliaryPanels]);
  const activeAuxiliaryPanel = React.useMemo(
    () => auxiliaryPanels.find((panel) => panel.id === activeAuxiliaryPanelId) ?? auxiliaryPanels[0],
    [activeAuxiliaryPanelId, auxiliaryPanels],
  );
  const assistantPanelSize = aiPanelSize;
  const hostCommands = React.useMemo(() => createHostCommandRegistry({
    pluginContext,
    showSidebar,
    showInspector,
    showConsole,
    hasAssistantPanel: auxiliaryPanels.length > 0,
    showAssistantPanel,
    isMaximized,
    setShowSidebar,
    setShowInspector,
    setShowConsole,
    setShowAssistantPanel,
    setShowCommandPalette,
    toggleMaximize,
    zoomCanvasIn,
    zoomCanvasOut,
    resetCanvasZoom,
    fitCanvasToViewport,
    centerCanvasStage,
    focusCanvasSelection,
    activeCanvasTool,
    setActiveCanvasTool,
    hasCanvasSelection: Boolean(selectedNodeSchemaId),
    canvasScale,
    t,
  }), [
    activeCanvasTool,
    canvasScale,
    auxiliaryPanels.length,
    centerCanvasStage,
    fitCanvasToViewport,
    focusCanvasSelection,
    isMaximized,
    pluginContext,
    resetCanvasZoom,
    selectedNodeSchemaId,
    showAssistantPanel,
    showConsole,
    showInspector,
    showSidebar,
    t,
    toggleMaximize,
    zoomCanvasIn,
    zoomCanvasOut,
  ]);
  const hostCommandMap = React.useMemo(
    () => new Map(hostCommands.map((command) => [command.id, command])),
    [hostCommands],
  );
  const pluginCommandMap = React.useMemo(
    () => new Map(pluginContributes.commands.map((command) => [command.id, command])),
    [pluginContributes.commands],
  );
  const hostShortcuts = React.useMemo(
    () => hostCommandsToShortcuts(hostCommands),
    [hostCommands],
  );
  const hostMenus = React.useMemo(
    () => hostCommandsToMenus(hostCommands),
    [hostCommands],
  );
  const hostContextMenus = React.useMemo(
    () => hostCommandsToContextMenus(hostCommands),
    [hostCommands],
  );
  const allShortcuts = React.useMemo(
    () => [...hostShortcuts, ...pluginContributes.shortcuts],
    [hostShortcuts, pluginContributes.shortcuts],
  );
  React.useEffect(() => {
    const syncFocus = () => {
      setFocusVersion((current) => current + 1);
    };
    document.addEventListener('focusin', syncFocus);
    document.addEventListener('focusout', syncFocus);
    window.addEventListener('blur', syncFocus);
    return () => {
      document.removeEventListener('focusin', syncFocus);
      document.removeEventListener('focusout', syncFocus);
      window.removeEventListener('blur', syncFocus);
    };
  }, []);
  const getRuntimeContext = React.useCallback((area?: ContextMenuArea) => {
    const activeElement = document.activeElement;
    const baseContext = getShortcutEventContext(activeElement, rootRef.current, {
      sidebarVisible: showSidebar,
      inspectorVisible: showInspector,
      hasSelection: Boolean(pluginContext?.selection?.getSelectedNodeId?.()),
      hasCanvasSelection: Boolean(selectedNodeSchemaId),
      canCanvasDeleteSelection: canDeleteSelectedNode ?? (Boolean(selectedNodeSchemaId) && !canvasReadOnly),
      canCanvasDuplicateSelection: canDuplicateSelectedNode ?? (Boolean(selectedNodeSchemaId) && !canvasReadOnly),
      canCanvasMoveSelectionUp: canMoveSelectedNodeUp ?? false,
      canCanvasMoveSelectionDown: canMoveSelectedNodeDown ?? false,
      canvasSelectToolActive: activeCanvasTool === 'select',
      canvasPanToolActive: activeCanvasTool === 'pan',
    });
    const paletteInputFocused = Boolean(
      activeElement instanceof Element
      && activeElement.closest('[data-shenbi-command-palette-input="true"]'),
    );
    const isEditorActive = Boolean(
      area
      || !activeElement
      || activeElement === document.body
      || (rootRef.current && rootRef.current.contains(activeElement)),
    );

    if (!area) {
      return {
        ...baseContext,
        editorFocused: isEditorActive,
        inputFocused: paletteInputFocused ? false : baseContext.inputFocused,
        canvasReadOnly,
      };
    }

    return {
      ...baseContext,
      editorFocused: isEditorActive,
      inputFocused: paletteInputFocused ? false : baseContext.inputFocused,
      canvasReadOnly,
      canvasFocused: area === 'canvas',
      sidebarFocused: area === 'sidebar',
      inspectorFocused: area === 'inspector',
      activityBarFocused: area === 'activity-bar',
    };
  }, [
    activeCanvasTool,
    canDeleteSelectedNode,
    canDuplicateSelectedNode,
    canMoveSelectedNodeDown,
    canMoveSelectedNodeUp,
    canvasReadOnly,
    focusVersion,
    pluginContext?.selection,
    selectedNodeSchemaId,
    showInspector,
    showSidebar,
  ]);
  const resolveCommandState = React.useCallback((commandId: string, area?: ContextMenuArea) => {
    const context = getRuntimeContext(area);
    const hostCommand = hostCommandMap.get(commandId);
    if (hostCommand) {
      const visible = evaluateWhenExpression(hostCommand.when, context, true);
      const enabled = visible && evaluateWhenExpression(hostCommand.enabledWhen, context, true);
      return { visible, enabled };
    }

    const pluginCommand = pluginCommandMap.get(commandId);
    if (pluginCommand) {
      const visible = evaluateWhenExpression(pluginCommand.when, context, true);
      const enabled = visible && evaluateWhenExpression(pluginCommand.enabledWhen, context, true);
      return { visible, enabled };
    }

    return { visible: true, enabled: true };
  }, [getRuntimeContext, hostCommandMap, pluginCommandMap]);
  const allMenus = React.useMemo<ToolbarMenuItem[]>(() => (
    [...hostMenus, ...pluginContributes.menus]
      .filter((item) => evaluateWhenExpression(item.when, getRuntimeContext(), true))
      .filter((item) => resolveCommandState(item.commandId).visible)
      .map((item) => ({
        id: item.id,
        label: item.label,
        commandId: item.commandId,
        disabled: !(
          evaluateWhenExpression(item.enabledWhen, getRuntimeContext(), true)
          && resolveCommandState(item.commandId).enabled
        ),
        ...(item.section ? { section: item.section } : {}),
        ...(item.target ? { target: item.target } : {}),
        ...(item.group ? { group: item.group } : {}),
      }))
  ), [getRuntimeContext, hostMenus, pluginContributes.menus, resolveCommandState]);
  const getContextMenuItems = React.useCallback((area: ContextMenuArea): ContextMenuItem[] => {
    const context = getRuntimeContext(area);

    return [...hostContextMenus, ...pluginContributes.contextMenus]
      .filter((item) => (item.area ?? 'canvas') === area)
      .filter((item) => evaluateWhenExpression(item.when, context, true))
      .filter((item) => resolveCommandState(item.commandId, area).visible)
      .map((item) => ({
        id: item.id,
        label: item.label,
        commandId: item.commandId,
        ...(item.group ? { group: item.group } : {}),
        disabled: !(
          evaluateWhenExpression(item.enabledWhen, context, true)
          && resolveCommandState(item.commandId, area).enabled
        ),
      }));
  }, [getRuntimeContext, hostContextMenus, pluginContributes.contextMenus, resolveCommandState]);
  const activeContextMenuItems = React.useMemo(
    () => (contextMenuState.open ? getContextMenuItems(contextMenuState.area) : []),
    [contextMenuState, getContextMenuItems],
  );
  const shortcutMap = React.useMemo(() => {
    const entries = new Map<string, string>();
    for (const shortcut of allShortcuts) {
      if (!entries.has(shortcut.commandId)) {
        entries.set(shortcut.commandId, shortcut.keybinding);
      }
    }
    return entries;
  }, [allShortcuts]);
  const commandPaletteCommands = React.useMemo<CommandPaletteItem[]>(() => {
    const items: CommandPaletteItem[] = hostCommands
      .filter((command) => resolveCommandState(command.id).visible)
      .map((command) => ({
        id: command.id,
        title: command.title,
        ...(command.category ? { category: command.category } : {}),
        ...(command.description ? { description: command.description } : {}),
        ...(command.aliases ? { aliases: command.aliases } : {}),
        ...(command.keywords ? { keywords: command.keywords } : {}),
        shortcut: shortcutMap.get(command.id),
        source: 'host',
        disabled: !resolveCommandState(command.id).enabled,
      }));
    for (const command of pluginContributes.commands.filter((item) => resolveCommandState(item.id).visible)) {
      items.push({
        id: command.id,
        title: command.title,
        ...(command.category ? { category: command.category } : {}),
        ...(command.description ? { description: command.description } : {}),
        ...(command.aliases ? { aliases: command.aliases } : {}),
        ...(command.keywords ? { keywords: command.keywords } : {}),
        shortcut: shortcutMap.get(command.id),
        source: 'plugin',
        disabled: !resolveCommandState(command.id).enabled,
      });
    }
    return items;
  }, [hostCommands, pluginContributes.commands, resolveCommandState, shortcutMap]);
  const recordRecentCommand = React.useCallback((commandId: string) => {
    if (commandId === 'commandPalette.open') {
      return;
    }
    recentCommandIdsRef.current = [
      commandId,
      ...recentCommandIdsRef.current.filter((item) => item !== commandId),
    ].slice(0, MAX_RECENT_COMMANDS);
  }, []);
  const resolvedPluginContext = React.useMemo<PluginContext>(() => {
    let context!: PluginContext;
    const execute = (commandId: string, payload?: unknown) => {
      const hostCommand = hostCommandMap.get(commandId);
      if (hostCommand) {
        return hostCommand.execute(payload);
      }
      const pluginCommand = pluginContributes.commands.find((item) => item.id === commandId);
      if (pluginCommand) {
        return pluginCommand.execute(context, payload);
      }
      return pluginContext?.commands?.execute?.(commandId, payload);
    };
    context = {
      ...pluginContext,
      workspace: {
        getWorkspaceId: () => workspaceId,
      },
      persistence,
      commands: {
        execute,
      },
    };
    return context;
  }, [hostCommandMap, persistence, pluginContext, pluginContributes.commands, workspaceId]);
  const panelRenderContext = React.useMemo(() => ({
    ...(sidebarProps?.contracts ? { contracts: sidebarProps.contracts } : {}),
    ...(sidebarProps?.treeNodes ? { treeNodes: sidebarProps.treeNodes } : {}),
    ...(sidebarProps?.selectedNodeId ? { selectedNodeId: sidebarProps.selectedNodeId } : {}),
    ...(sidebarProps?.onSelectNode ? { onSelectNode: sidebarProps.onSelectNode } : {}),
    ...(sidebarProps?.onInsertComponent ? { onInsertComponent: sidebarProps.onInsertComponent } : {}),
    ...(sidebarProps?.onStartDragComponent ? { onStartDragComponent: sidebarProps.onStartDragComponent } : {}),
    ...(sidebarProps?.onEndDragComponent ? { onEndDragComponent: sidebarProps.onEndDragComponent } : {}),
    pluginContext: resolvedPluginContext,
  }), [
    resolvedPluginContext,
    sidebarProps?.contracts,
    sidebarProps?.onEndDragComponent,
    sidebarProps?.onInsertComponent,
    sidebarProps?.onSelectNode,
    sidebarProps?.onStartDragComponent,
    sidebarProps?.selectedNodeId,
    sidebarProps?.treeNodes,
  ]);
  const resolvedPluginContextRef = React.useRef(resolvedPluginContext);
  resolvedPluginContextRef.current = resolvedPluginContext;
  const runCommand = React.useCallback((commandId: string, payload?: unknown) => {
    recordRecentCommand(commandId);
    return resolvedPluginContext.commands?.execute(commandId, payload);
  }, [recordRecentCommand, resolvedPluginContext.commands]);

  const toggleTheme = (newTheme: ThemeMode) => {
    setTheme(newTheme);
  };

  React.useEffect(() => {
    let cancelled = false;

    void Promise.all([
      persistence.getJSON<StoredLayoutState>(WORKSPACE_LAYOUT_NAMESPACE, WORKSPACE_WORKBENCH_KEY),
      persistence.getJSON<StoredWorkbenchPreferences>(
        WORKSPACE_PREFERENCES_NAMESPACE,
        WORKSPACE_WORKBENCH_KEY,
      ),
    ])
      .then(async ([storedLayoutState, storedPreferences]) => {
        if (cancelled) {
          return;
        }

        const nextState = storedLayoutState ?? {};
        setLoadedLayoutState(nextState);
        setShowSidebar(nextState.showSidebar ?? true);
        setShowInspector(nextState.showInspector ?? true);
        setShowConsole(nextState.showConsole ?? true);
        if (nextState.activePrimaryPanelId !== undefined) {
          setActivePrimaryPanelId(nextState.activePrimaryPanelId);
        }
        if (nextState.showFileContextPanel !== undefined) {
          setShowFileContextPanel(nextState.showFileContextPanel);
        }
        if (nextState.activeFileContextTabId !== undefined) {
          setActiveFileContextTabId(nextState.activeFileContextTabId);
        }
        if (nextState.showAssistantPanel !== undefined) {
          setShowAssistantPanel(nextState.showAssistantPanel);
        }
        if (nextState.activeAuxiliaryPanelId !== undefined) {
          setActiveAuxiliaryPanelId(nextState.activeAuxiliaryPanelId);
        }
        if (nextState.sidebarSize !== undefined) {
          setSidebarSize(nextState.sidebarSize);
        }
        if (nextState.fileContextPanelSize !== undefined) {
          setFileContextPanelSize(nextState.fileContextPanelSize);
        }
        if (nextState.inspectorSize !== undefined) {
          setInspectorSize(nextState.inspectorSize);
        }
        if (nextState.assistantPanelSize !== undefined) {
          setAIPanelSize(nextState.assistantPanelSize);
        }
        if (nextState.consoleSize !== undefined) {
          setConsoleSize(nextState.consoleSize);
        }

        setTheme(storedPreferences?.theme ?? 'dark');

        const nextLocale = storedPreferences?.locale ?? detectBrowserLocale();
        if (nextLocale !== currentLocaleRef.current) {
          await changeLanguage(nextLocale);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadedLayoutState({});
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLayoutHydrated(true);
          setPreferencesHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    persistence,
    setAIPanelSize,
    setConsoleSize,
    setFileContextPanelSize,
    setInspectorSize,
    setSidebarSize,
  ]);

  React.useEffect(() => {
    if (!layoutHydrated) {
      return;
    }

    void persistence.setJSON(WORKSPACE_LAYOUT_NAMESPACE, WORKSPACE_WORKBENCH_KEY, {
      showSidebar,
      showInspector,
      showConsole,
      activePrimaryPanelId,
      showFileContextPanel,
      activeFileContextTabId,
      showAssistantPanel,
      sidebarSize,
      fileContextPanelSize,
      inspectorSize,
      assistantPanelSize: aiPanelSize,
      consoleSize,
      ...(activeAuxiliaryPanelId ? { activeAuxiliaryPanelId } : {}),
    }).catch(() => undefined);
  }, [
    activeFileContextTabId,
    activePrimaryPanelId,
    activeAuxiliaryPanelId,
    aiPanelSize,
    consoleSize,
    fileContextPanelSize,
    layoutHydrated,
    persistence,
    showAssistantPanel,
    showConsole,
    showFileContextPanel,
    showInspector,
    showSidebar,
    inspectorSize,
    sidebarSize,
  ]);

  React.useEffect(() => {
    if (!preferencesHydrated) {
      return;
    }

    void persistence.setJSON(WORKSPACE_PREFERENCES_NAMESPACE, WORKSPACE_WORKBENCH_KEY, {
      theme,
      locale: currentLocale,
    }).catch(() => undefined);
  }, [currentLocale, persistence, preferencesHydrated, theme]);

  React.useEffect(() => {
    if (auxiliaryPanels.length === 0) {
      setShowAssistantPanel(false);
      setActiveAuxiliaryPanelId(undefined);
      return;
    }
    const fallbackPanel = auxiliaryPanels.find((panel) => panel.defaultOpen) ?? auxiliaryPanels[0];
    setActiveAuxiliaryPanelId((prev) => (
      prev && auxiliaryPanels.some((panel) => panel.id === prev) ? prev : fallbackPanel?.id
    ));
    if (
      loadedLayoutState?.showAssistantPanel === undefined
      && auxiliaryPanels.some((panel) => panel.defaultOpen)
    ) {
      setShowAssistantPanel((prev) => prev || true);
    }
  }, [auxiliaryPanels, loadedLayoutState?.showAssistantPanel]);

  React.useEffect(() => {
    if (!activeAuxiliaryPanel) {
      return;
    }
    if (loadedLayoutState?.assistantPanelSize !== undefined) {
      return;
    }
    setAIPanelSize(activeAuxiliaryPanel.defaultWidth ?? 300);
  }, [activeAuxiliaryPanel, loadedLayoutState?.assistantPanelSize, setAIPanelSize]);

  React.useEffect(() => {
    const cleanups: EditorPluginCleanup[] = [];
    let disposed = false;
    const reportActivationError = (plugin: EditorPluginManifest, error: unknown) => {
      if (disposed) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      pluginContext?.notifications?.error?.(`Plugin "${plugin.name}" activate failed: ${message}`);
    };
    const registerCleanup = (cleanup: EditorPluginCleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      cleanups.push(cleanup);
    };
    const collectCleanup = (result: EditorPluginActivateResult, plugin: EditorPluginManifest) => {
      if (isCleanup(result)) {
        registerCleanup(result);
        return;
      }
      if (isPromiseLike(result)) {
        void result
          .then((cleanup) => {
            if (isCleanup(cleanup)) {
              registerCleanup(cleanup);
            }
          })
          .catch((error) => {
            reportActivationError(plugin, error);
          });
      }
    };
    for (const plugin of plugins ?? []) {
      if (!plugin.activate) {
        continue;
      }
      try {
        const result = plugin.activate(resolvedPluginContextRef.current);
        collectCleanup(result, plugin);
      } catch (error) {
        reportActivationError(plugin, error);
      }
    }
    return () => {
      disposed = true;
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, [pluginContext, plugins]);

  React.useEffect(() => {
    if (allShortcuts.length === 0) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const shortcut = findMatchingShortcut(
        allShortcuts,
        event,
        getShortcutEventContext(event.target, rootRef.current, {
          sidebarVisible: showSidebar,
          inspectorVisible: showInspector,
          hasSelection: Boolean(pluginContext?.selection?.getSelectedNodeId?.()),
          hasCanvasSelection: Boolean(selectedNodeSchemaId),
          canvasSelectToolActive: activeCanvasTool === 'select',
          canvasPanToolActive: activeCanvasTool === 'pan',
        }),
      );
      if (!shortcut) {
        return;
      }
      const commandState = resolveCommandState(shortcut.commandId);
      if (!commandState.visible || !commandState.enabled) {
        return;
      }
      event.preventDefault();
      void runCommand(shortcut.commandId);
    };

    const hostDocument = document;
    const frameDocument = canvasSurface?.ownerDocument && canvasSurface.ownerDocument !== hostDocument
      ? canvasSurface.ownerDocument
      : null;
    hostDocument.addEventListener('keydown', handleKeyDown);
    frameDocument?.addEventListener('keydown', handleKeyDown);
    return () => {
      hostDocument.removeEventListener('keydown', handleKeyDown);
      frameDocument?.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    allShortcuts,
    activeCanvasTool,
    canvasSurface,
    pluginContext?.selection,
    resolveCommandState,
    runCommand,
    selectedNodeSchemaId,
    showInspector,
    showSidebar,
  ]);

  React.useEffect(() => {
    if (!contextMenuState.open) {
      return;
    }

    const handlePointerDown = () => {
      setContextMenuState((current) => ({ ...current, open: false }));
    };

    window.addEventListener('resize', handlePointerDown);
    return () => {
      window.removeEventListener('resize', handlePointerDown);
    };
  }, [contextMenuState.open]);

  React.useEffect(() => {
    const shouldHandleCanvasSpace = (target: EventTarget | null) => {
      const element = isElementTarget(target) ? target : document.activeElement;
      const isTyping = isElementTarget(element)
        && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable);
      return !isTyping;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        if (!shouldHandleCanvasSpace(event.target)) {
          return;
        }
        event.preventDefault();
        if (!event.repeat) {
          spacePressedRef.current = true;
          setIsSpacePressed(true);
        }
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        if (shouldHandleCanvasSpace(event.target)) {
          event.preventDefault();
        }
        spacePressedRef.current = false;
        setIsSpacePressed(false);
      }
    };
    const handleBlur = () => {
      spacePressedRef.current = false;
      setIsSpacePressed(false);
      setIsCanvasPanning(false);
      panSessionRef.current = null;
      clearCanvasPanInteractionGuards();
    };
    const hostDocument = document;
    const hostWindow = window;
    const frameDocument = canvasSurface?.ownerDocument && canvasSurface.ownerDocument !== hostDocument
      ? canvasSurface.ownerDocument
      : null;
    const frameWindow = canvasSurface?.ownerWindow && canvasSurface.ownerWindow !== hostWindow
      ? canvasSurface.ownerWindow
      : null;

    hostDocument.addEventListener('keydown', handleKeyDown, true);
    hostDocument.addEventListener('keyup', handleKeyUp, true);
    hostWindow.addEventListener('keydown', handleKeyDown, true);
    hostWindow.addEventListener('keyup', handleKeyUp, true);
    frameDocument?.addEventListener('keydown', handleKeyDown, true);
    frameDocument?.addEventListener('keyup', handleKeyUp, true);
    frameWindow?.addEventListener('keydown', handleKeyDown, true);
    frameWindow?.addEventListener('keyup', handleKeyUp, true);
    hostWindow.addEventListener('blur', handleBlur, true);
    frameWindow?.addEventListener('blur', handleBlur, true);
    return () => {
      hostDocument.removeEventListener('keydown', handleKeyDown, true);
      hostDocument.removeEventListener('keyup', handleKeyUp, true);
      hostWindow.removeEventListener('keydown', handleKeyDown, true);
      hostWindow.removeEventListener('keyup', handleKeyUp, true);
      frameDocument?.removeEventListener('keydown', handleKeyDown, true);
      frameDocument?.removeEventListener('keyup', handleKeyUp, true);
      frameWindow?.removeEventListener('keydown', handleKeyDown, true);
      frameWindow?.removeEventListener('keyup', handleKeyUp, true);
      hostWindow.removeEventListener('blur', handleBlur, true);
      frameWindow?.removeEventListener('blur', handleBlur, true);
    };
  }, [canvasSurface, clearCanvasPanInteractionGuards]);

  React.useEffect(() => {
    const element = canvasScrollRef.current;
    if (!element) {
      return;
    }
    centerCanvasOnStage(canvasScale);
  }, [centerCanvasOnStage]);

  React.useEffect(() => {
    const element = canvasScrollRef.current;
    if (!element) {
      return;
    }
    const handleScroll = () => {
      syncCanvasViewportState();
    };
    element.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      element.removeEventListener('scroll', handleScroll);
    };
  }, [syncCanvasViewportState]);

  // Track actual stage content height for dynamic workspace sizing
  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const sync = () => {
      const measured = stage.scrollHeight;
      if (measured !== stageContentHeightRef.current) {
        stageContentHeightRef.current = measured;
        setStageContentHeight(measured);
      }
    };
    sync();
    const observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => { sync(); })
      : null;
    observer?.observe(stage);
    return () => {
      observer?.disconnect();
    };
  }, [canvasSurface]);

  const handleActivitySelectItem = (item: ActivityBarItemContribution) => {
    activityBarProps?.onSelectItem?.(item);
    setActiveActivityItemId(item.id);
    const panelId = resolveActivityItemPanelId(item, primaryPanels);
    if (panelId) {
      setActivePrimaryPanelId(panelId);
      if (!showSidebar) {
        setShowSidebar(true);
        setIsMaximized(false);
      }
      return;
    }
    const tabId = item.target?.type === 'tab' ? item.target.tabId : item.targetSidebarTabId;
    if (!tabId) {
      setActivePrimaryPanelId('');
      if (!showSidebar) {
        setShowSidebar(true);
        setIsMaximized(false);
      }
      return;
    }
    setActiveFileContextTabId(tabId);
    if (activeEditorTab?.fileType === 'page' || activeCanvasRenderer) {
      setShowFileContextPanel(true);
    }
    if (!showSidebar && item.target?.type === 'panel') {
      setShowSidebar(true);
      setIsMaximized(false);
    }
  };

  const handleSurfacePointerSelection = React.useCallback((target: EventTarget | null) => {
    if (contextMenuState.open) {
      setContextMenuState((current) => ({ ...current, open: false }));
    }
    if (
      activeCanvasTool === 'pan'
      || spacePressedRef.current
      || isCanvasPanning
      || panSessionRef.current
      || canvasDragSession
    ) {
      return;
    }
    if (!isElementTarget(target)) {
      return;
    }
    const hit = target.closest('[data-shenbi-node-id]');
    if (!hit) {
      onCanvasDeselectNode?.();
      return;
    }
    const nodeId = hit.getAttribute('data-shenbi-node-id');
    if (!nodeId) {
      onCanvasDeselectNode?.();
      return;
    }
    onCanvasSelectNode?.(nodeId);
    if (!showInspector) {
      setShowInspector(true);
      setIsMaximized(false);
    }
  }, [
    activeCanvasTool,
    canvasDragSession,
    contextMenuState.open,
    isCanvasPanning,
    onCanvasDeselectNode,
    onCanvasSelectNode,
    showInspector,
  ]);

  const openContextMenuAt = React.useCallback((area: ContextMenuArea, x: number, y: number) => {
    const items = getContextMenuItems(area);
    if (items.length === 0) {
      return;
    }
    setContextMenuState({
      open: true,
      area,
      position: {
        x,
        y,
      },
    });
  }, [getContextMenuItems]);

  const openContextMenu = (area: ContextMenuArea, event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    openContextMenuAt(area, event.clientX, event.clientY);
  };

  React.useEffect(() => {
    if (!canvasSurface?.rootElement || !canvasSurface.ownerDocument) {
      return;
    }

    const rootElement = canvasSurface.rootElement;
    const ownerDocument = canvasSurface.ownerDocument;
    const frameElement = canvasSurface.hostElement instanceof HTMLIFrameElement
      ? canvasSurface.hostElement
      : null;

    const resolveClientPoint = (event: MouseEvent) => {
      if (!frameElement) {
        return { x: event.clientX, y: event.clientY };
      }
      const frameRect = frameElement.getBoundingClientRect();
      return {
        x: frameRect.left + event.clientX,
        y: frameRect.top + event.clientY,
      };
    };

    const handleClick = (event: MouseEvent) => {
      handleSurfacePointerSelection(event.target);
    };

    const handleContextMenuEvent = (event: MouseEvent) => {
      const point = resolveClientPoint(event);
      event.preventDefault();
      openContextMenuAt('canvas', point.x, point.y);
    };

    if (canvasSurface.mode === 'iframe') {
      ownerDocument.addEventListener('click', handleClick, true);
      ownerDocument.addEventListener('contextmenu', handleContextMenuEvent, true);
    } else {
      rootElement.addEventListener('click', handleClick, true);
      rootElement.addEventListener('contextmenu', handleContextMenuEvent, true);
    }
    return () => {
      if (canvasSurface.mode === 'iframe') {
        ownerDocument.removeEventListener('click', handleClick, true);
        ownerDocument.removeEventListener('contextmenu', handleContextMenuEvent, true);
      } else {
        rootElement.removeEventListener('click', handleClick, true);
        rootElement.removeEventListener('contextmenu', handleContextMenuEvent, true);
      }
    };
  }, [canvasSurface, handleSurfacePointerSelection, openContextMenuAt]);

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(...THEME_CLASSES);
    const activeThemeClass = `theme-${theme}`;
    root.classList.add(activeThemeClass);
    return () => {
      root.classList.remove(activeThemeClass);
    };
  }, [theme]);

  const handleChangeLocale = React.useCallback((nextLocale: SupportedLocale) => {
    void changeLanguage(nextLocale);
  }, []);


  React.useEffect(() => {
    if (!zoomMenuState.open) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        zoomMenuRef.current?.contains(target)
        || canvasChromeRef.current?.contains(target)
      ) {
        return;
      }
      setZoomMenuState({ open: false });
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setZoomMenuState({ open: false });
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [zoomMenuState.open]);
  const shouldStartCanvasPan = React.useCallback((button: number) => (
    button === 1
    || (button === 0 && (spacePressedRef.current || activeCanvasTool === 'pan'))
  ), [activeCanvasTool]);
  const startCanvasPan = React.useCallback((
    pointerId: number,
    clientX: number,
    clientY: number,
  ) => {
    const element = canvasScrollRef.current;
    if (!element) {
      return false;
    }
    setIsCanvasPanning(true);
    setZoomMenuState({ open: false });
    applyCanvasPanInteractionGuards();
    panSessionRef.current = {
      pointerId,
      startX: clientX,
      startY: clientY,
      startScrollLeft: element.scrollLeft,
      startScrollTop: element.scrollTop,
    };
    return true;
  }, [applyCanvasPanInteractionGuards]);
  const moveCanvasPan = React.useCallback((pointerId: number, clientX: number, clientY: number) => {
    const session = panSessionRef.current;
    const element = canvasScrollRef.current;
    if (!session || !element || session.pointerId !== pointerId) {
      return;
    }
    element.scrollLeft = session.startScrollLeft - (clientX - session.startX);
    element.scrollTop = session.startScrollTop - (clientY - session.startY);
    syncCanvasViewportState();
  }, [syncCanvasViewportState]);
  const endCanvasPan = React.useCallback((pointerId: number) => {
    if (panSessionRef.current?.pointerId !== pointerId) {
      return false;
    }
    setIsCanvasPanning(false);
    panSessionRef.current = null;
    clearCanvasPanInteractionGuards();
    return true;
  }, [clearCanvasPanInteractionGuards]);
  const handleCanvasWheelEvent = React.useCallback((event: {
    ctrlKey: boolean;
    metaKey: boolean;
    deltaY: number;
    clientX: number;
    clientY: number;
    preventDefault: () => void;
    stopPropagation?: () => void;
  }) => {
    if (!(event.ctrlKey || event.metaKey)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation?.();
    updateCanvasScale(resolveWheelZoomScale(canvasScale, event.deltaY), {
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }, [canvasScale, updateCanvasScale]);

  const handleCanvasPointerDown = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!shouldStartCanvasPan(event.button)) {
      return;
    }
    if (!startCanvasPan(event.pointerId, event.screenX, event.screenY)) {
      return;
    }
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }, [shouldStartCanvasPan, startCanvasPan]);

  const handleCanvasPointerMove = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    moveCanvasPan(event.pointerId, event.screenX, event.screenY);
  }, [moveCanvasPan]);

  const handleCanvasPointerUp = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!endCanvasPan(event.pointerId)) {
      return;
    }
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  }, [endCanvasPan]);
  React.useEffect(() => {
    if (canvasSurface?.mode !== 'iframe' || !canvasSurface.rootElement) {
      return;
    }
    const rootElement = canvasSurface.rootElement;

    // Use screenX/Y for pan coordinates — they are absolute and never
    // shift when the iframe element moves during outer-container scroll.
    const handlePointerDown = (event: PointerEvent) => {
      if (!shouldStartCanvasPan(event.button)) {
        return;
      }
      if (!startCanvasPan(event.pointerId, event.screenX, event.screenY)) {
        return;
      }
      event.preventDefault();
      rootElement.setPointerCapture(event.pointerId);
    };
    const handlePointerMove = (event: PointerEvent) => {
      moveCanvasPan(event.pointerId, event.screenX, event.screenY);
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (!endCanvasPan(event.pointerId)) {
        return;
      }
      try { rootElement.releasePointerCapture(event.pointerId); } catch { /* noop */ }
    };

    rootElement.addEventListener('pointerdown', handlePointerDown, true);
    rootElement.addEventListener('pointermove', handlePointerMove, true);
    rootElement.addEventListener('pointerup', handlePointerUp, true);
    rootElement.addEventListener('pointercancel', handlePointerUp, true);
    return () => {
      rootElement.removeEventListener('pointerdown', handlePointerDown, true);
      rootElement.removeEventListener('pointermove', handlePointerMove, true);
      rootElement.removeEventListener('pointerup', handlePointerUp, true);
      rootElement.removeEventListener('pointercancel', handlePointerUp, true);
    };
  }, [canvasSurface, endCanvasPan, moveCanvasPan, shouldStartCanvasPan, startCanvasPan]);
  React.useEffect(() => {
    const element = canvasScrollRef.current;
    if (!element) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      handleCanvasWheelEvent(event);
    };

    element.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => {
      element.removeEventListener('wheel', handleWheel, true);
    };
  }, [handleCanvasWheelEvent]);
  React.useEffect(() => {
    if (canvasSurface?.mode !== 'iframe' || !canvasSurface.ownerDocument) {
      return;
    }

    const ownerDocument = canvasSurface.ownerDocument;
    const frameElement = canvasSurface.hostElement as HTMLIFrameElement;
    const handleWheel = (event: WheelEvent) => {
      const frameRect = frameElement.getBoundingClientRect();
      handleCanvasWheelEvent({
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        deltaY: event.deltaY,
        clientX: frameRect.left + event.clientX,
        clientY: frameRect.top + event.clientY,
        preventDefault: () => event.preventDefault(),
        stopPropagation: () => event.stopPropagation(),
      });
    };

    ownerDocument.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => {
      ownerDocument.removeEventListener('wheel', handleWheel, true);
    };
  }, [canvasSurface, handleCanvasWheelEvent]);

  const clearCanvasDragState = React.useCallback(() => {
    setCanvasDragSession(null);
    setCanvasDropIndicator(null);
  }, []);
  React.useEffect(() => {
    if (activeCanvasTool === 'pan') {
      clearCanvasDragState();
    }
  }, [activeCanvasTool, clearCanvasDragState]);

  const resolveCanvasDropIndicator = React.useCallback((
    clientX: number,
    clientY: number,
  ): CanvasDropIndicator | null => {
    const stageElement = stageRef.current;
    const surface = canvasSurface;
    if (!stageElement || !surface) {
      return null;
    }

    const stageRect = stageElement.getBoundingClientRect();
    if (
      clientX < stageRect.left
      || clientX > stageRect.right
      || clientY < stageRect.top
      || clientY > stageRect.bottom
    ) {
      return null;
    }

    const localX = (clientX - stageRect.left) / canvasScale;
    const localY = (clientY - stageRect.top) / canvasScale;
    const nodeElements = [...(surface.rootElement?.querySelectorAll('[data-shenbi-node-id]') ?? [])];

    const candidates = nodeElements
      .map((element) => {
        const rect = surface.getRelativeRect(element);
        const contains = (
          localX >= rect.left
          && localX <= rect.left + rect.width
          && localY >= rect.top
          && localY <= rect.top + rect.height
        );
        return { element, rect, area: rect.width * rect.height, contains };
      })
      .filter((item) => item.contains && item.rect.width > 0 && item.rect.height > 0)
      .sort((left, right) => left.area - right.area);

    if (candidates.length === 0) {
      return {
        target: { placement: 'root' },
        top: 0,
        left: 0,
        width: stageWidth,
        height: Math.max(stageContentHeightRef.current, STAGE_MIN_HEIGHT),
        variant: 'frame',
      };
    }

    const hit = candidates[0];
    if (!hit) {
      return null;
    }
    const nodeId = hit.element.getAttribute('data-shenbi-node-id') ?? undefined;
    if (!nodeId) {
      return null;
    }

    return resolveNodeDropIndicator(
      nodeId,
      hit.rect,
      localY,
      canCanvasDropInsideNode?.(nodeId) ?? true,
    );
  }, [canCanvasDropInsideNode, canvasScale, canvasSurface]);

  const updateCanvasDropIndicator = React.useCallback((clientX: number, clientY: number) => {
    setCanvasDropIndicator(resolveCanvasDropIndicator(clientX, clientY));
  }, [resolveCanvasDropIndicator]);

  const handleSidebarStartDragComponent = React.useCallback((componentType: string) => {
    if (canvasReadOnly || activeCanvasTool === 'pan') {
      return;
    }
    setCanvasDragSession({
      source: 'component',
      componentType,
    });
  }, [activeCanvasTool, canvasReadOnly]);

  const handleSidebarEndDragComponent = React.useCallback(() => {
    clearCanvasDragState();
  }, [clearCanvasDragState]);

  const startSelectedNodeDrag = React.useCallback((dataTransfer: DataTransfer | null): boolean => {
    if (canvasReadOnly || activeCanvasTool === 'pan' || !selectedNodeTreeId || !dataTransfer) {
      return false;
    }
    dataTransfer.effectAllowed = 'move';
    dataTransfer.setData('text/plain', selectedNodeTreeId);
    dataTransfer.setData('application/x-shenbi-selected-node', selectedNodeTreeId);
    setCanvasDragSession({
      source: 'selected-node',
    });
    return true;
  }, [activeCanvasTool, canvasReadOnly, selectedNodeTreeId]);

  const handleSelectedDragStart = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!startSelectedNodeDrag(event.dataTransfer)) {
      event.preventDefault();
    }
  }, [startSelectedNodeDrag]);

  React.useEffect(() => {
    if (!canvasSurface || !selectedNodeSchemaId) {
      return;
    }

    const selectedElement = canvasSurface.findNodeElement(selectedNodeSchemaId);
    if (!(selectedElement instanceof HTMLElement)) {
      return;
    }

    const previousDraggableAttr = selectedElement.getAttribute('draggable');
    const handleDragStart = (event: DragEvent) => {
      if (!startSelectedNodeDrag(event.dataTransfer)) {
        event.preventDefault();
      }
    };
    const handleDragEnd = () => {
      clearCanvasDragState();
    };

    selectedElement.setAttribute('draggable', (!canvasReadOnly && activeCanvasTool !== 'pan' && selectedNodeTreeId) ? 'true' : 'false');
    selectedElement.addEventListener('dragstart', handleDragStart);
    selectedElement.addEventListener('dragend', handleDragEnd);

    return () => {
      selectedElement.removeEventListener('dragstart', handleDragStart);
      selectedElement.removeEventListener('dragend', handleDragEnd);
      if (previousDraggableAttr === null) {
        selectedElement.removeAttribute('draggable');
      } else {
        selectedElement.setAttribute('draggable', previousDraggableAttr);
      }
    };
  }, [
    activeCanvasTool,
    canvasReadOnly,
    canvasSurface,
    clearCanvasDragState,
    selectedNodeSchemaId,
    selectedNodeTreeId,
    startSelectedNodeDrag,
  ]);

  const handleCanvasDragOver = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!canvasDragSession || canvasReadOnly || activeCanvasTool === 'pan') {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = canvasDragSession.source === 'component' ? 'copy' : 'move';
    updateCanvasDropIndicator(event.clientX, event.clientY);
  }, [activeCanvasTool, canvasDragSession, canvasReadOnly, updateCanvasDropIndicator]);

  const handleCanvasDragLeave = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setCanvasDropIndicator(null);
  }, []);

  const handleCanvasDrop = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!canvasDragSession || canvasReadOnly || activeCanvasTool === 'pan') {
      clearCanvasDragState();
      return;
    }
    event.preventDefault();
    const indicator = resolveCanvasDropIndicator(event.clientX, event.clientY);
    if (!indicator) {
      clearCanvasDragState();
      return;
    }
    if (canvasDragSession.source === 'component' && canvasDragSession.componentType) {
      onCanvasInsertComponent?.(canvasDragSession.componentType, indicator.target);
    } else if (canvasDragSession.source === 'selected-node') {
      onCanvasMoveSelectedNode?.(indicator.target);
    }
    clearCanvasDragState();
  }, [
    activeCanvasTool,
    canvasDragSession,
    canvasReadOnly,
    clearCanvasDragState,
    onCanvasInsertComponent,
    onCanvasMoveSelectedNode,
    resolveCanvasDropIndicator,
  ]);

  const canvasCursorClassName = isCanvasPanning
    ? 'cursor-grabbing'
    : (isSpacePressed || activeCanvasTool === 'pan')
      ? 'canvas-cursor-grab'
      : 'cursor-default';
  const canFocusCanvasSelection = Boolean(selectedNodeSchemaId && canvasSurface);
  const selectionOverlayActions = React.useMemo<SelectionOverlayAction[]>(() => {
    const commonActions: Array<{
      id: string;
      title: string;
      icon: React.ReactNode;
    }> = [
      {
        id: 'canvas.duplicateSelectedNode',
        title: 'Duplicate',
        icon: <Copy size={12} />,
      },
      {
        id: 'canvas.moveSelectedNodeUp',
        title: 'Move Up',
        icon: <ArrowUp size={12} />,
      },
      {
        id: 'canvas.moveSelectedNodeDown',
        title: 'Move Down',
        icon: <ArrowDown size={12} />,
      },
      {
        id: 'canvas.deleteSelectedNode',
        title: 'Delete',
        icon: <Trash2 size={12} />,
      },
    ];

    const extraActions: SelectionOverlayAction[] = [];

    return [
      ...commonActions.reduce<SelectionOverlayAction[]>((actions, action) => {
          const commandExists = hostCommandMap.has(action.id) || pluginCommandMap.has(action.id);
          if (!commandExists) {
            return actions;
          }
          const state = resolveCommandState(action.id, 'canvas');
          if (!state.visible) {
            return actions;
          }
          actions.push({
            id: action.id,
            title: action.title,
            icon: action.icon,
            disabled: !state.enabled,
            onRun: () => {
              void runCommand(action.id);
            },
          });
          return actions;
        }, []),
      ...extraActions,
    ];
  }, [hostCommandMap, pluginCommandMap, resolveCommandState, runCommand]);

  const shouldRenderFileContextPanel = (activeEditorTab?.fileType === 'page' || Boolean(activeCanvasRenderer)) && showFileContextPanel;

  return (
    <div ref={rootRef} className="h-screen w-screen flex flex-col bg-bg-canvas text-text-primary overflow-hidden font-inter">
      <TitleBar 
        theme={theme} 
        onToggleTheme={toggleTheme}
        locale={currentLocale}
        onChangeLocale={handleChangeLocale}
        showSidebar={showSidebar}
        onToggleSidebar={() => { setShowSidebar(!showSidebar); setIsMaximized(false); }}
        showInspector={showInspector}
        onToggleInspector={() => { setShowInspector(!showInspector); setIsMaximized(false); }}
        showConsole={showConsole}
        onToggleConsole={() => { setShowConsole(!showConsole); setIsMaximized(false); }}
        hasAssistantPanel={auxiliaryPanels.length > 0}
        showAssistantPanel={showAssistantPanel}
        onToggleAssistantPanel={() => {
          if (auxiliaryPanels.length === 0) {
            return;
          }
          setShowAssistantPanel(!showAssistantPanel);
          setIsMaximized(false);
        }}
        isMaximized={isMaximized}
        onToggleMaximize={toggleMaximize}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        title={title}
        subtitle={subtitle}
        userAvatarUrl={userAvatarUrl}
        userName={userName}
        branches={branches}
        onBranchChange={onBranchChange}
        onLogout={onLogout}
        gitlabUrl={gitlabUrl}
        onOpenProjectManager={onOpenProjectManager}
      />
      
      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        <div
          data-shenbi-shortcut-area="activity-bar"
          onContextMenu={(event) => openContextMenu('activity-bar', event)}
        >
          <ActivityBar
            {...activityBarProps}
            items={activityItems}
            activeItemId={activeActivityItemId}
            onSelectItem={handleActivitySelectItem}
          />
        </div>
        
        {showSidebar ? (
          <div
            style={{ width: sidebarSize }}
            className="relative shrink-0 flex flex-col h-full"
            data-shenbi-shortcut-area="sidebar"
            onContextMenu={(event) => openContextMenu('sidebar', event)}
          >
            <div className="flex-1 overflow-hidden bg-bg-sidebar border-r border-border-ide flex flex-col">
              {activePrimaryPanel && activePrimaryPanel.id !== 'files' ? (
                <div className="h-8 shrink-0 flex items-center px-3 border-b border-border-ide bg-bg-panel text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                  {activePrimaryPanel.label}
                </div>
              ) : null}
              <div className="flex-1 overflow-hidden">
                {activePrimaryPanel ? activePrimaryPanel.render(panelRenderContext) : null}
              </div>
            </div>
            <div 
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-20 transition-colors"
              onMouseDown={(e) => startSidebarResize(e, 'horizontal', false)}
            />
          </div>
        ) : null}
        
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <EditorTabs
            label={schemaName ?? undefined}
            tabs={tabs}
            activeTabId={activeTabId}
            onActivateTab={onActivateTab}
            onCloseTab={onCloseTab}
            onCloseOtherTabs={onCloseOtherTabs}
            onCloseAllTabs={onCloseAllTabs}
            onCloseSavedTabs={onCloseSavedTabs}
            onMoveTab={onMoveTab}
          />
          <WorkbenchToolbar
            extra={toolbarExtra}
            menus={allMenus}
            breadcrumbItems={breadcrumbItems ?? []}
            onBreadcrumbSelect={onBreadcrumbSelect}
            onBreadcrumbHover={onBreadcrumbHover}
            onRunMenuCommand={(commandId) => {
              void runCommand(commandId);
            }}
          />
          
          <div className="flex-1 flex overflow-hidden">
            {shouldRenderFileContextPanel ? (
              <div
                style={{ width: fileContextPanelSize }}
                className="relative shrink-0 flex flex-col h-full"
                data-shenbi-shortcut-area="sidebar"
                onContextMenu={(event) => openContextMenu('sidebar', event)}
              >
                <Sidebar
                  {...sidebarProps}
                  tabs={fileContextTabs}
                  activeTabId={activeFileContextTabId}
                  onChangeActiveTab={setActiveFileContextTabId}
                  onStartDragComponent={handleSidebarStartDragComponent}
                  onEndDragComponent={handleSidebarEndDragComponent}
                  pluginContext={resolvedPluginContext}
                />
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-20 transition-colors"
                  onMouseDown={(e) => startFileContextPanelResize(e, 'horizontal', false)}
                />
              </div>
            ) : null}
            {/* Editor/Canvas Area Container */}
            <div className="flex-1 min-w-[320px] flex flex-col overflow-hidden relative bg-bg-canvas">
              {activeCanvasRenderer ? (
                <div className="flex-1 overflow-hidden">
                  {activeCanvasRenderer.render({
                    ...(activeEditorTab?.fileId ? { activeFileId: activeEditorTab.fileId } : {}),
                    ...(activeEditorTab?.fileName ? { activeFileName: activeEditorTab.fileName } : {}),
                    ...(activeEditorTab?.fileType ? { activeFileType: activeEditorTab.fileType } : {}),
                    pluginContext: resolvedPluginContext,
                  })}
                </div>
              ) : (
              <div className="relative flex flex-1 min-h-0 flex-col">
                <div ref={canvasChromeRef} className="canvas-toolbar-layer">
                  <CanvasToolRail
                    activeTool={activeCanvasTool}
                    spacePanActive={isSpacePressed}
                    focusSelectionDisabled={!canFocusCanvasSelection}
                    onSelectTool={() => { void runCommand('canvas.tool.select'); }}
                    onPanTool={() => { void runCommand('canvas.tool.pan'); }}
                    onFit={() => { void runCommand('canvas.fitView'); }}
                    onCenter={() => { void runCommand('canvas.centerStage'); }}
                    onFocusSelection={() => { void runCommand('canvas.focusSelection'); }}
                  />
                  <CanvasZoomHud
                    scale={canvasScale}
                    viewportState={canvasViewportState}
                    stageWidth={stageWidth}
                    stageHeight={Math.max(stageContentHeight, STAGE_MIN_HEIGHT)}
                    stageLeft={canvasStageLeft}
                    stageTop={CANVAS_WS_STAGE_TOP}
                    workspaceWidth={canvasWorkspaceWidth}
                    workspaceHeight={canvasWorkspaceHeight}
                    menuOpen={zoomMenuState.open}
                    menuRef={zoomMenuRef}
                    onZoomOut={() => { void runCommand('canvas.zoomOut'); }}
                    onZoomIn={() => { void runCommand('canvas.zoomIn'); }}
                    onToggleMenu={() => setZoomMenuState((current) => ({ open: !current.open }))}
                    onSelectScale={(nextScale) => {
                      updateCanvasScalePreset(nextScale);
                    }}
                    onFit={() => {
                      void runCommand('canvas.fitView');
                      setZoomMenuState({ open: false });
                    }}
                  />
                </div>
                <main
                  data-shenbi-shortcut-area="canvas"
                  ref={(node) => {
                    canvasScrollRef.current = node;
                  }}
                  className={`flex-1 overflow-auto scrollbar-hide relative canvas-grid ${canvasCursorClassName}`}
                  onContextMenu={(event) => openContextMenu('canvas', event)}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerCancel={handleCanvasPointerUp}
                  onDragOver={handleCanvasDragOver}
                  onDrop={handleCanvasDrop}
                  onDragLeave={handleCanvasDragLeave}
                >
                  <div
                    className="relative"
                    style={{
                      width: `${canvasWorkspaceWidth}px`,
                      height: `${canvasWorkspaceHeight}px`,
                      minWidth: `${canvasWorkspaceWidth}px`,
                      minHeight: `${canvasWorkspaceHeight}px`,
                    }}
                  >
                    <div
                      ref={stageRef}
                      className="absolute"
                      style={{
                        left: `${canvasStageLeft}px`,
                        top: `${CANVAS_WS_STAGE_TOP}px`,
                        width: `${stageWidth + (showDeviceFrame && activeDevice.frame ? (DEVICE_FRAME_PADDING[activeDevice.frame]?.[1] ?? 0) + (DEVICE_FRAME_PADDING[activeDevice.frame]?.[3] ?? 0) : 0)}px`,
                        minHeight: `${STAGE_MIN_HEIGHT + (showDeviceFrame && activeDevice.frame ? (DEVICE_FRAME_PADDING[activeDevice.frame]?.[0] ?? 0) + (DEVICE_FRAME_PADDING[activeDevice.frame]?.[2] ?? 0) : 0)}px`,
                        transform: `translate3d(0, 0, 0) scale(${canvasScale})`,
                        transformOrigin: 'top left',
                        willChange: 'transform',
                        backfaceVisibility: 'hidden',
                      }}
                    >
                      {showDeviceFrame && activeDevice.frame ? (
                        <div className={`device-frame device-frame--${activeDevice.frame}`}>
                          <div className="relative z-10 stage-viewport rounded-sm overflow-hidden border border-border-ide" style={{ width: `${stageWidth}px`, minHeight: `${STAGE_MIN_HEIGHT}px` }}>
                            <CanvasSurface
                              mode={renderMode}
                              themeClassName={`theme-${theme}`}
                              pointerEventsDisabled={Boolean(canvasDragSession)}
                              onReady={setCanvasSurface}
                            >
                              {children}
                            </CanvasSurface>
                            {canvasDropIndicator ? (
                              <div
                                className={`absolute z-[55] ${canvasDropIndicator.variant === 'line' ? 'bg-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]' : 'border-2 border-dashed border-blue-500 bg-blue-500/8'}`}
                                style={{
                                  top: canvasDropIndicator.top,
                                  left: canvasDropIndicator.left,
                                  width: canvasDropIndicator.width,
                                  height: canvasDropIndicator.variant === 'line'
                                    ? 2
                                    : Math.max(canvasDropIndicator.height, 24),
                                  pointerEvents: 'none',
                                }}
                              />
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="relative z-10 stage-viewport rounded-sm overflow-hidden border border-border-ide" style={{ width: `${stageWidth}px`, minHeight: `${STAGE_MIN_HEIGHT}px` }}>
                          <CanvasSurface
                            mode={renderMode}
                            themeClassName={`theme-${theme}`}
                            pointerEventsDisabled={Boolean(canvasDragSession)}
                            onReady={setCanvasSurface}
                          >
                            {children}
                          </CanvasSurface>
                          {canvasDropIndicator ? (
                            <div
                              className={`absolute z-[55] ${canvasDropIndicator.variant === 'line' ? 'bg-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]' : 'border-2 border-dashed border-blue-500 bg-blue-500/8'}`}
                              style={{
                                top: canvasDropIndicator.top,
                                left: canvasDropIndicator.left,
                                width: canvasDropIndicator.width,
                                height: canvasDropIndicator.variant === 'line'
                                  ? 2
                                  : Math.max(canvasDropIndicator.height, 24),
                                pointerEvents: 'none',
                              }}
                            />
                          ) : null}
                        </div>
                      )}
                    </div>

                    {/* Selection overlay — rendered OUTSIDE the scaled stage at native 1x.
                        Positions are computed in canvas-space (rect * canvasScale). */}
                    {(() => {
                      const framePad = showDeviceFrame && activeDevice.frame
                        ? DEVICE_FRAME_PADDING[activeDevice.frame]
                        : undefined;
                      const overlayOffsetLeft = framePad ? framePad[3] * canvasScale : 0;
                      const overlayOffsetTop = framePad ? framePad[0] * canvasScale : 0;
                      return (
                        <div
                          className="absolute"
                          style={{
                            left: `${canvasStageLeft + overlayOffsetLeft}px`,
                            top: `${CANVAS_WS_STAGE_TOP + overlayOffsetTop}px`,
                            width: `${stageWidth * canvasScale}px`,
                            height: `${Math.max(stageContentHeight, STAGE_MIN_HEIGHT) * canvasScale}px`,
                            pointerEvents: 'none',
                            zIndex: 20,
                          }}
                        >
                      <SelectionOverlay
                        surface={canvasSurface}
                        selectedNodeSchemaId={selectedNodeSchemaId}
                        externalHoverNodeSchemaId={activeCanvasTool === 'pan' ? undefined : hoveredNodeSchemaId}
                        ancestorItems={breadcrumbItems}
                        actions={selectionOverlayActions}
                        onSelectAncestor={onBreadcrumbSelect}
                        onHoverAncestor={onBreadcrumbHover}
                        hoverEnabled={activeCanvasTool !== 'pan'}
                        dragSelectedEnabled={!canvasReadOnly && activeCanvasTool !== 'pan' && Boolean(selectedNodeTreeId)}
                        onStartDragSelected={handleSelectedDragStart}
                        onEndDragSelected={clearCanvasDragState}
                        canvasScale={canvasScale}
                      />
                    </div>
                      );
                    })()}

                    {/* Device Preview Bar — independently positioned above the full stage+frame */}
                    {(() => {
                      const framePadH = showDeviceFrame && activeDevice.frame
                        ? (DEVICE_FRAME_PADDING[activeDevice.frame]?.[1] ?? 0) + (DEVICE_FRAME_PADDING[activeDevice.frame]?.[3] ?? 0)
                        : 0;
                      const totalVisualW = (stageWidth + framePadH) * canvasScale;
                      return (
                        <div
                          className="absolute flex items-center justify-center"
                          style={{
                            left: `${canvasStageLeft}px`,
                            top: `${CANVAS_WS_STAGE_TOP - 48}px`,
                            width: `${totalVisualW}px`,
                            pointerEvents: 'none',
                            zIndex: 20,
                          }}
                        >
                          <DevicePreviewBar
                            presets={DEVICE_PRESETS}
                            activeDeviceId={activeDeviceId}
                            stageWidth={stageWidth}
                            stageMinHeight={STAGE_MIN_HEIGHT}
                            scale={canvasViewportState.scale}
                            showDeviceFrame={showDeviceFrame}
                            hasFrame={Boolean(activeDevice.frame)}
                            onSelectDevice={(id) => {
                              setActiveDeviceId(id);
                            }}
                            onChangeWidth={setCustomStageWidth}
                            onToggleFrame={() => setShowDeviceFrame((v) => !v)}
                            onSelectScale={updateCanvasScalePreset}
                            onFit={fitCanvasToViewport}
                          />
                        </div>
                      );
                    })()}
                  </div>
                </main>
              </div>
              )}
                <CommandPalette
                  commands={commandPaletteCommands}
                  recentCommandIds={recentCommandIdsRef.current}
                  open={showCommandPalette}
                  onClose={() => setShowCommandPalette(false)}
                onRunCommand={(commandId) => {
                  void runCommand(commandId);
                }}
              />
              <ContextMenuOverlay
                items={activeContextMenuItems}
                open={contextMenuState.open}
                position={contextMenuState.position}
                onClose={() => setContextMenuState((current) => ({ ...current, open: false }))}
                onRunCommand={(commandId) => {
                  void runCommand(commandId);
                }}
              />
              
              {showConsole && (
                <div style={{ height: consoleSize }} className="relative shrink-0 flex flex-col w-full">
                  <div 
                    className="absolute top-0 left-0 right-0 h-1 -mt-[2px] cursor-row-resize hover:bg-blue-500 z-20 transition-colors"
                    onMouseDown={(e) => startConsoleResize(e, 'vertical', true)}
                  />
                  <Console />
                </div>
              )}
            </div>

            {showAssistantPanel && activeAuxiliaryPanel ? (
              <div style={{ width: assistantPanelSize }} className="relative shrink-0 flex flex-col h-full border-r border-border-ide">
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1 -ml-[2px] cursor-col-resize hover:bg-blue-500 z-20 transition-colors"
                  onMouseDown={(e) => startAIPanelResize(e, 'horizontal', true)}
                />
                {activeAuxiliaryPanel.render(resolvedPluginContext)}
              </div>
            ) : null}

            {showInspector && (
              <div
                style={{ width: inspectorSize }}
                className="relative shrink-0 flex flex-col h-full"
                data-shenbi-shortcut-area="inspector"
                onContextMenu={(event) => openContextMenu('inspector', event)}
              >
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1 -ml-[2px] cursor-col-resize hover:bg-blue-500 z-20 transition-colors"
                  onMouseDown={(e) => startInspectorResize(e, 'horizontal', true)}
                />
                <Inspector
                  {...inspectorProps}
                  tabs={inspectorTabs}
                  pluginContext={resolvedPluginContext}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <StatusBar />
    </div>
  );
}

