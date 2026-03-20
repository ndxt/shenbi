import React from 'react';
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
import { SelectionOverlay } from './SelectionOverlay';
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

interface AppShellProps {
  children: React.ReactNode;
  workspaceId: string;
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
  /** 当前选中节点的 schema node id（用于画布选中高亮框） */
  selectedNodeSchemaId?: string;
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

export function AppShell({
  children,
  workspaceId,
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
  selectedNodeSchemaId,
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
}: AppShellProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const canvasContentRef = React.useRef<HTMLDivElement | null>(null);
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
  const fileContextTabs = React.useMemo(() => {
    if (activeEditorTab?.fileType !== 'page') {
      return [];
    }
    const contextualTabs = pluginContributes.fileContextPanels
      .filter((panel) => {
        if (!panel.fileTypes || panel.fileTypes.length === 0) {
          return true;
        }
        return panel.fileTypes.includes(activeEditorTab.fileType);
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
    return [...contextualTabs, ...fileContextLegacyTabs];
  }, [activeEditorTab, fileContextLegacyTabs, pluginContributes.fileContextPanels]);
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
    if (activeEditorTab?.fileType === 'page') {
      setShowFileContextPanel(true);
    }
  }, [activeEditorTab?.fileType]);
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
    t,
  }), [
    auxiliaryPanels.length,
    isMaximized,
    pluginContext,
    showAssistantPanel,
    showConsole,
    showInspector,
    showSidebar,
    t,
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
      };
    }

    return {
      ...baseContext,
      editorFocused: isEditorActive,
      inputFocused: paletteInputFocused ? false : baseContext.inputFocused,
      canvasFocused: area === 'canvas',
      sidebarFocused: area === 'sidebar',
      inspectorFocused: area === 'inspector',
      activityBarFocused: area === 'activity-bar',
    };
  }, [focusVersion, pluginContext?.selection, showInspector, showSidebar]);
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
    pluginContext: resolvedPluginContext,
  }), [
    resolvedPluginContext,
    sidebarProps?.contracts,
    sidebarProps?.onInsertComponent,
    sidebarProps?.onSelectNode,
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

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    allShortcuts,
    pluginContext?.selection,
    resolveCommandState,
    runCommand,
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
    if (activeEditorTab?.fileType === 'page') {
      setShowFileContextPanel(true);
    }
    if (!showSidebar && item.target?.type === 'panel') {
      setShowSidebar(true);
      setIsMaximized(false);
    }
  };

  const handleCanvasClickCapture = (event: React.MouseEvent<HTMLElement>) => {
    if (contextMenuState.open) {
      setContextMenuState((current) => ({ ...current, open: false }));
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    // 忽略点击 selection overlay（标签、下拉菜单等）
    if (target.closest('.selection-overlay') || target.closest('.selection-overlay__dropdown')) {
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
  };

  const openContextMenu = (area: ContextMenuArea, event: React.MouseEvent<HTMLElement>) => {
    const items = getContextMenuItems(area);
    if (items.length === 0) {
      return;
    }

    event.preventDefault();
    setContextMenuState({
      open: true,
      area,
      position: {
        x: event.clientX,
        y: event.clientY,
      },
    });
  };

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
  const shouldRenderFileContextPanel = activeEditorTab?.fileType === 'page' && showFileContextPanel;

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
              <main
                data-shenbi-shortcut-area="canvas"
                className="flex-1 overflow-auto p-12 flex justify-center items-start scrollbar-hide relative canvas-grid"
                onContextMenu={(event) => openContextMenu('canvas', event)}
              >
                {/* The Stage / Viewport */}
                <div className="relative z-10 stage-viewport min-h-[600px] w-full max-w-[1200px] rounded-sm overflow-hidden border border-border-ide">
                  <div className="bg-white min-h-full relative" ref={canvasContentRef} onClickCapture={handleCanvasClickCapture}>
                    {children}
                    <SelectionOverlay
                      containerRef={canvasContentRef}
                      selectedNodeSchemaId={selectedNodeSchemaId}
                      externalHoverNodeSchemaId={hoveredNodeSchemaId}
                      ancestorItems={breadcrumbItems}
                      onSelectAncestor={onBreadcrumbSelect}
                      onHoverAncestor={onBreadcrumbHover}
                    />
                  </div>
                  
                  {/* Viewport Meta Info (Figma Style) */}
                  <div className="absolute -top-6 left-0 text-[10px] text-text-secondary font-mono flex gap-3">
                    <span>1200 x 800</span>
                    <span>100%</span>
                  </div>
                </div>
              </main>
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
