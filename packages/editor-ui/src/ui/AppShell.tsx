import React from 'react';
import {
  collectPluginContributes,
  type EditorPluginManifest,
  type PluginContext,
} from '@shenbi/editor-plugin-api';
import { ActivityBar } from './ActivityBar';
import { Sidebar } from './Sidebar';
import { WorkbenchToolbar } from './WorkbenchToolbar';
import { EditorTabs } from './EditorTabs';
import { Inspector } from './Inspector';
import { AIPanel, type AIPanelProps } from './AIPanel';
import { Console } from './Console';
import { StatusBar } from './StatusBar';
import '../styles/editor-ui.css';
import { useResize } from '../hooks/useResize';

import { TitleBar } from './TitleBar';
import type { ActivityBarItemContribution, ActivityBarProps } from './ActivityBar';
import type { SidebarProps } from './Sidebar';
import type { InspectorProps } from './Inspector';

interface AppShellProps {
  children: React.ReactNode;
  toolbarExtra?: React.ReactNode;
  activityBarProps?: ActivityBarProps;
  sidebarProps?: SidebarProps;
  inspectorProps?: InspectorProps;
  aiPanelProps?: AIPanelProps;
  plugins?: EditorPluginManifest[];
  pluginContext?: PluginContext;
  onCanvasSelectNode?: (nodeId: string) => void;
}

export type ThemeMode = 'light' | 'dark' | 'cursor' | 'webstorm-dark';

const THEME_CLASSES = [
  'theme-light',
  'theme-dark',
  'theme-cursor',
  'theme-webstorm-light',
  'theme-webstorm-dark',
] as const;

