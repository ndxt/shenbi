import { useCallback, useEffect, useMemo, useState } from 'react';
import * as antd from 'antd';
import { Rocket, Undo2, Redo2, Trash2 } from 'lucide-react';
import {
  builtinContracts,
  getBuiltinContract,
  type PageSchema,
} from '@shenbi/schema';
import { defineEditorPlugin } from '@shenbi/editor-plugin-api';
import {
  type EditorStateSnapshot,
  type FSTreeNode,
  IndexedDBFileSystemAdapter,
  TabManager,
  buildEditorTree,
  buildFSTree,
  createEditor,
  getAncestorChain,
  getDefaultSelectedNodeId,
  getSchemaNodeByTreeId,
  getTreeIdBySchemaNodeId,
  patchSchemaNodeColumns,
  patchSchemaNodeEvents,
  patchSchemaNodeLogic,
  patchSchemaNodeProps,
  patchSchemaNodeStyle,
} from '@shenbi/editor-core';
import {
  descriptionsSkeletonSchema,
  drawerDetailSkeletonSchema,
  formListSkeletonSchema,
  nineGridSkeletonSchema,
  tabsDetailSkeletonSchema,
  treeManagementSkeletonSchema,
  userManagementSchema,
} from './schemas';
import { ScenarioRuntimeView } from './runtime/ScenarioRuntimeView';

import {
  AppShell,
  createWorkspacePersistenceService,
  LocalWorkspacePersistenceAdapter,
  useEditorHostBridge,
  useEditorSession,
  useNodePatchDispatch,
  usePluginContext,
  useScenarioSession,
  useShellModeUrl,
  useSelectionSync,
  useTabManager,
  type ShellMode,
} from '@shenbi/editor-ui';
import { createAIChatPlugin } from '@shenbi/editor-plugin-ai-chat';
import { createFilesPlugin, useFileWorkspace, FileExplorer } from '@shenbi/editor-plugin-files';
import { createSetterPlugin } from '@shenbi/editor-plugin-setter';

type ScenarioKey =
  | 'user-management'
  | 'form-list'
  | 'tabs-detail'
  | 'tree-management'
  | 'descriptions'
  | 'drawer-detail'
  | 'nine-grid';

type AppMode = ShellMode;
const WORKSPACE_ID = 'shenbi-preview-debug';
const PROJECT_ID = 'default';
const PREVIEW_PERSISTENCE_NAMESPACE = 'preview-debug';
const ACTIVE_SCENARIO_PERSISTENCE_KEY = 'active-scenario';

const scenarioOptions: { label: string; value: ScenarioKey }[] = [
  { label: '用户管理场景', value: 'user-management' },
  { label: 'Form.List', value: 'form-list' },
  { label: 'Tabs 详情', value: 'tabs-detail' },
  { label: 'Tree 管理', value: 'tree-management' },
  { label: 'Descriptions', value: 'descriptions' },
  { label: 'Drawer 详情', value: 'drawer-detail' },
  { label: '九宫格布局', value: 'nine-grid' },
];

const modeOptions: { label: string; value: AppMode }[] = [
  { label: '多场景', value: 'scenarios' },
  { label: 'Shell', value: 'shell' },
];

function cloneSchema(schema: PageSchema): PageSchema {
  if (typeof structuredClone === 'function') {
    return structuredClone(schema);
  }
  return JSON.parse(JSON.stringify(schema)) as PageSchema;
}

function createInitialScenarioState(): Record<ScenarioKey, PageSchema> {
  return {
    'user-management': cloneSchema(userManagementSchema),
    'form-list': cloneSchema(formListSkeletonSchema),
    'tabs-detail': cloneSchema(tabsDetailSkeletonSchema),
    'tree-management': cloneSchema(treeManagementSkeletonSchema),
    descriptions: cloneSchema(descriptionsSkeletonSchema),
    'drawer-detail': cloneSchema(drawerDetailSkeletonSchema),
    'nine-grid': cloneSchema(nineGridSkeletonSchema),
  };
}

function createScenarioSnapshot(schema: PageSchema): EditorStateSnapshot {
  return {
    schema,
    isDirty: false,
    canUndo: false,
    canRedo: false,
  };
}

function createInitialScenarioSnapshots(): Record<ScenarioKey, EditorStateSnapshot> {
  const schemas = createInitialScenarioState();
  return {
    'user-management': createScenarioSnapshot(schemas['user-management']),
    'form-list': createScenarioSnapshot(schemas['form-list']),
    'tabs-detail': createScenarioSnapshot(schemas['tabs-detail']),
    'tree-management': createScenarioSnapshot(schemas['tree-management']),
    descriptions: createScenarioSnapshot(schemas.descriptions),
    'drawer-detail': createScenarioSnapshot(schemas['drawer-detail']),
    'nine-grid': createScenarioSnapshot(schemas['nine-grid']),
  };
}

