import { useCallback, useMemo, useRef, useState } from 'react';
import * as antd from 'antd';
import { builtinContracts } from '@shenbi/schema';
import {
  IndexedDBFileSystemAdapter,
  TabManager,
  createEditor,
} from '@shenbi/editor-core';
import {
  AppShell,
  createWorkspacePersistenceService,
  LocalWorkspacePersistenceAdapter,
  isCommandBlockedDuringGeneration,
  useHostCommandPolicy,
  useEditorHostBridge,
  useEditorSession,
  usePluginContext,
  useScenarioSession,
  useShellModeUrl,
} from '@shenbi/editor-ui';
import { useCurrentLocale, useTranslation } from '@shenbi/i18n';
import { PREVIEW_WORKSPACE_ID } from './constants';
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
import {
  type AppMode,
  DEFAULT_RENDER_MODE,
  type RenderMode,
  type ScenarioKey,
} from './preview-types';
import { createPreviewServiceContainer } from './services';

export { canSchemaNodeAcceptCanvasChildren, resolveCanvasDropPosition };

export function App() {
  const { t: previewT } = useTranslation('preview');
  const { t: filesT } = useTranslation('pluginFiles');
  const currentLocale = useCurrentLocale();
  const [appMode, setAppMode] = useShellModeUrl();
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>('user-management');
  const [renderMode, setRenderMode] = useState<RenderMode>(DEFAULT_RENDER_MODE);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      projectId: projectState.activeProjectId,
    }),
  });

  const workspaceState = usePreviewWorkspaceState({
    appMode,
    activeProjectId: projectState.activeProjectId,
    activeScenarioSnapshot,
    consumePendingMigration: projectState.consumePendingMigration,
    fileEditor,
    previewT: previewT as (...args: any[]) => string,
    filesT: filesT as (...args: any[]) => string,
    shellSnapshot,
    tabManager,
    vfs,
  });

  usePreviewPersistence({
    appMode,
    activeProjectId: projectState.activeProjectId,
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
  });

  const activeSchema = appMode === 'shell' ? shellSnapshot.schema : activeScenarioSnapshot.schema;
  const shellSchemaName = appMode === 'shell' && workspaceState.tabSnapshot.tabs.length === 0
    ? undefined
    : activeSchema.name;

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
  const promptFileName = useCallback((defaultName: string) => {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.prompt(previewT('prompt.enterFileName'), defaultName);
  }, [previewT]);
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
    <AppShell
      workspaceId={PREVIEW_WORKSPACE_ID}
      persistenceAdapter={persistenceAdapter}
      renderMode={renderMode}
      canvasReadOnly={workspaceState.shellGenerationLock}
      title={projectState.activeProjectConfig.projectName}
      subtitle={projectState.activeProjectConfig.branch}
      userAvatarUrl={projectState.gitlabUser?.avatarUrl}
      userName={projectState.gitlabUser?.username}
      branches={projectState.gitlabBranches.length > 0 ? projectState.gitlabBranches : undefined}
      onBranchChange={projectState.handleBranchChange}
      onLogout={projectState.gitlabUser ? projectState.handleLogout : undefined}
      gitlabUrl={projectState.activeProjectConfig.gitlabUrl}
      onOpenProjectManager={() => setShowProjectManager(true)}
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
        tabManager.markDirty(fileId, dirty);
      }, [tabManager])}
      toolbarExtra={(
        <PreviewToolbar
          previewT={previewT as (...args: any[]) => string}
          appMode={appMode}
          modeOptions={modeOptions}
          onAppModeChange={(mode) => setAppMode(mode)}
          renderMode={renderMode}
          onRenderModeChange={setRenderMode}
          activeScenario={activeScenario}
          scenarioOptions={scenarioOptions}
          onActiveScenarioChange={setActiveScenario}
          fileInputRef={fileInputRef}
          onImportJSONFile={workspaceState.handleImportJSONFile}
          activeFileName={workspaceState.activeFileName}
          activeTabId={workspaceState.tabSnapshot.activeTabId}
          activeTabFileName={
            workspaceState.tabSnapshot.tabs.find(
              (tab) => tab.fileId === workspaceState.tabSnapshot.activeTabId,
            )?.fileName
          }
          isDirty={workspaceState.isDirty}
          canUndo={workspaceState.canUndo}
          canRedo={workspaceState.canRedo}
          shellGenerationLock={workspaceState.shellGenerationLock}
          onUndo={workspaceState.handleUndoGuarded}
          onRedo={workspaceState.handleRedoGuarded}
          onClearPage={() => {
            void executeAppCommand('workspace.resetDocument');
          }}
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
        activeProjectId={projectState.activeProjectId}
        gitlabUser={projectState.gitlabUser}
        gitlabService={services.gitlab}
        onClose={() => setShowProjectManager(false)}
        onSelectProject={projectState.handleSelectProject}
        onDeleteProject={projectState.handleDeleteProject}
      />
    </AppShell>
  );
}