export function AppShell({
  children,
  toolbarExtra,
  activityBarProps,
  sidebarProps,
  inspectorProps,
  aiPanelProps,
  plugins,
  pluginContext,
  onCanvasSelectNode,
}: AppShellProps) {
  const [theme, setTheme] = React.useState<ThemeMode>('dark');
  
  // Panel Visibility State
  const [showSidebar, setShowSidebar] = React.useState(true);
  const [showInspector, setShowInspector] = React.useState(true);
  const [showConsole, setShowConsole] = React.useState(true);
  const [showAssistantPanel, setShowAssistantPanel] = React.useState(false);
  const [activeSidebarTabId, setActiveSidebarTabId] = React.useState('components');
  const [activeAuxiliaryPanelId, setActiveAuxiliaryPanelId] = React.useState<string | undefined>(undefined);

  const [isMaximized, setIsMaximized] = React.useState(false);
  const [previousPanelState, setPreviousPanelState] = React.useState({
    sidebar: true,
    inspector: true,
    console: true,
    assistantPanel: false,
  });

  const toggleMaximize = () => {
    if (isMaximized) {
      setShowSidebar(previousPanelState.sidebar);
      setShowInspector(previousPanelState.inspector);
      setShowConsole(previousPanelState.console);
      setShowAssistantPanel(previousPanelState.assistantPanel);
      setIsMaximized(false);
    } else {
      setPreviousPanelState({
        sidebar: showSidebar,
        inspector: showInspector,
        console: showConsole,
        assistantPanel: showAssistantPanel,
      });
      setShowSidebar(false);
      setShowInspector(false);
      setShowConsole(false);
      setShowAssistantPanel(false);
      setIsMaximized(true);
    }
  };

  // Panel Size State
  const { size: sidebarSize, startResize: startSidebarResize } = useResize(256, 160, 600);
  const { size: inspectorSize, startResize: startInspectorResize } = useResize(256, 160, 600);
  const { size: aiPanelSize, startResize: startAIPanelResize } = useResize(300, 200, 800);
  const { size: consoleSize, startResize: startConsoleResize } = useResize(192, 100, 800);
  const pluginContributes = React.useMemo(
    () => collectPluginContributes(plugins),
    [plugins],
  );
  const resolvedPluginContext = React.useMemo<PluginContext>(() => {
    const hostExecute = pluginContext?.commands?.execute;
    let context!: PluginContext;
    const execute = (commandId: string, payload?: unknown) => {
      const pluginCommand = pluginContributes.commands.find((item) => item.id === commandId);
      if (pluginCommand) {
        return pluginCommand.execute(context, payload);
      }
      return hostExecute?.(commandId, payload);
    };
    context = {
      ...pluginContext,
      commands: {
        execute,
      },
    };
    return context;
  }, [pluginContext, pluginContributes.commands]);
  const activityItems = React.useMemo(
    () => [
      ...pluginContributes.activityBarItems,
      ...(activityBarProps?.items ?? []),
    ],
    [activityBarProps?.items, pluginContributes.activityBarItems],
  );
  const sidebarTabs = React.useMemo(
    () => [
      ...pluginContributes.sidebarTabs,
      ...(sidebarProps?.tabs ?? []),
    ],
    [pluginContributes.sidebarTabs, sidebarProps?.tabs],
  );
  const inspectorTabs = React.useMemo(
    () => [
      ...pluginContributes.inspectorTabs,
      ...(inspectorProps?.tabs ?? []),
    ],
    [inspectorProps?.tabs, pluginContributes.inspectorTabs],
  );
  const auxiliaryPanels = React.useMemo(() => {
    const panels = [...pluginContributes.auxiliaryPanels];
    if (aiPanelProps) {
      panels.push({
        id: 'legacy.ai-assistant',
        label: 'AI Assistant',
        order: 1000,
        defaultWidth: 300,
        render: () => <AIPanel {...aiPanelProps} />,
      });
    }
    return panels.sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  }, [aiPanelProps, pluginContributes.auxiliaryPanels]);
  const activeAuxiliaryPanel = React.useMemo(
    () => auxiliaryPanels.find((panel) => panel.id === activeAuxiliaryPanelId) ?? auxiliaryPanels[0],
    [activeAuxiliaryPanelId, auxiliaryPanels],
  );
  const assistantPanelSize = activeAuxiliaryPanel?.defaultWidth ?? aiPanelSize;

  const toggleTheme = (newTheme: ThemeMode) => {
    setTheme(newTheme);
  };

  React.useEffect(() => {
    if (auxiliaryPanels.length === 0) {
      if (showAssistantPanel) {
        setShowAssistantPanel(false);
      }
      if (activeAuxiliaryPanelId !== undefined) {
        setActiveAuxiliaryPanelId(undefined);
      }
      return;
    }
    const fallbackPanel = auxiliaryPanels.find((panel) => panel.defaultOpen) ?? auxiliaryPanels[0];
    const nextPanelId = activeAuxiliaryPanelId ?? fallbackPanel?.id;
    if (nextPanelId !== activeAuxiliaryPanelId) {
      setActiveAuxiliaryPanelId(nextPanelId);
    }
    if (!showAssistantPanel && auxiliaryPanels.some((panel) => panel.defaultOpen)) {
      setShowAssistantPanel(true);
    }
  }, [activeAuxiliaryPanelId, auxiliaryPanels, showAssistantPanel]);

  React.useEffect(() => {
    const cleanups: Array<() => void> = [];
    for (const plugin of plugins ?? []) {
      if (!plugin.activate) {
        continue;
      }
      const result = plugin.activate(resolvedPluginContext);
      if (typeof result === 'function') {
        cleanups.push(result);
        continue;
      }
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        void (result as Promise<void | (() => void)>).then((cleanup) => {
          if (typeof cleanup === 'function') {
            cleanups.push(cleanup);
          }
        });
      }
    }
    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, [plugins, resolvedPluginContext]);

  const handleActivitySelectItem = (item: ActivityBarItemContribution) => {
    activityBarProps?.onSelectItem?.(item);
    if (!item.targetSidebarTabId) {
      return;
    }
    setActiveSidebarTabId(item.targetSidebarTabId);
    if (!showSidebar) {
      setShowSidebar(true);
      setIsMaximized(false);
    }
  };

  const handleCanvasClickCapture = (event: React.MouseEvent<HTMLElement>) => {
    if (!onCanvasSelectNode) {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const hit = target.closest('[data-shenbi-node-id]');
    if (!hit) {
      return;
    }
    const nodeId = hit.getAttribute('data-shenbi-node-id');
    if (!nodeId) {
      return;
    }
    onCanvasSelectNode(nodeId);
    if (!showInspector) {
      setShowInspector(true);
      setIsMaximized(false);
    }
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

  return (
    <div className="h-screen w-screen flex flex-col bg-bg-canvas text-text-primary overflow-hidden font-inter">
      <TitleBar 
        theme={theme} 
        onToggleTheme={toggleTheme}
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
      />
      
      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        <ActivityBar
          {...activityBarProps}
          items={activityItems}
          onSelectItem={handleActivitySelectItem}
        />
        
        {showSidebar && (
          <div style={{ width: sidebarSize }} className="relative shrink-0 flex flex-col h-full">
            <Sidebar
              {...sidebarProps}
              tabs={sidebarTabs}
              activeTabId={activeSidebarTabId}
              onChangeActiveTab={setActiveSidebarTabId}
              pluginContext={resolvedPluginContext}
            />
            <div 
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-20 transition-colors"
              onMouseDown={(e) => startSidebarResize(e, 'horizontal', false)}
            />
          </div>
        )}
        
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <EditorTabs />
          <WorkbenchToolbar extra={toolbarExtra} />
          
          <div className="flex-1 flex overflow-hidden">
            {/* Editor/Canvas Area Container */}
            <div className="flex-1 flex flex-col overflow-hidden relative bg-bg-canvas">
              <main className="flex-1 overflow-auto p-12 flex justify-center items-start scrollbar-hide relative canvas-grid">
                {/* The Stage / Viewport */}
                <div className="relative z-10 stage-viewport min-h-[600px] w-full max-w-[1200px] rounded-sm overflow-hidden border border-border-ide">
                  <div className="bg-white min-h-full" onClickCapture={handleCanvasClickCapture}>
                    {children}
                  </div>
                  
                  {/* Viewport Meta Info (Figma Style) */}
                  <div className="absolute -top-6 left-0 text-[10px] text-text-secondary font-mono flex gap-3">
                    <span>1200 x 800</span>
                    <span>100%</span>
                  </div>
                </div>
              </main>
              
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
              <div style={{ width: inspectorSize }} className="relative shrink-0 flex flex-col h-full">
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