function createEmptyShellSchema(): PageSchema {
  return {
    id: 'shell-page',
    name: 'Shell Page',
    body: [],
  };
}

export function App() {
  const [appMode, setAppMode] = useShellModeUrl();
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>('user-management');
  const persistenceAdapter = useMemo(() => new LocalWorkspacePersistenceAdapter(), []);
  const workspacePersistence = useMemo(
    () => createWorkspacePersistenceService(WORKSPACE_ID, persistenceAdapter),
    [persistenceAdapter],
  );
  const [scenarioPersistenceHydrated, setScenarioPersistenceHydrated] = useState(false);
  const initialScenarioSnapshots = useMemo(() => createInitialScenarioSnapshots(), []);
  const initialScenarioSchemas = useMemo(() => createInitialScenarioState(), []);
  const [activityMessage, setActivityMessage] = useState<string>('');
  const initialShellSchema = useMemo(() => createEmptyShellSchema(), []);

  // VFS & TabManager instances
  const vfs = useMemo(() => new IndexedDBFileSystemAdapter(), []);
  const tabManager = useMemo(() => new TabManager(), []);
  const [vfsInitialized, setVfsInitialized] = useState(false);
  const [fsTree, setFsTree] = useState<FSTreeNode[]>([]);

  // Initialize VFS
  useEffect(() => {
    void vfs.initialize(PROJECT_ID).then(() => {
      setVfsInitialized(true);
    });
  }, [vfs]);

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
    executeShellNodeCommand,
    updateActiveSchema,
  } = useEditorSession({
    mode: appMode,
    initialShellSchema,
    updateScenarioSchema,
    onError: (message) => {
      antd.message.error(message);
    },
    createEditorInstance: appMode === 'shell' ? () => {
      return createEditor({
        initialSchema: createEmptyShellSchema(),
        vfs,
        tabManager,
        projectId: PROJECT_ID,
      });
    } : undefined,
  });

  // Tab manager snapshot
  const tabSnapshot = useTabManager(appMode === 'shell' ? tabManager : undefined);

  // Refresh file tree
  const refreshFsTree = useCallback(() => {
    if (!vfsInitialized) return;
    void vfs.listTree(PROJECT_ID).then((nodes) => {
      setFsTree(buildFSTree(nodes));
    });
  }, [vfs, vfsInitialized]);

  useEffect(() => {
    if (vfsInitialized && appMode === 'shell') {
      refreshFsTree();
    }
  }, [appMode, refreshFsTree, vfsInitialized]);

  // Listen for fs tree changes
  useEffect(() => {
    if (appMode !== 'shell') return;
    const unsub = fileEditor.eventBus?.on?.('fs:treeChanged', () => {
      refreshFsTree();
    });
    return unsub;
  }, [appMode, fileEditor.eventBus, refreshFsTree]);

  const activeSchema = appMode === 'shell' ? shellSnapshot.schema : activeScenarioSnapshot.schema;
  const {
    activeFileName,
    filesSidebarTabOptions,
    isDirty,
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
  } = useFileWorkspace({
    mode: appMode === 'shell' ? 'shell' : 'scenarios',
    snapshot: {
      currentFileId: appMode === 'shell' ? shellSnapshot.currentFileId : activeScenarioSnapshot.currentFileId,
      schemaName: activeSchema.name,
      isDirty: appMode === 'shell' ? shellSnapshot.isDirty : activeScenarioSnapshot.isDirty,
      canUndo: appMode === 'shell' ? shellSnapshot.canUndo : activeScenarioSnapshot.canUndo,
      canRedo: appMode === 'shell' ? shellSnapshot.canRedo : activeScenarioSnapshot.canRedo,
    },
    commands: fileEditor.commands,
    onError: (message) => {
      antd.message.error(message);
    },
    promptFileName: (defaultName) => {
      if (typeof window === 'undefined') {
        return null;
      }
      return window.prompt('请输入文件名', defaultName);
    },
  });

  const treeNodes = useMemo(() => buildEditorTree(activeSchema), [activeSchema]);
  const { selectedNodeId, selectTreeNode, selectSchemaNode } = useSelectionSync({
    mode: appMode === 'shell' ? 'shell' : 'scenarios',
    schema: activeSchema,
    treeNodes,
    shellSelectedNodeId: shellSnapshot.selectedNodeId,
    scenarioSelectedNodeId: activeScenarioSnapshot.selectedNodeId,
    setShellSelectedNodeId,
    setScenarioSelectedNodeId,
    getNodeByTreeId: getSchemaNodeByTreeId,
    getDefaultSelectedNodeId,
    getTreeIdBySchemaNodeId,
  });

  const selectedNode = useMemo(
    () => getSchemaNodeByTreeId(activeSchema, selectedNodeId),
    [activeSchema, selectedNodeId],
  );

  const selectedContract = useMemo(
    () => (selectedNode ? getBuiltinContract(selectedNode.component) : undefined),
    [selectedNode],
  );
  const breadcrumbItems = useMemo(
    () => getAncestorChain(treeNodes, selectedNodeId),
    [treeNodes, selectedNodeId],
  );
  const {
    handlePatchProps,
    handlePatchEvents,
    handlePatchColumns,
    handlePatchStyle,
    handlePatchLogic,
  } = useNodePatchDispatch({
    mode: appMode === 'shell' ? 'shell' : 'scenarios',
    selectedNodeId,
    executeShellCommand: executeShellNodeCommand,
    updateScenarioSchema,
    patchSchemaNodeProps,
    patchSchemaNodeEvents,
    patchSchemaNodeStyle,
    patchSchemaNodeLogic,
    patchSchemaNodeColumns,
  });
  const patchSelectedNode = useMemo(() => ({
    props: handlePatchProps,
    columns: handlePatchColumns,
    style: handlePatchStyle,
    events: handlePatchEvents,
    logic: handlePatchLogic,
  }), [
    handlePatchColumns,
    handlePatchEvents,
    handlePatchLogic,
    handlePatchProps,
    handlePatchStyle,
  ]);
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
    return window.prompt('请输入文件名', defaultName);
  }, []);
  const { executePluginCommand: executeHostPluginCommand } = useEditorHostBridge({
    mode: appMode === 'shell' ? 'shell' : 'scenarios',
    shellCommands: fileEditor.commands,
    scenarioCommands: executeScenarioCommand,
    activeFileId: appMode === 'shell'
      ? shellSnapshot.currentFileId
      : activeScenarioSnapshot.currentFileId,
    schemaName: activeSchema.name,
    promptFileName,
  });
  const handleResetWorkspace = useCallback(() => {
    if (appMode === 'shell') {
      updateActiveSchema(() => createEmptyShellSchema());
      setShellSelectedNodeId(undefined);
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
    initialScenarioSchemas,
    setScenarioSelectedNodeId,
    setShellSelectedNodeId,
    updateActiveSchema,
    updateScenarioSnapshot,
  ]);
  const executeAppCommand = useCallback((commandId: string, payload?: unknown) => {
    if (commandId === 'workspace.resetDocument') {
      handleResetWorkspace();
      return undefined;
    }
    return executeHostPluginCommand(commandId, payload);
  }, [executeHostPluginCommand, handleResetWorkspace]);

  // File system service for plugin context
  const filesystemService = useMemo(() => {
    if (!vfsInitialized) return undefined;
    return {
      createFile: async (name: string, fileType: string, content: Record<string, unknown>, parentId?: string) => {
        const node = await vfs.createFile(PROJECT_ID, parentId ?? null, name, fileType as any, content);
        refreshFsTree();
        return node.id;
      },
      readFile: async (fileId: string) => {
        return await vfs.readFile(PROJECT_ID, fileId) as Record<string, unknown>;
      },
      writeFile: async (fileId: string, content: Record<string, unknown>) => {
        await vfs.writeFile(PROJECT_ID, fileId, content);
      },
    };
  }, [refreshFsTree, vfs, vfsInitialized]);

  const pluginContext = usePluginContext({
    schema: activeSchema,
    selectedNode,
    selectedNodeId,
    replaceSchema: (schema) => updateActiveSchema(() => schema),
    patchSelectedNode,
    executeCommand: executeAppCommand,
    notifications,
  });

  // Enhance plugin context with filesystem
  const enhancedPluginContext = useMemo(() => ({
    ...pluginContext,
    ...(filesystemService ? { filesystem: filesystemService } : {}),
  }), [filesystemService, pluginContext]);

  // Tab actions
  const handleActivateTab = useCallback((fileId: string) => {
    void fileEditor.commands.execute('tab.activate', { fileId });
  }, [fileEditor.commands]);

  const handleCloseTab = useCallback((fileId: string) => {
    const tab = tabManager.getTab(fileId);
    if (tab?.isDirty) {
      if (!window.confirm('文件未保存，确定关闭？')) {
        return;
      }
    }
    void fileEditor.commands.execute('tab.close', { fileId });
  }, [fileEditor.commands, tabManager]);

  const handleOpenFileFromTree = useCallback((fileId: string) => {
    void fileEditor.commands.execute('tab.open', { fileId });
  }, [fileEditor.commands]);

  const handleCreateFile = useCallback((parentId: string | null, name: string, fileType: string) => {
    void fileEditor.commands.execute('fs.createFile', { parentId, name, fileType }).then((result: any) => {
      if (result?.id) {
        void fileEditor.commands.execute('tab.open', { fileId: result.id });
      }
    });
  }, [fileEditor.commands]);

  const handleCreateDirectory = useCallback((parentId: string | null, name: string) => {
    void fileEditor.commands.execute('fs.createDirectory', { parentId, name });
  }, [fileEditor.commands]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    void fileEditor.commands.execute('fs.deleteNode', { nodeId });
  }, [fileEditor.commands]);

  const handleRenameNode = useCallback((nodeId: string, newName: string) => {
    void fileEditor.commands.execute('fs.rename', { nodeId, newName });
  }, [fileEditor.commands]);

  const plugins = useMemo(() => {
    const registeredPlugins = [
      defineEditorPlugin({
        id: 'preview.workspace',
        name: 'Preview Workspace Commands',
        contributes: {
          commands: [
            {
              id: 'workspace.resetDocument',
              title: 'Reset Document',
              category: 'Workspace',
              description: 'Reset the current shell page or restore the active scenario baseline.',
              execute: () => {
                handleResetWorkspace();
              },
            },
          ],
        },
      }),
      createSetterPlugin({
        inspectorTabs: [
          {
            id: 'debug',
            label: 'Debug',
            order: 99,
            render: (context) => (
              <div className="p-3 text-xs text-text-secondary">
                Plugin Tab Loaded
                {context.selectedNode?.id ? (
                  <div className="mt-2 text-[11px]">Selected: {context.selectedNode.id}</div>
                ) : null}
              </div>
            ),
          },
        ],
      }),
      defineEditorPlugin({
        id: 'preview.assets',
        name: 'Preview Assets Plugin',
        contributes: {
          activityBarItems: [
            {
              id: 'rocket',
              label: 'Rocket',
              icon: Rocket,
              order: 99,
              section: 'main',
              targetSidebarTabId: 'assets',
              onClick: () => setActivityMessage('Activity Plugin Triggered'),
            },
          ],
          sidebarTabs: [
            {
              id: 'assets',
              label: 'Assets',
              order: 99,
              render: () => (
                <div className="p-3 text-xs text-text-secondary">
                  Sidebar Plugin Loaded
                </div>
              ),
            },
          ],
        },
      }),
      createAIChatPlugin({
        defaultWidth: 300,
        getAvailableComponents: () => builtinContracts,
      }),
    ];

    // VFS-based file explorer in shell mode
    if (appMode === 'shell' && vfsInitialized) {
      registeredPlugins.push(defineEditorPlugin({
        id: 'shenbi.plugin.files',
        name: 'Files Plugin',
        contributes: {
          sidebarTabs: [
            {
              id: 'files',
              label: 'Files',
              order: 35,
              render: () => (
                <FileExplorer
                  tree={fsTree}
                  activeFileId={tabSnapshot.activeTabId}
                  onOpenFile={handleOpenFileFromTree}
                  onCreateFile={handleCreateFile}
                  onCreateDirectory={handleCreateDirectory}
                  onDeleteNode={handleDeleteNode}
                  onRenameNode={handleRenameNode}
                  onRefresh={refreshFsTree}
                />
              ),
            },
          ],
        },
      }));
    } else if (appMode === 'shell' && filesSidebarTabOptions) {
      // Fallback to legacy file panel if VFS not ready
      registeredPlugins.push(createFilesPlugin(filesSidebarTabOptions));
    }
    return registeredPlugins;
  }, [
    appMode,
    filesSidebarTabOptions,
    fsTree,
    handleCreateDirectory,
    handleCreateFile,
    handleDeleteNode,
    handleOpenFileFromTree,
    handleRenameNode,
    handleResetWorkspace,
    refreshFsTree,
    tabSnapshot.activeTabId,
    vfsInitialized,
  ]);

  const handleCanvasSelectNode = (schemaNodeId: string) => {
    selectSchemaNode(schemaNodeId);
  };

  useEffect(() => {
    let cancelled = false;

    void workspacePersistence
      .getJSON<ScenarioKey>(PREVIEW_PERSISTENCE_NAMESPACE, ACTIVE_SCENARIO_PERSISTENCE_KEY)
      .then((storedScenario) => {
        if (
          cancelled
          || !storedScenario
          || !scenarioOptions.some((option) => option.value === storedScenario)
        ) {
          return;
        }
        setActiveScenario(storedScenario);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setScenarioPersistenceHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workspacePersistence]);

  useEffect(() => {
    if (!scenarioPersistenceHydrated) {
      return;
    }

    void workspacePersistence
      .setJSON(
        PREVIEW_PERSISTENCE_NAMESPACE,
        ACTIVE_SCENARIO_PERSISTENCE_KEY,
        activeScenario,
      )
      .catch(() => undefined);
  }, [activeScenario, scenarioPersistenceHydrated, workspacePersistence]);

  return (
    <AppShell
      workspaceId={WORKSPACE_ID}
      persistenceAdapter={persistenceAdapter}
      sidebarProps={{
        contracts: builtinContracts,
        treeNodes,
        onSelectNode: selectTreeNode,
        ...(selectedNodeId ? { selectedNodeId } : {}),
      }}
      inspectorProps={{
        ...(selectedNode ? { selectedNode } : {}),
        ...(selectedContract ? { contract: selectedContract } : {}),
      }}
      plugins={plugins}
      pluginContext={enhancedPluginContext}
      onCanvasSelectNode={handleCanvasSelectNode}
      schemaName={activeSchema.name}
      breadcrumbItems={breadcrumbItems}
      tabs={appMode === 'shell' && tabSnapshot.tabs.length > 0 ? tabSnapshot.tabs : undefined}
      activeTabId={tabSnapshot.activeTabId}
      onActivateTab={handleActivateTab}
      onCloseTab={handleCloseTab}
      toolbarExtra={(
        <div className="flex items-center gap-2">
          <span className="text-text-secondary" style={{ fontSize: '11px' }}>模式</span>
          <select
            className="h-7 w-[110px] rounded border border-border-ide bg-bg-panel px-2 text-text-primary outline-none transition-colors hover:bg-bg-activity-bar focus:border-blue-500"
            style={{ fontSize: '12px' }}
            aria-label="模式切换"
            value={appMode}
            onChange={(event) => setAppMode(event.target.value as AppMode)}
          >
            {modeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {appMode === 'scenarios' ? (
            <>
              <span className="text-text-secondary" style={{ fontSize: '11px' }}>场景</span>
              <select
                className="h-7 w-[180px] rounded border border-border-ide bg-bg-panel px-2 text-text-primary outline-none transition-colors hover:bg-bg-activity-bar focus:border-blue-500"
                style={{ fontSize: '12px' }}
                aria-label="场景切换"
                value={activeScenario}
                onChange={(event) => setActiveScenario(event.target.value as ScenarioKey)}
              >
                {scenarioOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          {appMode === 'shell' ? (
            <>
              <span
                aria-label="当前文件"
                className="max-w-[220px] truncate text-text-secondary"
                style={{ fontSize: '11px' }}
              >
                {activeFileName ?? (tabSnapshot.activeTabId ? tabSnapshot.tabs.find((t) => t.fileId === tabSnapshot.activeTabId)?.fileName : '未命名页面')}
                {isDirty ? ' *' : ''}
              </span>
              <button
                type="button"
                aria-label="撤销"
                className="p-1.5 rounded text-text-secondary transition-colors hover:bg-bg-activity-bar hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canUndo}
                onClick={handleUndo}
                title="撤销 (Ctrl+Z)"
              >
                <Undo2 size={15} />
              </button>
              <button
                type="button"
                aria-label="重做"
                className="p-1.5 rounded text-text-secondary transition-colors hover:bg-bg-activity-bar hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canRedo}
                onClick={handleRedo}
                title="重做 (Ctrl+Shift+Z)"
              >
                <Redo2 size={15} />
              </button>
            </>
          ) : null}
          <button
            type="button"
            aria-label="清空页面"
            className="p-1.5 rounded text-text-secondary transition-colors hover:bg-bg-activity-bar hover:text-text-primary"
            onClick={() => {
              void executeAppCommand('workspace.resetDocument');
            }}
            title="清空页面"
          >
            <Trash2 size={15} />
          </button>
          {activityMessage ? (
            <span className="ml-2 text-text-secondary" style={{ fontSize: '11px' }}>{activityMessage}</span>
          ) : null}
        </div>
      )}
    >
      <ScenarioRuntimeView key={`${appMode}:${activeScenario}`} schema={activeSchema} />
    </AppShell>
  );
}
