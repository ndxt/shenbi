import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as antd from 'antd';
import { builtinContracts } from '@shenbi/schema';
import {
  IndexedDBFileSystemAdapter,
  PageDocumentProvider,
  TabManager,
  createEditor,
} from '@shenbi/editor-core';
import {
  AppShell,
  createWorkspacePersistenceService,
  LocalWorkspacePersistenceAdapter,
  isCommandBlockedDuringGeneration,
  useHostCommandPolicy,
  useDialog,
  useEditorHostBridge,
  useEditorSession,
  usePluginContext,
  useScenarioSession,
  useShellModeUrl,
  useTabManager,
} from '@shenbi/editor-ui';
import { useCurrentLocale, useTranslation } from '@shenbi/i18n';
import { PREVIEW_WORKSPACE_ID, loadProjectList } from './constants';
import type { ActiveProjectConfig } from './constants';
import { ProjectManagerDialog } from './ProjectManagerDialog';
import { PreviewCanvasStage } from './components/PreviewCanvasStage';
import { PreviewToolbar } from './components/PreviewToolbar';
import {
  canSchemaNodeAcceptCanvasChildren,
  cloneSchema,
  createEmptyShellSchema,
  createInitialScenarioSnapshots,
  createInitialScenarioState,
  createScenarioSnapshot,
  resolveCanvasDropPosition,
} from './editor/previewSchemaUtils';
import { usePreviewCanvasState } from './hooks/usePreviewCanvasState';
import { usePreviewPersistence } from './hooks/usePreviewPersistence';
import { usePreviewPlugins } from './hooks/usePreviewPlugins';
import { usePreviewProjectState } from './hooks/usePreviewProjectState';
import { usePreviewWorkspaceState } from './hooks/usePreviewWorkspaceState';
import { WelcomeScreen } from './WelcomeScreen';
import {
  type AppMode,
  DEFAULT_RENDER_MODE,
  type RenderMode,
  type ScenarioKey,
} from './preview-types';
import { createPreviewServiceContainer } from './services';

export { canSchemaNodeAcceptCanvasChildren, resolveCanvasDropPosition };

export function App() {
  // If we're inside an OAuth popup (opened by window.open), close it immediately.
  // After GitLab OAuth completes, the redirect_uri points back to our app.
  // The opener (main window) polls popup.closed to detect completion.
  useEffect(() => {
    if (window.opener && window.name === 'gitlab-oauth') {
      window.close();
    }
  }, []);

  // Don't render anything if we're in the OAuth popup
  if (window.opener && window.name === 'gitlab-oauth') {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888', fontSize: 14 }}>授权完成，正在关闭窗口...</div>;
  }

  const { t: previewT } = useTranslation('preview');
  const { t: filesT } = useTranslation('pluginFiles');
  const currentLocale = useCurrentLocale();
  const [appMode, setAppMode] = useShellModeUrl();
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>('user-management');
  const [renderMode, setRenderMode] = useState<RenderMode>(DEFAULT_RENDER_MODE);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showWelcomeOverride, setShowWelcomeOverride] = useState(false);
  const [welcomeInitialMode, setWelcomeInitialMode] = useState<'new' | 'clone' | undefined>(undefined);
  const [rendererUndoRedoStateByFile, setRendererUndoRedoStateByFile] = useState<Record<string, { canUndo: boolean; canRedo: boolean }>>({});
  const activeRendererDispatchRef = useRef<{ save: () => void; undo: () => void; redo: () => void } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm: dialogConfirm, prompt: dialogPrompt, DialogPortal } = useDialog();

  // Listen for Clone button event from WelcomeScreen
  useEffect(() => {
    const handleOpenProjectManager = () => setShowProjectManager(true);
    window.addEventListener('shenbi:open-project-manager', handleOpenProjectManager);
    return () => window.removeEventListener('shenbi:open-project-manager', handleOpenProjectManager);
  }, []);

  const persistenceAdapter = useMemo(() => new LocalWorkspacePersistenceAdapter(), []);
  const workspacePersistence = useMemo(
    () => createWorkspacePersistenceService(PREVIEW_WORKSPACE_ID, persistenceAdapter),
    [persistenceAdapter],
  );
  const services = useMemo(() => createPreviewServiceContainer(), []);
  const projectState = usePreviewProjectState({
    gitlabService: services.gitlab,
  });
  const vfs = useMemo(() => new IndexedDBFileSystemAdapter(), []);
  const tabManager = useMemo(() => new TabManager(), []);
  const initialScenarioSnapshots = useMemo(() => createInitialScenarioSnapshots(), []);
  const initialScenarioSchemas = useMemo(() => createInitialScenarioState(), []);
  const initialShellSchema = useMemo(() => createEmptyShellSchema(), []);
  const scenarioOptions = useMemo<{ label: string; value: ScenarioKey }[]>(() => ([
    { label: previewT('scenarios.userManagement'), value: 'user-management' },
    { label: previewT('scenarios.formList'), value: 'form-list' },
    { label: previewT('scenarios.tabsDetail'), value: 'tabs-detail' },
    { label: previewT('scenarios.treeManagement'), value: 'tree-management' },
    { label: previewT('scenarios.descriptions'), value: 'descriptions' },
    { label: previewT('scenarios.drawerDetail'), value: 'drawer-detail' },
    { label: previewT('scenarios.nineGrid'), value: 'nine-grid' },
  ]), [currentLocale, previewT]);
  const modeOptions = useMemo<{ label: string; value: AppMode }[]>(() => ([
    { label: previewT('modeOptions.scenarios'), value: 'scenarios' },
    { label: previewT('modeOptions.shell'), value: 'shell' },
  ]), [currentLocale, previewT]);

  const {
    activeScenarioSnapshot,
    updateScenarioSnapshot,
    updateScenarioSchema,
    setScenarioSelectedNodeId,
    executeScenarioCommand,
  } = useScenarioSession({
    activeScenario,
    initialSnapshots: initialScenarioSnapshots,
  });
  const {
    editor: fileEditor,
    shellSnapshot,
    setShellSelectedNodeId,
    updateActiveSchema,
  } = useEditorSession({
    mode: appMode,
    initialShellSchema,
    updateScenarioSchema,
    onError: (message) => {
      antd.message.error(message);
    },
    createEditorInstance: () => createEditor({
      initialSchema: createEmptyShellSchema(),
      vfs,
      tabManager,
      projectId: projectState.activeProjectId ?? '',
    }),
  });
  const documentTabSnapshot = useTabManager(tabManager);
  const activeDocumentTab = useMemo(
    () => documentTabSnapshot.tabs.find((tab) => tab.fileId === documentTabSnapshot.activeTabId),
    [documentTabSnapshot.activeTabId, documentTabSnapshot.tabs],
  );
  const pageDocumentProvider = useMemo(() => {
    if (!activeDocumentTab || activeDocumentTab.fileType !== 'page') {
      return undefined;
    }
    return new PageDocumentProvider({
      fileId: activeDocumentTab.fileId,
      state: fileEditor.state,
      commands: fileEditor.commands,
    });
  }, [activeDocumentTab, fileEditor.commands, fileEditor.state]);
  const [pageDocumentState, setPageDocumentState] = useState<ReturnType<PageDocumentProvider['getState']> | undefined>(() => {
    return pageDocumentProvider?.getState();
  });
  useEffect(() => {
    if (!pageDocumentProvider) {
      setPageDocumentState(undefined);
      return undefined;
    }
    setPageDocumentState(pageDocumentProvider.getState());
    const unsubscribe = pageDocumentProvider.subscribe((state) => {
      setPageDocumentState(state);
    });
    return () => {
      unsubscribe();
      pageDocumentProvider.dispose();
    };
  }, [pageDocumentProvider]);
  const activeDocument = useMemo(() => {
    if (appMode !== 'shell' || !activeDocumentTab) {
      return undefined;
    }

    if (activeDocumentTab.fileType !== 'page') {
      const undoRedoState = rendererUndoRedoStateByFile[activeDocumentTab.fileId] ?? { canUndo: false, canRedo: false };
      return {
        state: {
          isDirty: activeDocumentTab.isDirty,
          canUndo: undoRedoState.canUndo,
          canRedo: undoRedoState.canRedo,
        },
        actions: {
          save: () => fileEditor.commands.execute('tab.save').then(() => undefined),
          undo: () => {
            activeRendererDispatchRef.current?.undo();
          },
          redo: () => {
            activeRendererDispatchRef.current?.redo();
          },
        },
      };
    }

    return {
      state: {
        isDirty: pageDocumentState?.isDirty ?? shellSnapshot.isDirty,
        canUndo: pageDocumentState?.canUndo ?? shellSnapshot.canUndo,
        canRedo: pageDocumentState?.canRedo ?? shellSnapshot.canRedo,
      },
      actions: {
        save: () => fileEditor.commands.execute('tab.save').then(() => undefined),
        undo: () => {
          pageDocumentProvider?.undo();
        },
        redo: () => {
          pageDocumentProvider?.redo();
        },
      },
    };
  }, [
    activeDocumentTab,
    appMode,
    fileEditor.commands,
    pageDocumentProvider,
    pageDocumentState,
    rendererUndoRedoStateByFile,
    shellSnapshot.canRedo,
    shellSnapshot.canUndo,
    shellSnapshot.isDirty,
  ]);

  const workspaceState = usePreviewWorkspaceState({
    appMode,
    activeProjectId: projectState.activeProjectId ?? '',
    activeScenarioSnapshot,
    consumePendingMigration: projectState.consumePendingMigration,
    fileEditor,
    previewT: previewT as (...args: any[]) => string,
    filesT: filesT as (...args: any[]) => string,
    shellSnapshot,
    tabManager,
    vfs,
    activeDocument,
    dialogs: {
      confirmClose: (message: string) => dialogConfirm(message),
      promptFileName: (defaultName: string) => dialogPrompt(previewT('prompt.enterFileName'), defaultName),
    },
  });

  usePreviewPersistence({
    appMode,
    activeProjectId: projectState.activeProjectId ?? '',
    activeScenario,
    setActiveScenario,
    renderMode,
    setRenderMode,
    fileEditor,
    fileExplorerExpandedIds: workspaceState.fileExplorerExpandedIds,
    fileExplorerFocusedId: workspaceState.fileExplorerFocusedId,
    setFileExplorerExpandedIds: (value) => workspaceState.setFileExplorerExpandedIds(value),
    setFileExplorerFocusedId: (value) => workspaceState.setFileExplorerFocusedId(value),
    scenarioValues: scenarioOptions.map((option) => option.value),
    tabManager,
    tabSnapshot: workspaceState.tabSnapshot,
    vfs,
    vfsInitialized: workspaceState.vfsInitialized,
    vfsInitializationFailed: workspaceState.vfsInitializationFailed,
    workspacePersistence,
    sessions: fileEditor.sessions!,
  });

  const activeSchema = appMode === 'shell' ? shellSnapshot.schema : activeScenarioSnapshot.schema;
  const shellSchemaName = appMode === 'shell' && workspaceState.tabSnapshot.tabs.length === 0
    ? undefined
    : activeSchema.name;
  const handleExportJSON = useCallback(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const fileNameBase = (shellSchemaName ?? activeSchema.name ?? 'schema')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-');
    const blob = new Blob([JSON.stringify(activeSchema, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const downloadUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = `${fileNameBase || 'schema'}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }, [activeSchema, shellSchemaName]);

  const canvasState = usePreviewCanvasState({
    appMode,
    activeSchema,
    executeScenarioCommand,
    fileEditor,
    notifyGenerationLock: workspaceState.notifyGenerationLock,
    scenarioSelectedNodeId: activeScenarioSnapshot.selectedNodeId,
    setScenarioSelectedNodeId,
    shellSelectedNodeId: shellSnapshot.selectedNodeId,
    setShellSelectedNodeId,
    updateScenarioSchema,
  });

  const notifications = useMemo(() => ({
    info: (message: string) => antd.message.info(message),
    success: (message: string) => antd.message.success(message),
    warning: (message: string) => antd.message.warning(message),
    error: (message: string) => antd.message.error(message),
  }), []);
  const promptFileName = useCallback(async (defaultName: string) => {
    return await dialogPrompt(previewT('prompt.enterFileName'), defaultName);
  }, [dialogPrompt, previewT]);
  const { executePluginCommand: executeHostPluginCommand } = useEditorHostBridge({
    mode: appMode,
    shellCommands: fileEditor.commands,
    scenarioCommands: executeScenarioCommand,
    activeFileId: appMode === 'shell'
      ? shellSnapshot.currentFileId
      : activeScenarioSnapshot.currentFileId,
    schemaName: activeSchema.name,
    promptFileName,
  });

  const handleResetWorkspace = useCallback(async () => {
    if (appMode === 'shell') {
      const emptySchema = createEmptyShellSchema();
      await fileEditor.commands.execute('editor.restoreSnapshot', {
        snapshot: {
          schema: emptySchema,
          isDirty: Boolean(shellSnapshot.currentFileId),
          ...(shellSnapshot.currentFileId ? { currentFileId: shellSnapshot.currentFileId } : {}),
        },
      });
      return;
    }

    updateScenarioSnapshot(activeScenario, (previousSnapshot) => ({
      ...previousSnapshot,
      ...createScenarioSnapshot(cloneSchema(initialScenarioSchemas[activeScenario])),
      ...(previousSnapshot.currentFileId ? { currentFileId: previousSnapshot.currentFileId } : {}),
    }));
    setScenarioSelectedNodeId(undefined);
  }, [
    activeScenario,
    appMode,
    fileEditor.commands,
    initialScenarioSchemas,
    setScenarioSelectedNodeId,
    shellSnapshot.currentFileId,
    updateScenarioSnapshot,
  ]);

  const executeBaseCommand = useCallback((commandId: string, payload?: unknown) => {
    return Promise.resolve(executeHostPluginCommand(commandId, payload));
  }, [executeHostPluginCommand]);
  const { executeCommand: executeAppCommand } = useHostCommandPolicy({
    executeBaseCommand,
    interceptors: [
      {
        matches: (commandId) => (
          appMode === 'shell'
          && workspaceState.shellGenerationLock
          && isCommandBlockedDuringGeneration(commandId)
        ),
        handle: () => {
          antd.message.warning(workspaceState.shellGenerationReason);
          return undefined;
        },
      },
    ],
    commandHandlers: {
      'shell.ensureCurrentTab': workspaceState.ensureCurrentShellTab,
      'workspace.resetDocument': handleResetWorkspace,
    },
  });

  const pluginContext = usePluginContext({
    schema: activeSchema,
    selectedNode: canvasState.selectedNode,
    selectedNodeId: canvasState.selectedNodeId,
    replaceSchema: (schema) => {
      if (!workspaceState.notifyGenerationLock()) {
        updateActiveSchema(() => schema);
      }
    },
    patchSelectedNode: canvasState.patchSelectedNode,
    executeCommand: executeAppCommand,
    notifications,
    ...(workspaceState.filesystemService ? { filesystem: workspaceState.filesystemService } : {}),
  });

  const plugins = usePreviewPlugins({
    appMode,
    previewT: previewT as (...args: any[]) => string,
    filesT: filesT as (...args: any[]) => string,
    vfs,
    executeAppCommand,
    services,
    workspace: workspaceState,
    canvas: canvasState,
    project: projectState,
  });

  return (
    <>
    <AppShell
      workspaceId={PREVIEW_WORKSPACE_ID}
      persistenceAdapter={persistenceAdapter}
      renderMode={renderMode}
      canvasReadOnly={workspaceState.shellGenerationLock}
      title={projectState.activeProjectConfig?.projectName ?? ''}
      subtitle={projectState.activeProjectConfig?.branch}
      userAvatarUrl={projectState.gitlabUser?.avatarUrl}
      userName={projectState.gitlabUser?.username}
      branches={projectState.gitlabBranches.length > 0 ? projectState.gitlabBranches : undefined}
      onBranchChange={projectState.handleBranchChange}
      onLogout={projectState.gitlabUser ? projectState.handleLogout : undefined}
      gitlabUrl={projectState.activeProjectConfig?.gitlabUrl}
      onOpenProjectManager={() => setShowProjectManager(true)}
      projectList={useMemo(() => {
        const list = loadProjectList().sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
        return list.map((p) => ({
          id: p.id ?? p.vfsProjectId,
          name: p.projectName,
          gitlabProjectId: p.gitlabProjectId,
          branch: p.branch,
        }));
      }, [projectState.activeProjectConfig])}
      activeProjectId={projectState.activeProjectId ?? ''}
      onSwitchProject={useCallback((projectId: string) => {
        const list = loadProjectList();
        const target = list.find((p) => (p.id ?? p.vfsProjectId) === projectId);
        if (target) {
          projectState.handleSelectProject(target);
        }
      }, [projectState])}
      onNewProject={useCallback(() => {
        setShowWelcomeOverride(true);
        setWelcomeInitialMode('new');
      }, [])}
      onCloneRepository={useCallback(() => {
        setShowWelcomeOverride(true);
        setWelcomeInitialMode('clone');
      }, [])}
      sidebarProps={{
        contracts: builtinContracts,
        treeNodes: canvasState.treeNodes,
        onSelectNode: canvasState.selectTreeNode,
        ...(canvasState.selectedNodeId ? { selectedNodeId: canvasState.selectedNodeId } : {}),
        onInsertComponent: canvasState.handleInsertComponent,
      }}
      inspectorProps={{
        ...(canvasState.selectedNode ? { selectedNode: canvasState.selectedNode } : {}),
        ...(canvasState.selectedContract ? { contract: canvasState.selectedContract } : {}),
      }}
      plugins={plugins}
      pluginContext={pluginContext}
      onCanvasSelectNode={canvasState.handleCanvasSelectNode}
      onCanvasDeselectNode={canvasState.handleCanvasDeselectNode}
      {...(canvasState.selectedNodeId ? { selectedNodeTreeId: canvasState.selectedNodeId } : {})}
      canCanvasDropInsideNode={canvasState.canCanvasDropInsideNode}
      onCanvasInsertComponent={canvasState.handleCanvasInsertComponent}
      onCanvasMoveSelectedNode={canvasState.handleCanvasMoveSelectedNode}
      canDeleteSelectedNode={canvasState.canDeleteSelectedNode && !workspaceState.shellGenerationLock}
      canDuplicateSelectedNode={canvasState.canDuplicateSelectedNode && !workspaceState.shellGenerationLock}
      canMoveSelectedNodeUp={canvasState.canMoveSelectedNodeUp && !workspaceState.shellGenerationLock}
      canMoveSelectedNodeDown={canvasState.canMoveSelectedNodeDown && !workspaceState.shellGenerationLock}
      {...(canvasState.selectedNode?.id ? { selectedNodeSchemaId: canvasState.selectedNode.id } : {})}
      {...(canvasState.breadcrumbHoveredSchemaId ? { hoveredNodeSchemaId: canvasState.breadcrumbHoveredSchemaId } : {})}
      schemaName={shellSchemaName}
      breadcrumbItems={canvasState.breadcrumbItems}
      onBreadcrumbSelect={canvasState.handleBreadcrumbSelect}
      onBreadcrumbHover={canvasState.handleBreadcrumbHover}
      tabs={appMode === 'shell'
        ? workspaceState.tabSnapshot.tabs
        : undefined}
      activeTabId={workspaceState.tabSnapshot.activeTabId}
      onActivateTab={workspaceState.handleActivateTab}
      onCloseTab={workspaceState.handleCloseTab}
      onCloseOtherTabs={workspaceState.handleCloseOtherTabs}
      onCloseAllTabs={workspaceState.handleCloseAllTabs}
      onCloseSavedTabs={workspaceState.handleCloseSavedTabs}
      onMoveTab={workspaceState.handleMoveTab}
      onCanvasDocumentDirtyChange={useCallback((fileId: string, dirty: boolean) => {
        void fileEditor.commands.execute('tab.syncState', { fileId, isDirty: dirty });
      }, [fileEditor.commands])}
      onCanvasDocumentSchemaChange={useCallback((fileId: string, schema: Record<string, unknown>) => {
        void fileEditor.commands.execute('tab.syncState', { fileId, schema });
      }, [fileEditor.commands])}
      onCanvasDocumentUndoRedoStateChange={useCallback((fileId: string, state: { canUndo: boolean; canRedo: boolean }) => {
        setRendererUndoRedoStateByFile((previous) => {
          const current = previous[fileId];
          if (current?.canUndo === state.canUndo && current?.canRedo === state.canRedo) {
            return previous;
          }
          return { ...previous, [fileId]: state };
        });
      }, [])}
      onRendererSaveNotify={useCallback((dispatch: () => void) => {
        return fileEditor.eventBus!.on('file:saved', () => { dispatch(); });
      }, [fileEditor.eventBus])}
      onRendererDocumentDispatchChange={useCallback((dispatch: { save: () => void; undo: () => void; redo: () => void } | null) => {
        activeRendererDispatchRef.current = dispatch;
      }, [])}
      getRendererContent={useCallback((fileId: string) => {
        const session = fileEditor.sessions?.getSession(fileId);
        return session?.workingContent as Record<string, unknown> | undefined;
      }, [fileEditor.sessions])}
      toolbarExtra={(
        <PreviewToolbar
          previewT={previewT as (...args: any[]) => string}
          appMode={appMode}
          activeScenario={activeScenario}
          scenarioOptions={scenarioOptions}
          onActiveScenarioChange={setActiveScenario}
          fileInputRef={fileInputRef}
          onImportJSONFile={workspaceState.handleImportJSONFile}
          onExportJSON={handleExportJSON}
          isDirty={workspaceState.isDirty}
          canUndo={workspaceState.canUndo}
          canRedo={workspaceState.canRedo}
          shellGenerationLock={workspaceState.shellGenerationLock}
          onUndo={workspaceState.handleUndoGuarded}
          onRedo={workspaceState.handleRedoGuarded}
        />
      )}
    >
      <PreviewCanvasStage
        appMode={appMode}
        activeScenario={activeScenario}
        schema={activeSchema}
        shellGenerationLock={workspaceState.shellGenerationLock}
        shellGenerationReason={workspaceState.shellGenerationReason}
      />

      <ProjectManagerDialog
        open={showProjectManager}
        activeProjectId={projectState.activeProjectId ?? ''}
        gitlabUser={projectState.gitlabUser}
        gitlabService={services.gitlab}
        onClose={() => setShowProjectManager(false)}
        onSelectProject={projectState.handleSelectProject}
        onDeleteProject={projectState.handleDeleteProject}
      />
    </AppShell>

    {DialogPortal}
    {(projectState.isFirstLaunch || showWelcomeOverride) && (
      <WelcomeScreen
        gitlabUser={projectState.gitlabUser}
        gitlabService={services.gitlab}
        onSelectProject={(config) => {
          projectState.handleSelectProject(config);
          setShowWelcomeOverride(false);
          setWelcomeInitialMode(undefined);
        }}
        initialMode={welcomeInitialMode}
        onClose={showWelcomeOverride ? () => { setShowWelcomeOverride(false); setWelcomeInitialMode(undefined); } : undefined}
      />
    )}
    </>
  );
}
