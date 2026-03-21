import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as antd from 'antd';
import { Undo2, Redo2, Trash2, FileUp } from 'lucide-react';
import {
  builtinContracts,
  createSchemaNodeFromContract,
  getBuiltinContract,
  type PageSchema,
  type SchemaNode,
} from '@shenbi/schema';
import { defineEditorPlugin } from '@shenbi/editor-plugin-api';
import {
  type EditorStateSnapshot,
  type FSTreeNode,
  IndexedDBFileSystemAdapter,
  TabManager,
  type TabManagerSnapshot,
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
  removeSchemaNode,
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
import {
  PREVIEW_PROJECT_ID,
  PREVIEW_WORKSPACE_ID,
  clearLastGitLabProject,
  createLocalProjectConfig,
  loadLastGitLabProject,
  loadActiveProject,
  saveActiveProject,
  saveLastGitLabProject,
  clearActiveProject,
} from './constants';
import type { ActiveProjectConfig } from './constants';
import { upsertProjectInList, loadProjectList } from './constants';
import { ProjectManagerDialog } from './ProjectManagerDialog';
import { ScenarioRuntimeView } from './runtime/ScenarioRuntimeView';

import {
  AppShell,
  type CanvasDropTarget,
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
import { createGitLabSyncPlugin } from '@shenbi/editor-plugin-gitlab-sync';
import type { GitLabProject } from '@shenbi/editor-plugin-gitlab-sync';
import { useCurrentLocale, useTranslation } from '@shenbi/i18n';

type ScenarioKey =
  | 'user-management'
  | 'form-list'
  | 'tabs-detail'
  | 'tree-management'
  | 'descriptions'
  | 'drawer-detail'
  | 'nine-grid';

type AppMode = ShellMode;
const PREVIEW_PERSISTENCE_NAMESPACE = 'preview-debug';
const ACTIVE_SCENARIO_PERSISTENCE_KEY = 'active-scenario';
const SHELL_SESSION_PERSISTENCE_KEY = 'shell-session';
const RENDER_MODE_PERSISTENCE_KEY = 'canvas-render-mode';

type RenderMode = 'direct' | 'iframe';
const DEFAULT_RENDER_MODE: RenderMode = process.env.NODE_ENV === 'test' ? 'direct' : 'iframe';

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
    body: [],
  };
}

function getTreeArrayPosition(treeId: string | undefined): {
  targetParentTreeId?: string;
  index: number;
} | undefined {
  if (!treeId) {
    return undefined;
  }
  if (treeId === 'body') {
    return {
      index: 0,
    };
  }

  const tokens = treeId.split('.').filter(Boolean);
  const lastToken = tokens[tokens.length - 1];
  const index = Number(lastToken);
  if (!Number.isInteger(index)) {
    return undefined;
  }

  const parentTokens = tokens.slice(0, -1);
  if (parentTokens.length === 1 && parentTokens[0] === 'body') {
    return { index };
  }
  if (parentTokens.length === 1 && parentTokens[0] === 'dialogs') {
    return { targetParentTreeId: 'dialogs', index };
  }
  if (parentTokens[parentTokens.length - 1] === 'children') {
    const targetParentTreeId = parentTokens.slice(0, -1).join('.');
    return {
      ...(targetParentTreeId ? { targetParentTreeId } : {}),
      index,
    };
  }

  return undefined;
}

function hasSchemaContent(schema: PageSchema): boolean {
  const bodyCount = Array.isArray(schema.body) ? schema.body.length : (schema.body ? 1 : 0);
  const dialogCount = Array.isArray(schema.dialogs) ? schema.dialogs.length : (schema.dialogs ? 1 : 0);
  return bodyCount + dialogCount > 0;
}

function canDropInsideComponent(componentType: string | undefined): boolean {
  if (!componentType) {
    return false;
  }
  const contract = getBuiltinContract(componentType);
  return Boolean(contract?.children && ['node', 'nodes', 'mixed'].includes(contract.children.type));
}

export function canSchemaNodeAcceptCanvasChildren(
  schema: PageSchema,
  schemaNodeId: string | undefined,
): boolean {
  if (!schemaNodeId) {
    return false;
  }
  const targetTreeId = getTreeIdBySchemaNodeId(schema, schemaNodeId);
  if (!targetTreeId) {
    return false;
  }
  const targetNode = getSchemaNodeByTreeId(schema, targetTreeId);
  if (!targetNode) {
    return false;
  }
  return canDropInsideComponent(targetNode.component);
}

function createClonedNodeId(componentType: string): string {
  const normalized = componentType
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'node';
  const randomSuffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${normalized}-${randomSuffix}`;
}

function cloneSchemaNodeWithFreshIds(node: SchemaNode): SchemaNode {
  const cloned = typeof structuredClone === 'function'
    ? structuredClone(node)
    : JSON.parse(JSON.stringify(node)) as SchemaNode;

  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map((item) => walk(item));
    }
    if (!value || typeof value !== 'object') {
      return value;
    }
    const record = value as Record<string, unknown>;
    const nextRecord = Object.fromEntries(
      Object.entries(record).map(([key, nested]) => [key, walk(nested)]),
    );
    if (typeof nextRecord.component === 'string') {
      nextRecord.id = createClonedNodeId(nextRecord.component);
    }
    return nextRecord;
  };

  return walk(cloned) as SchemaNode;
}

function getContainerNodeCount(schema: PageSchema, parentTreeId?: string): number {
  if (!parentTreeId) {
    return Array.isArray(schema.body) ? schema.body.length : (schema.body ? 1 : 0);
  }
  if (parentTreeId === 'dialogs') {
    return Array.isArray(schema.dialogs) ? schema.dialogs.length : (schema.dialogs ? 1 : 0);
  }
  const parentNode = getSchemaNodeByTreeId(schema, parentTreeId);
  return Array.isArray(parentNode?.children) ? parentNode.children.length : 0;
}

export function resolveCanvasDropPosition(
  schema: PageSchema,
  target: CanvasDropTarget,
): {
  parentTreeId?: string;
  index: number;
} | undefined {
  if (target.placement === 'root' || !target.targetNodeSchemaId) {
    const bodyLength = Array.isArray(schema.body) ? schema.body.length : (schema.body ? 1 : 0);
    return { index: bodyLength };
  }

  const targetTreeId = getTreeIdBySchemaNodeId(schema, target.targetNodeSchemaId);
  if (!targetTreeId) {
    return undefined;
  }

  const targetNode = getSchemaNodeByTreeId(schema, targetTreeId);
  if (!targetNode) {
    return undefined;
  }

  if (target.placement === 'inside') {
    if (!canDropInsideComponent(targetNode.component)) {
      return undefined;
    }
    const childCount = Array.isArray(targetNode.children) ? targetNode.children.length : 0;
    return {
      parentTreeId: targetTreeId,
      index: childCount,
    };
  }

  const targetPosition = getTreeArrayPosition(targetTreeId);
  if (!targetPosition) {
    return undefined;
  }

  return {
    ...(targetPosition.targetParentTreeId ? { parentTreeId: targetPosition.targetParentTreeId } : {}),
    index: target.placement === 'before' ? targetPosition.index : targetPosition.index + 1,
  };
}

interface PersistedShellSession {
  tabs: TabManagerSnapshot;
  expandedIds: string[];
  focusedId?: string | undefined;
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function isBlockedDuringGeneration(commandId: string): boolean {
  if (
    commandId === 'workspace.resetDocument'
    || commandId === 'schema.replace'
    || commandId === 'schema.restore'
    || commandId === 'file.openSchema'
    || commandId === 'file.saveSchema'
    || commandId === 'file.saveAs'
    || commandId === 'file.deleteSchema'
    || commandId === 'editor.undo'
    || commandId === 'editor.redo'
  ) {
    return true;
  }
  return commandId.startsWith('node.') || commandId.startsWith('history.');
}

export function App() {
  const { t: previewT } = useTranslation('preview');
  const { t: filesT } = useTranslation('pluginFiles');
  const currentLocale = useCurrentLocale();
  const [appMode, setAppMode] = useShellModeUrl();
  const [renderMode, setRenderMode] = useState<RenderMode>(DEFAULT_RENDER_MODE);
  const [activeProjectConfig, setActiveProjectConfig] = useState<ActiveProjectConfig>(() => loadActiveProject() ?? createLocalProjectConfig());
  const [lastGitLabProjectConfig, setLastGitLabProjectConfig] = useState<ActiveProjectConfig | null>(() => loadLastGitLabProject());
  const activeProjectId = activeProjectConfig.vfsProjectId;
  const [gitlabUser, setGitlabUser] = useState<{ username: string; avatarUrl: string } | null>(null);
  const [gitlabBranches, setGitlabBranches] = useState<string[]>([]);
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>('user-management');
  const persistenceAdapter = useMemo(() => new LocalWorkspacePersistenceAdapter(), []);
  const workspacePersistence = useMemo(
    () => createWorkspacePersistenceService(PREVIEW_WORKSPACE_ID, persistenceAdapter),
    [persistenceAdapter],
  );
  const [scenarioPersistenceHydrated, setScenarioPersistenceHydrated] = useState(false);
  const [renderModeHydrated, setRenderModeHydrated] = useState(false);
  const [shellSessionHydrated, setShellSessionHydrated] = useState(false);
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

  // VFS & TabManager instances
  const vfs = useMemo(() => new IndexedDBFileSystemAdapter(), []);
  const tabManager = useMemo(() => new TabManager(), []);
  const [vfsInitialized, setVfsInitialized] = useState(false);
  const [fsTree, setFsTree] = useState<FSTreeNode[]>([]);
  const [fileExplorerExpandedIds, setFileExplorerExpandedIds] = useState<string[]>([]);
  const [fileExplorerFocusedId, setFileExplorerFocusedId] = useState<string | undefined>();
  const [shellSaveSources, setShellSaveSources] = useState<Record<string, 'manual' | 'auto'>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingMigrationRef = useRef<{ sourceProjectId: string; targetProjectId: string } | null>(null);
  const [showProjectManager, setShowProjectManager] = useState(false);

  // Initialize VFS (and migrate files from old project if needed)
  useEffect(() => {
    if (typeof indexedDB === 'undefined') {
      setShellSessionHydrated(true);
      return;
    }
    void vfs.initialize(activeProjectId)
      .then(async () => {
        // Check for pending file migration (e.g. switching from 'default' to 'gitlab-123')
        const migration = pendingMigrationRef.current;
        if (migration && migration.targetProjectId === activeProjectId) {
          pendingMigrationRef.current = null;
          try {
            const targetHasFiles = await vfs.hasFiles(migration.targetProjectId);
            if (!targetHasFiles) {
              const sourceHasFiles = await vfs.hasFiles(migration.sourceProjectId);
              if (sourceHasFiles) {
                await vfs.copyProject(migration.sourceProjectId, migration.targetProjectId);
              }
            }
          } catch {
            // Migration failed — not critical, continue
          }
        }
        setVfsInitialized(true);
      })
      .catch(() => {
        setShellSessionHydrated(true);
      });
  }, [vfs, activeProjectId]);

  // Fetch GitLab user info for header display
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/gitlab/oauth/status`, { credentials: 'include' })
      .then((res) => res.ok ? res.json() : null)
      .then((data: { authenticated?: boolean; user?: { username: string; avatarUrl: string } } | null) => {
        if (data?.authenticated && data.user) {
          setGitlabUser({ username: data.user.username, avatarUrl: data.user.avatarUrl });
        }
      })
      .catch(() => { /* not logged in */ });
  }, []);

  // Fetch branches when project is active
  useEffect(() => {
    if (!activeProjectConfig?.gitlabProjectId) return;
    fetch(`${import.meta.env.BASE_URL}api/gitlab/projects/${activeProjectConfig.gitlabProjectId}/branches`, { credentials: 'include' })
      .then((res) => res.ok ? res.json() : [])
      .then((data: Array<{ name: string }>) => {
        setGitlabBranches(data.map((b) => b.name));
      })
      .catch(() => setGitlabBranches([]));
  }, [activeProjectConfig?.gitlabProjectId]);

  // Handle branch change from header
  const handleBranchChange = useCallback((branch: string) => {
    const updated = { ...activeProjectConfig, branch };
    saveActiveProject(updated);
    setActiveProjectConfig(updated);
  }, [activeProjectConfig]);

  // Handle logout — only clear GitLab session, keep project & files
  const handleLogout = useCallback(() => {
    fetch(`${import.meta.env.BASE_URL}api/gitlab/oauth/logout`, { method: 'POST', credentials: 'include' })
      .then(() => {
        setGitlabUser(null);
        setGitlabBranches([]);
      })
      .catch(() => { /* ignore */ });
  }, []);

  const handleSelectProject = useCallback((config: ActiveProjectConfig) => {
    saveActiveProject(config);
    upsertProjectInList(config);
    setActiveProjectConfig(config);
    if (config.gitlabProjectId) {
      saveLastGitLabProject(config);
      setLastGitLabProjectConfig(config);
    }
    // Reset editor state for new project
    setVfsInitialized(false);
    setFsTree([]);
  }, []);

  const handleSelectGitLabProject = useCallback((project: GitLabProject) => {
    const oldProjectId = activeProjectId;
    const newProjectId = `gitlab-${project.id}`;
    // Schedule migration if switching from a different project
    if (oldProjectId !== newProjectId) {
      pendingMigrationRef.current = { sourceProjectId: oldProjectId, targetProjectId: newProjectId };
    }
    handleSelectProject({
      gitlabProjectId: project.id,
      vfsProjectId: newProjectId,
      projectName: project.name,
      branch: project.default_branch || 'main',
      lastOpenedAt: Date.now(),
      gitlabUrl: project.web_url,
    });
  }, [handleSelectProject, activeProjectId]);

  const handleDeleteProject = useCallback((projectId: string) => {
    // Delete the VFS database for the project
    try { indexedDB.deleteDatabase(`shenbi-vfs-${projectId}`); } catch { /* ignore */ }
  }, []);

  // Unbind GitLab remote from current project (keep VFS, just remove GitLab binding)
  const handleUnbindProject = useCallback(() => {
    const updated = {
      ...activeProjectConfig,
      gitlabProjectId: undefined,
      gitlabUrl: undefined,
      branch: undefined,
    };
    saveActiveProject(updated);
    setActiveProjectConfig(updated);
    upsertProjectInList(updated);
    setGitlabBranches([]);
  }, [activeProjectConfig]);

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
    createEditorInstance: () => {
      return createEditor({
        initialSchema: createEmptyShellSchema(),
        vfs,
        tabManager,
        projectId: activeProjectId,
      });
    },
  });

  // Tab manager snapshot
  const tabSnapshot = useTabManager(tabManager);

  // Compute dirty file IDs for FileExplorer
  const dirtyFileIds = useMemo(
    () => new Set(tabSnapshot.tabs.filter(t => t.isDirty).map(t => t.fileId)),
    [tabSnapshot.tabs],
  );

  // Refresh file tree
  const refreshFsTree = useCallback(() => {
    if (!vfsInitialized) return;
    void vfs.listTree(activeProjectId).then((nodes) => {
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

  useEffect(() => {
    const unsub = fileEditor.eventBus?.on?.('file:saved', ({
      fileId,
      source,
    }: {
      fileId: string;
      source?: 'manual' | 'auto';
    }) => {
      const nextSource = source ?? 'manual';
      setShellSaveSources((previous) => (
        previous[fileId] === nextSource
          ? previous
          : { ...previous, [fileId]: nextSource }
      ));
    });
    return unsub;
  }, [fileEditor.eventBus]);

  const activeSchema = appMode === 'shell' ? shellSnapshot.schema : activeScenarioSnapshot.schema;
  const shellSchemaName = appMode === 'shell' && tabSnapshot.tabs.length === 0
    ? undefined
    : activeSchema.name;
  const {
    activeFileName,
    filesPrimaryPanelOptions,
    isDirty,
    canUndo,
    canRedo,
    handleSave,
    handleUndo,
    handleRedo,
  } = useFileWorkspace({
    mode: appMode === 'shell' ? 'shell' : 'scenarios',
    snapshot: {
      currentFileId: appMode === 'shell' ? shellSnapshot.currentFileId : activeScenarioSnapshot.currentFileId,
      activeFileType: appMode === 'shell'
        ? tabSnapshot.tabs.find((tab) => tab.fileId === tabSnapshot.activeTabId)?.fileType
        : undefined,
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
      return window.prompt(previewT('prompt.enterFileName'), defaultName);
    },
  });

  const activeShellSaveSource = useMemo(
    () => (tabSnapshot.activeTabId ? shellSaveSources[tabSnapshot.activeTabId] : undefined),
    [shellSaveSources, tabSnapshot.activeTabId],
  );
  const activeShellTab = useMemo(
    () => tabSnapshot.tabs.find((tab) => tab.fileId === tabSnapshot.activeTabId),
    [tabSnapshot.activeTabId, tabSnapshot.tabs],
  );
  const shellGenerationLock = appMode === 'shell' && Boolean(activeShellTab?.isGenerating);
  const shellGenerationReason = activeShellTab?.readOnlyReason ?? 'AI 正在生成此页面，当前页为只读预览。';

  const fileExplorerStatusText = useMemo(() => {
    if (!tabSnapshot.activeTabId) {
      return filesT('status.noActiveFile');
    }
    if (isDirty) {
      return filesT('status.unsavedShort');
    }
    return activeShellSaveSource === 'auto'
      ? filesT('status.autoSaved')
      : filesT('status.savedShort');
  }, [activeShellSaveSource, currentLocale, filesT, isDirty, tabSnapshot.activeTabId]);

  useEffect(() => {
    let cancelled = false;

    if (appMode !== 'shell' || !vfsInitialized || shellSessionHydrated) {
      return () => {
        cancelled = true;
      };
    }

    void workspacePersistence
      .getJSON<PersistedShellSession>(PREVIEW_PERSISTENCE_NAMESPACE, SHELL_SESSION_PERSISTENCE_KEY)
      .then(async (storedSession) => {
        if (cancelled || !storedSession) {
          return;
        }

        const nodes = await vfs.listTree(activeProjectId);
        if (cancelled) {
          return;
        }

        const nodeMap = new Map(nodes.map((node) => [node.id, node]));
        const restoredTabs: TabManagerSnapshot['tabs'] = [];

        for (const persistedTab of storedSession.tabs.tabs) {
          const liveNode = nodeMap.get(persistedTab.fileId);
          if (!liveNode || liveNode.type !== 'file') {
            continue;
          }

          let schema = persistedTab.schema;
          if (!persistedTab.isDirty) {
            try {
              schema = await vfs.readFile(activeProjectId, persistedTab.fileId) as PageSchema;
            } catch {
              continue;
            }
          }

          restoredTabs.push({
            ...persistedTab,
            schema,
            fileName: liveNode.name,
            filePath: liveNode.path,
            fileType: liveNode.fileType ?? persistedTab.fileType,
            isGenerating: false,
            readOnlyReason: undefined,
            generationUpdatedAt: undefined,
          });
        }

        const activeTabId = storedSession.tabs.activeTabId
          && restoredTabs.some((tab) => tab.fileId === storedSession.tabs.activeTabId)
          ? storedSession.tabs.activeTabId
          : restoredTabs[0]?.fileId;

        tabManager.restoreSnapshot({
          tabs: restoredTabs,
          activeTabId,
        });

        const directoryIds = new Set(
          nodes.filter((node) => node.type === 'directory').map((node) => node.id),
        );
        setFileExplorerExpandedIds(
          (storedSession.expandedIds ?? []).filter((id) => directoryIds.has(id)),
        );
        setFileExplorerFocusedId(
          storedSession.focusedId && nodeMap.has(storedSession.focusedId)
            ? storedSession.focusedId
            : undefined,
        );

        const activeTab = activeTabId
          ? restoredTabs.find((tab) => tab.fileId === activeTabId)
          : undefined;
        await fileEditor.commands.execute('editor.restoreSnapshot', {
          snapshot: activeTab
            ? {
              schema: activeTab.schema,
              currentFileId: activeTab.fileId,
              isDirty: activeTab.isDirty,
              ...(activeTab.selectedNodeId ? { selectedNodeId: activeTab.selectedNodeId } : {}),
            }
            : {
              schema: createEmptyShellSchema(),
              isDirty: false,
            },
        });
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setShellSessionHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    appMode,
    fileEditor.commands,
    shellSessionHydrated,
    tabManager,
    vfs,
    vfsInitialized,
    workspacePersistence,
  ]);

  useEffect(() => {
    if (appMode !== 'shell' || !shellSessionHydrated || !vfsInitialized) {
      return;
    }

    void workspacePersistence
      .setJSON<PersistedShellSession>(
        PREVIEW_PERSISTENCE_NAMESPACE,
        SHELL_SESSION_PERSISTENCE_KEY,
        {
          tabs: {
            ...tabSnapshot,
            tabs: tabSnapshot.tabs.map((tab) => ({
              ...tab,
              isGenerating: false,
              readOnlyReason: undefined,
              generationUpdatedAt: undefined,
            })),
          },
          expandedIds: fileExplorerExpandedIds,
          ...(fileExplorerFocusedId ? { focusedId: fileExplorerFocusedId } : {}),
        },
      )
      .catch(() => undefined);
  }, [
    appMode,
    fileExplorerExpandedIds,
    fileExplorerFocusedId,
    shellSessionHydrated,
    tabSnapshot,
    vfsInitialized,
    workspacePersistence,
  ]);

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
  const selectedNodePosition = useMemo(
    () => getTreeArrayPosition(selectedNodeId),
    [selectedNodeId],
  );
  const selectedNodeSiblingCount = useMemo(
    () => (
      selectedNodePosition
        ? getContainerNodeCount(activeSchema, selectedNodePosition.targetParentTreeId)
        : 0
    ),
    [activeSchema, selectedNodePosition],
  );
  const canDeleteSelectedNode = Boolean(selectedNodeId) && !shellGenerationLock;
  const canDuplicateSelectedNode = Boolean(selectedNodeId && selectedNode) && !shellGenerationLock;
  const canMoveSelectedNodeUp = Boolean(
    selectedNodePosition
    && selectedNodePosition.index > 0
    && !shellGenerationLock,
  );
  const canMoveSelectedNodeDown = Boolean(
    selectedNodePosition
    && selectedNodePosition.index < selectedNodeSiblingCount - 1
    && !shellGenerationLock,
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
  const notifyGenerationLock = useCallback(() => {
    if (!shellGenerationLock) {
      return false;
    }
    antd.message.warning(shellGenerationReason);
    return true;
  }, [shellGenerationLock, shellGenerationReason]);
  const guardedPatchSelectedNode = useMemo(() => ({
    props: (patch: Record<string, unknown>) => {
      if (notifyGenerationLock()) return;
      patchSelectedNode.props?.(patch);
    },
    columns: (columns: unknown[]) => {
      if (notifyGenerationLock()) return;
      patchSelectedNode.columns?.(columns);
    },
    style: (patch: Record<string, unknown>) => {
      if (notifyGenerationLock()) return;
      patchSelectedNode.style?.(patch);
    },
    events: (patch: Record<string, unknown>) => {
      if (notifyGenerationLock()) return;
      patchSelectedNode.events?.(patch);
    },
    logic: (patch: Record<string, unknown>) => {
      if (notifyGenerationLock()) return;
      patchSelectedNode.logic?.(patch);
    },
  }), [notifyGenerationLock, patchSelectedNode]);
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
    mode: appMode === 'shell' ? 'shell' : 'scenarios',
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
    updateScenarioSnapshot,
    shellSnapshot.currentFileId,
  ]);
  const ensureCurrentShellTab = useCallback(async () => {
    if (appMode !== 'shell' || !vfsInitialized) {
      return undefined;
    }

    if (tabSnapshot.activeTabId) {
      return tabSnapshot.activeTabId;
    }

    if (shellSnapshot.currentFileId) {
      await fileEditor.commands.execute('tab.open', { fileId: shellSnapshot.currentFileId });
      return shellSnapshot.currentFileId;
    }

    const schema = cloneSchema(shellSnapshot.schema);
    const shouldMaterialize = shellSnapshot.isDirty
      || hasSchemaContent(schema)
      || ((schema.name?.trim().length ?? 0) > 0 && schema.name !== createEmptyShellSchema().name);
    if (!shouldMaterialize) {
      return undefined;
    }

    const createdNode = await fileEditor.commands.execute('fs.createFile', {
      parentId: null,
      name: schema.name?.trim() || previewT('toolbar.untitled'),
      fileType: 'page',
      content: schema,
    }) as { id?: string } | undefined;
    if (!createdNode?.id) {
      throw new Error('Failed to materialize current shell page as a tab');
    }

    await fileEditor.commands.execute('tab.open', { fileId: createdNode.id });
    return createdNode.id;
  }, [
    appMode,
    fileEditor.commands,
    previewT,
    shellSnapshot.currentFileId,
    shellSnapshot.isDirty,
    shellSnapshot.schema,
    tabSnapshot.activeTabId,
    vfsInitialized,
  ]);
  const executeAppCommand = useCallback((commandId: string, payload?: unknown) => {
    if (appMode === 'shell' && shellGenerationLock && isBlockedDuringGeneration(commandId)) {
      antd.message.warning(shellGenerationReason);
      return Promise.resolve(undefined);
    }
    if (commandId === 'shell.ensureCurrentTab') {
      return ensureCurrentShellTab();
    }
    if (commandId === 'workspace.resetDocument') {
      return handleResetWorkspace();
    }
    return executeHostPluginCommand(commandId, payload);
  }, [
    appMode,
    ensureCurrentShellTab,
    executeHostPluginCommand,
    handleResetWorkspace,
    shellGenerationLock,
    shellGenerationReason,
  ]);

  // File system service for plugin context
  const filesystemService = useMemo(() => {
    if (!vfsInitialized) return undefined;
    return {
      createFile: async (name: string, fileType: string, content: Record<string, unknown>, parentId?: string) => {
        const node = await vfs.createFile(activeProjectId, parentId ?? null, name, fileType as any, content);
        refreshFsTree();
        return node.id;
      },
      readFile: async (fileId: string) => {
        return await vfs.readFile(activeProjectId, fileId) as Record<string, unknown>;
      },
      writeFile: async (fileId: string, content: Record<string, unknown>) => {
        await vfs.writeFile(activeProjectId, fileId, content);
      },
    };
  }, [refreshFsTree, vfs, vfsInitialized]);

  const pluginContext = usePluginContext({
    schema: activeSchema,
    selectedNode,
    selectedNodeId,
    replaceSchema: (schema) => {
      if (notifyGenerationLock()) {
        return;
      }
      updateActiveSchema(() => schema);
    },
    patchSelectedNode: guardedPatchSelectedNode,
    executeCommand: executeAppCommand,
    notifications,
  });

  // Enhance plugin context with filesystem
  const enhancedPluginContext = useMemo(() => ({
    ...pluginContext,
    ...(filesystemService ? { filesystem: filesystemService } : {}),
    // Include fsTree/tabSnapshot so sidebar re-renders when they change (read via refs in plugin render)
    _fsTreeVersion: fsTree,
    _tabSnapshotVersion: tabSnapshot,
  }), [filesystemService, fsTree, pluginContext, tabSnapshot]);

  // Tab actions
  const handleActivateTab = useCallback((fileId: string) => {
    void fileEditor.commands.execute('tab.activate', { fileId });
  }, [fileEditor.commands]);

  const handleCloseTab = useCallback((fileId: string) => {
    // For the active tab, check live editor dirty state (TabManager copy may be stale)
    const isActive = tabManager.getActiveTabId() === fileId;
    const isDirtyCheck = isActive ? shellSnapshot.isDirty : tabManager.getTab(fileId)?.isDirty;
    if (isDirtyCheck) {
      if (!window.confirm(previewT('prompt.confirmClose'))) {
        return;
      }
    }
    void fileEditor.commands.execute('tab.close', { fileId });
  }, [fileEditor.commands, previewT, shellSnapshot.isDirty, tabManager]);

  const handleCloseOtherTabs = useCallback((fileId: string) => {
    void fileEditor.commands.execute('tab.closeOthers', { fileId });
  }, [fileEditor.commands]);

  const handleCloseAllTabs = useCallback(() => {
    void fileEditor.commands.execute('tab.closeAll');
  }, [fileEditor.commands]);

  const handleCloseSavedTabs = useCallback(() => {
    void fileEditor.commands.execute('tab.closeSaved');
  }, [fileEditor.commands]);

  const handleMoveTab = useCallback((fromIndex: number, toIndex: number) => {
    tabManager.moveTab(fromIndex, toIndex);
  }, [tabManager]);

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

  const handleMoveNode = useCallback((nodeId: string, newParentId: string | null, afterNodeId: string | null) => {
    void fileEditor.commands.execute('fs.move', { nodeId, newParentId, afterNodeId });
  }, [fileEditor.commands]);

  // Import JSON file handler
  const handleImportJSONFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-imported
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    try {
      if (notifyGenerationLock()) {
        return;
      }
      const text = await file.text();
      let schema: PageSchema;

      try {
        schema = JSON.parse(text) as PageSchema;
      } catch {
        antd.message.error(previewT('import.invalidJSON'));
        return;
      }

      if (!schema || typeof schema !== 'object' || !('body' in schema)) {
        antd.message.error(previewT('import.missingBody'));
        return;
      }

      // Overwrite current page schema directly
      await fileEditor.commands.execute('editor.restoreSnapshot', {
        snapshot: {
          schema,
          isDirty: true,
          ...(shellSnapshot.currentFileId ? { currentFileId: shellSnapshot.currentFileId } : {}),
        },
      });

      antd.message.success(previewT('import.success'));
    } catch {
      antd.message.error(previewT('import.readError'));
    }
  }, [fileEditor.commands, notifyGenerationLock, previewT, shellSnapshot.currentFileId]);

  const handleExpandedIdsChange = useCallback((nextExpandedIds: string[]) => {
    setFileExplorerExpandedIds((previous) => (
      areStringArraysEqual(previous, nextExpandedIds) ? previous : nextExpandedIds
    ));
  }, []);

  const handleFocusedIdChange = useCallback((nextFocusedId: string | undefined) => {
    setFileExplorerFocusedId((previous) => (
      previous === nextFocusedId ? previous : nextFocusedId
    ));
  }, []);

  const handleSaveGuarded = useCallback(() => {
    if (notifyGenerationLock()) {
      return;
    }
    handleSave();
  }, [handleSave, notifyGenerationLock]);

  const handleUndoGuarded = useCallback(() => {
    if (notifyGenerationLock()) {
      return;
    }
    handleUndo();
  }, [handleUndo, notifyGenerationLock]);

  const handleRedoGuarded = useCallback(() => {
    if (notifyGenerationLock()) {
      return;
    }
    handleRedo();
  }, [handleRedo, notifyGenerationLock]);

  // Keep stable refs for FileExplorer props to avoid recreating plugins on every tree/tab change
  const fsTreeRef = useRef(fsTree);
  fsTreeRef.current = fsTree;
  const tabSnapshotRef = useRef(tabSnapshot);
  tabSnapshotRef.current = tabSnapshot;
  const handleOpenFileFromTreeRef = useRef(handleOpenFileFromTree);
  handleOpenFileFromTreeRef.current = handleOpenFileFromTree;
  const handleCreateFileRef = useRef(handleCreateFile);
  handleCreateFileRef.current = handleCreateFile;
  const handleCreateDirectoryRef = useRef(handleCreateDirectory);
  handleCreateDirectoryRef.current = handleCreateDirectory;
  const handleDeleteNodeRef = useRef(handleDeleteNode);
  handleDeleteNodeRef.current = handleDeleteNode;
  const handleRenameNodeRef = useRef(handleRenameNode);
  handleRenameNodeRef.current = handleRenameNode;
  const handleMoveNodeRef = useRef(handleMoveNode);
  handleMoveNodeRef.current = handleMoveNode;
  const refreshFsTreeRef = useRef(refreshFsTree);
  refreshFsTreeRef.current = refreshFsTree;
  const dirtyFileIdsRef = useRef(dirtyFileIds);
  dirtyFileIdsRef.current = dirtyFileIds;
  const handleSaveRef = useRef(handleSaveGuarded);
  handleSaveRef.current = handleSaveGuarded;
  const handleCloseTabRef = useRef(handleCloseTab);
  handleCloseTabRef.current = handleCloseTab;
  const fileExplorerStatusTextRef = useRef(fileExplorerStatusText);
  fileExplorerStatusTextRef.current = fileExplorerStatusText;
  const fileExplorerExpandedIdsRef = useRef(fileExplorerExpandedIds);
  fileExplorerExpandedIdsRef.current = fileExplorerExpandedIds;
  const fileExplorerFocusedIdRef = useRef(fileExplorerFocusedId);
  fileExplorerFocusedIdRef.current = fileExplorerFocusedId;
  const handleExpandedIdsChangeRef = useRef(handleExpandedIdsChange);
  handleExpandedIdsChangeRef.current = handleExpandedIdsChange;
  const handleFocusedIdChangeRef = useRef(handleFocusedIdChange);
  handleFocusedIdChangeRef.current = handleFocusedIdChange;

  const handleCanvasSelectNode = (schemaNodeId: string) => {
    if (shellGenerationLock) {
      return;
    }
    selectSchemaNode(schemaNodeId);
  };

  const handleCanvasDeselectNode = () => {
    if (shellGenerationLock) {
      return;
    }
    selectTreeNode(getDefaultSelectedNodeId(treeNodes) ?? '');
  };

  const handleBreadcrumbSelect = (treeNodeId: string) => {
    selectTreeNode(treeNodeId);
  };

  const [breadcrumbHoveredSchemaId, setBreadcrumbHoveredSchemaId] = useState<string | null>(null);

  const handleBreadcrumbHover = useCallback((treeNodeId: string | null) => {
    if (!treeNodeId) {
      setBreadcrumbHoveredSchemaId(null);
      return;
    }
    const node = getSchemaNodeByTreeId(activeSchema, treeNodeId);
    setBreadcrumbHoveredSchemaId(node?.id ?? null);
  }, [activeSchema]);

  const executeSchemaCommand = useCallback((commandId: string, payload: Record<string, unknown>) => {
    if (notifyGenerationLock()) {
      return;
    }
    if (appMode === 'shell') {
      void fileEditor.commands.execute(commandId, payload).catch((error) => {
        antd.message.error(error instanceof Error ? error.message : String(error));
      });
      return;
    }
    executeScenarioCommand(commandId, payload);
  }, [appMode, executeScenarioCommand, fileEditor.commands, notifyGenerationLock]);

  const insertComponentAtTarget = useCallback((componentType: string, target: CanvasDropTarget) => {
    const contract = getBuiltinContract(componentType);
    if (!contract || notifyGenerationLock()) {
      return;
    }

    const position = resolveCanvasDropPosition(activeSchema, target);
    if (!position) {
      return;
    }

    const node = createSchemaNodeFromContract(contract);
    executeSchemaCommand('node.insertAt', {
      node,
      ...(position.parentTreeId ? { parentTreeId: position.parentTreeId } : {}),
      index: position.index,
    });

    if (node.id) {
      requestAnimationFrame(() => {
        selectSchemaNode(node.id!);
      });
    }
  }, [activeSchema, executeSchemaCommand, notifyGenerationLock, selectSchemaNode]);

  const handleInsertComponent = useCallback((componentType: string) => {
    const canAppendInside = selectedContract?.children
      && ['node', 'nodes', 'mixed'].includes(selectedContract.children.type);
    insertComponentAtTarget(componentType, selectedNodeId && canAppendInside && selectedNode?.id
      ? {
          placement: 'inside',
          targetNodeSchemaId: selectedNode.id,
        }
      : {
          placement: selectedNode?.id ? 'after' : 'root',
          ...(selectedNode?.id ? { targetNodeSchemaId: selectedNode.id } : {}),
        });
  }, [
    insertComponentAtTarget,
    notifyGenerationLock,
    selectedContract,
    selectedNode,
    selectedNodeId,
  ]);

  const handleDeleteSelectedNode = useCallback(() => {
    if (!selectedNodeId || notifyGenerationLock()) {
      return;
    }
    const nextSchema = removeSchemaNode(activeSchema, selectedNodeId);
    executeSchemaCommand('node.remove', { treeId: selectedNodeId });
    requestAnimationFrame(() => {
      const nextTree = buildEditorTree(nextSchema);
      selectTreeNode(getDefaultSelectedNodeId(nextTree) ?? '');
    });
  }, [activeSchema, executeSchemaCommand, notifyGenerationLock, selectTreeNode, selectedNodeId]);

  const handleDuplicateSelectedNode = useCallback(() => {
    if (!selectedNodeId || !selectedNode || notifyGenerationLock()) {
      return;
    }
    const position = getTreeArrayPosition(selectedNodeId);
    if (!position) {
      return;
    }
    const duplicatedNode = cloneSchemaNodeWithFreshIds(selectedNode);
    executeSchemaCommand('node.insertAt', {
      node: duplicatedNode,
      ...(position.targetParentTreeId ? { parentTreeId: position.targetParentTreeId } : {}),
      index: position.index + 1,
    });
    if (duplicatedNode.id) {
      requestAnimationFrame(() => {
        selectSchemaNode(duplicatedNode.id!);
      });
    }
  }, [executeSchemaCommand, notifyGenerationLock, selectSchemaNode, selectedNode, selectedNodeId]);

  const moveSelectedNode = useCallback((direction: -1 | 1) => {
    if (!selectedNodeId || notifyGenerationLock()) {
      return;
    }
    const position = getTreeArrayPosition(selectedNodeId);
    if (!position) {
      return;
    }
    const nextIndex = position.index + direction;
    if (nextIndex < 0) {
      return;
    }
    executeSchemaCommand('node.move', {
      sourceTreeId: selectedNodeId,
      ...(position.targetParentTreeId ? { targetParentTreeId: position.targetParentTreeId } : {}),
      index: nextIndex,
    });
  }, [executeSchemaCommand, notifyGenerationLock, selectedNodeId]);

  const handleCanvasInsertComponent = useCallback((componentType: string, target: CanvasDropTarget) => {
    insertComponentAtTarget(componentType, target);
  }, [insertComponentAtTarget]);

  const handleCanvasMoveSelectedNode = useCallback((target: CanvasDropTarget) => {
    if (!selectedNodeId || notifyGenerationLock()) {
      return;
    }
    if (target.targetNodeSchemaId) {
      const targetTreeId = getTreeIdBySchemaNodeId(activeSchema, target.targetNodeSchemaId);
      if (
        targetTreeId
        && (targetTreeId === selectedNodeId || targetTreeId.startsWith(`${selectedNodeId}.children.`))
      ) {
        return;
      }
    }

    const position = resolveCanvasDropPosition(activeSchema, target);
    if (!position) {
      return;
    }

    executeSchemaCommand('node.move', {
      sourceTreeId: selectedNodeId,
      ...(position.parentTreeId ? { targetParentTreeId: position.parentTreeId } : {}),
      index: position.index,
    });
  }, [activeSchema, executeSchemaCommand, notifyGenerationLock, selectedNodeId]);

  const plugins = useMemo(() => {
    const registeredPlugins = [
      defineEditorPlugin({
        id: 'preview.workspace',
        name: 'Preview Workspace Commands',
        contributes: {
          commands: [
            {
              id: 'workspace.resetDocument',
              title: previewT('commands.resetDocument.title'),
              category: 'Workspace',
              description: previewT('commands.resetDocument.description'),
              execute: () => {
                void executeAppCommand('workspace.resetDocument');
              },
            },
          ],
        },
      }),
      defineEditorPlugin({
        id: 'preview.canvas-editing',
        name: 'Preview Canvas Editing',
        contributes: {
          commands: [
            {
              id: 'canvas.deleteSelectedNode',
              title: 'Delete Selected Node',
              category: 'Canvas',
              enabledWhen: 'hasSelection && !canvasReadOnly && canCanvasDeleteSelection',
              execute: () => {
                handleDeleteSelectedNode();
              },
            },
            {
              id: 'canvas.duplicateSelectedNode',
              title: 'Duplicate Selected Node',
              category: 'Canvas',
              enabledWhen: 'hasSelection && !canvasReadOnly && canCanvasDuplicateSelection',
              execute: () => {
                handleDuplicateSelectedNode();
              },
            },
            {
              id: 'canvas.moveSelectedNodeUp',
              title: 'Move Selected Node Up',
              category: 'Canvas',
              enabledWhen: 'hasSelection && !canvasReadOnly && canCanvasMoveSelectionUp',
              execute: () => {
                moveSelectedNode(-1);
              },
            },
            {
              id: 'canvas.moveSelectedNodeDown',
              title: 'Move Selected Node Down',
              category: 'Canvas',
              enabledWhen: 'hasSelection && !canvasReadOnly && canCanvasMoveSelectionDown',
              execute: () => {
                moveSelectedNode(1);
              },
            },
          ],
          shortcuts: [
            {
              id: 'canvas.deleteSelectedNode.delete',
              commandId: 'canvas.deleteSelectedNode',
              keybinding: 'Delete',
              when: 'editorFocused && !inputFocused',
            },
            {
              id: 'canvas.deleteSelectedNode.backspace',
              commandId: 'canvas.deleteSelectedNode',
              keybinding: 'Backspace',
              when: 'editorFocused && !inputFocused',
            },
            {
              id: 'canvas.moveSelectedNodeUp.shortcut',
              commandId: 'canvas.moveSelectedNodeUp',
              keybinding: 'Alt+ArrowUp',
              when: 'editorFocused && !inputFocused',
            },
            {
              id: 'canvas.moveSelectedNodeDown.shortcut',
              commandId: 'canvas.moveSelectedNodeDown',
              keybinding: 'Alt+ArrowDown',
              when: 'editorFocused && !inputFocused',
            },
          ],
          contextMenus: [
            {
              id: 'canvas.moveSelectedNodeUp.context',
              label: 'Move Up',
              commandId: 'canvas.moveSelectedNodeUp',
              area: 'canvas',
              group: 'edit',
            },
            {
              id: 'canvas.duplicateSelectedNode.context',
              label: 'Duplicate',
              commandId: 'canvas.duplicateSelectedNode',
              area: 'canvas',
              group: 'edit',
            },
            {
              id: 'canvas.moveSelectedNodeDown.context',
              label: 'Move Down',
              commandId: 'canvas.moveSelectedNodeDown',
              area: 'canvas',
              group: 'edit',
            },
            {
              id: 'canvas.deleteSelectedNode.context',
              label: 'Delete',
              commandId: 'canvas.deleteSelectedNode',
              area: 'canvas',
              group: 'edit',
            },
          ],
        },
      }),
      createSetterPlugin({
        inspectorTabs: [
          {
            id: 'debug',
            label: previewT('plugins.debug.label'),
            order: 99,
            render: (context) => (
              <div className="p-3 text-xs text-text-secondary">
                {previewT('plugins.debug.loaded')}
                {context.selectedNode?.id ? (
                  <div className="mt-2 text-[11px]">
                    {previewT('plugins.debug.selected', { nodeId: context.selectedNode.id })}
                  </div>
                ) : null}
              </div>
            ),
          },
        ],
      }),
      createAIChatPlugin({
        defaultWidth: 300,
        getAvailableComponents: () => builtinContracts,
      }),
    ];

    if (appMode === 'shell' && vfsInitialized) {
      registeredPlugins.push(createFilesPlugin({
        ...(filesPrimaryPanelOptions ?? {
          files: [],
          activeFileId: undefined,
          status: fileExplorerStatusText,
          onOpenFile: () => undefined,
          onSaveFile: () => undefined,
          onSaveAsFile: () => undefined,
          onRefresh: () => undefined,
        }),
        renderPrimaryPanel: () => (
          <FileExplorer
            tree={fsTreeRef.current}
            activeFileId={tabSnapshotRef.current.activeTabId}
            dirtyFileIds={dirtyFileIdsRef.current}
            statusText={fileExplorerStatusTextRef.current}
            canSaveActiveFile={Boolean(tabSnapshotRef.current.activeTabId) && dirtyFileIdsRef.current.has(tabSnapshotRef.current.activeTabId ?? '')}
            onSaveActiveFile={handleSaveRef.current}
            initialExpandedIds={fileExplorerExpandedIdsRef.current}
            initialFocusedId={fileExplorerFocusedIdRef.current}
            onExpandedIdsChange={handleExpandedIdsChangeRef.current}
            onFocusedIdChange={handleFocusedIdChangeRef.current}
            onOpenFile={handleOpenFileFromTreeRef.current}
            onCreateFile={handleCreateFileRef.current}
            onCreateDirectory={handleCreateDirectoryRef.current}
            onDeleteNode={handleDeleteNodeRef.current}
            onRenameNode={handleRenameNodeRef.current}
            onRefresh={refreshFsTreeRef.current}
            onMoveNode={handleMoveNodeRef.current}
          />
        ),
      }));
      registeredPlugins.push(defineEditorPlugin({
        id: 'shenbi.plugin.files.commands',
        name: `${filesT('pluginName')} Commands`,
        contributes: {
          commands: [
            {
              id: 'files.closeActiveTab',
              title: previewT('plugins.files.closeActiveTab'),
              category: filesT('title'),
              execute: () => {
                const activeId = tabSnapshotRef.current.activeTabId;
                if (activeId) handleCloseTabRef.current(activeId);
              },
            },
          ],
          shortcuts: [
            {
              id: 'files.closeActiveTab.shortcut',
              commandId: 'files.closeActiveTab',
              keybinding: 'Ctrl+W',
              when: 'editorFocused && !inputFocused',
            },
          ],
        },
      }));

      // GitLab Sync plugin
      registeredPlugins.push(createGitLabSyncPlugin({
        activeProjectId: activeProjectConfig.gitlabProjectId ?? lastGitLabProjectConfig?.gitlabProjectId,
        activeBranch: activeProjectConfig.branch ?? lastGitLabProjectConfig?.branch,
        onSelectProject: handleSelectGitLabProject,
        onUnbindProject: activeProjectConfig.gitlabProjectId ? handleUnbindProject : undefined,
        projectName: activeProjectConfig.projectName,
        getLocalFiles: async () => {
          const nodes = await vfs.listTree(activeProjectId);
          const files = new Map<string, string>();
          for (const node of nodes) {
            if (node.type === 'file') {
              try {
                const content = await vfs.readFile(activeProjectId, node.id);
                if (content && typeof content === 'object') {
                  files.set(node.path, JSON.stringify(content, null, 2));
                }
              } catch { /* skip unreadable files */ }
            }
          }
          return files;
        },
        writeLocalFile: async (path: string, content: string) => {
          try {
            const parsed = JSON.parse(content);
            // GitLab path: "待办跟踪/待办看板.page.json" → VFS path: "/待办跟踪/待办看板.page.json"
            const vfsPath = `/${path.replace(/^\/+/, '')}`;

            const node = await vfs.getNodeByPath(activeProjectId, vfsPath).catch(() => null);
            if (node) {
              // Update existing file
              await vfs.writeFile(activeProjectId, node.id, parsed);
            } else {
              // Create new file: strip extension for name (VFS auto-appends it)
              const knownExts: [string, string][] = [
                ['.page.json', 'page'], ['.api.json', 'api'], ['.flow.json', 'flow'],
                ['.db.json', 'db'], ['.dict.json', 'dict'],
              ];
              const cleanPath = path.replace(/^\/+/, '');
              let basePath = cleanPath;
              let fileType = 'page';
              for (const [ext, ft] of knownExts) {
                if (cleanPath.endsWith(ext)) {
                  basePath = cleanPath.slice(0, -ext.length);
                  fileType = ft;
                  break;
                }
              }

              // Handle nested paths: "待办跟踪/待办看板" → create dir "待办跟踪", then file "待办看板" inside it
              const parts = basePath.split('/');
              const fileName = parts.pop()!;
              let parentId: string | null = null;

              // Create directories recursively
              for (let i = 0; i < parts.length; i++) {
                const dirPath = `/${parts.slice(0, i + 1).join('/')}`;
                const dirNode = await vfs.getNodeByPath(activeProjectId, dirPath).catch(() => null);
                if (dirNode) {
                  parentId = dirNode.id;
                } else {
                  const newDir = await vfs.createDirectory(activeProjectId, parentId, parts[i]!);
                  parentId = newDir.id;
                }
              }

              await vfs.createFile(activeProjectId, parentId, fileName, fileType as 'page', parsed);
            }
          } catch { /* skip invalid JSON */ }
        },
        deleteLocalFile: async (path: string) => {
          try {
            const vfsPath = `/${path.replace(/^\/+/, '')}`;
            const node = await vfs.getNodeByPath(activeProjectId, vfsPath).catch(() => null);
            if (node) {
              await vfs.deleteFile(activeProjectId, node.id);
            }
          } catch { /* ignore */ }
        },
        refreshFileTree: () => refreshFsTreeRef.current(),
      }));
    } else if (appMode === 'shell' && filesPrimaryPanelOptions) {
      registeredPlugins.push(createFilesPlugin(filesPrimaryPanelOptions));
    }

    return registeredPlugins;
  }, [
    activeProjectConfig?.branch,
    activeProjectConfig?.gitlabProjectId,
    activeProjectId,
    appMode,
    executeAppCommand,
    fileExplorerStatusText,
    filesPrimaryPanelOptions,
    filesT,
    handleDeleteSelectedNode,
    handleDuplicateSelectedNode,
    moveSelectedNode,
    handleSelectGitLabProject,
    lastGitLabProjectConfig?.branch,
    lastGitLabProjectConfig?.gitlabProjectId,
    previewT,
    vfs,
    vfsInitialized,
  ]);

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
  }, [scenarioOptions, workspacePersistence]);

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
  }, [
    activeProjectConfig?.branch,
    activeProjectConfig?.gitlabProjectId,
    activeProjectId,
    activeScenario,
    handleSelectGitLabProject,
    refreshFsTreeRef,
    scenarioPersistenceHydrated,
    vfs,
    workspacePersistence,
  ]);

  useEffect(() => {
    let cancelled = false;
    void workspacePersistence
      .getJSON<RenderMode>(PREVIEW_PERSISTENCE_NAMESPACE, RENDER_MODE_PERSISTENCE_KEY)
      .then((storedMode) => {
        if (cancelled || !storedMode || !['direct', 'iframe'].includes(storedMode)) {
          return;
        }
        setRenderMode(storedMode);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setRenderModeHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workspacePersistence]);

  useEffect(() => {
    if (!renderModeHydrated) {
      return;
    }
    void workspacePersistence
      .setJSON(PREVIEW_PERSISTENCE_NAMESPACE, RENDER_MODE_PERSISTENCE_KEY, renderMode)
      .catch(() => undefined);
  }, [renderMode, renderModeHydrated, workspacePersistence]);

  const handleBackToProjects = useCallback(() => {
    clearActiveProject();
    setActiveProjectConfig(createLocalProjectConfig());
    setVfsInitialized(false);
    setFsTree([]);
  }, []);

  // ── Project selection gate ──
  return (
    <AppShell
      workspaceId={PREVIEW_WORKSPACE_ID}
      persistenceAdapter={persistenceAdapter}
      renderMode={renderMode}
      canvasReadOnly={shellGenerationLock}
      title={activeProjectConfig.projectName}
      subtitle={activeProjectConfig.branch}
      userAvatarUrl={gitlabUser?.avatarUrl}
      userName={gitlabUser?.username}
      branches={gitlabBranches.length > 0 ? gitlabBranches : undefined}
      onBranchChange={handleBranchChange}
      onLogout={gitlabUser ? handleLogout : undefined}
      gitlabUrl={activeProjectConfig.gitlabUrl}
      onOpenProjectManager={() => setShowProjectManager(true)}
      sidebarProps={{
        contracts: builtinContracts,
        treeNodes,
        onSelectNode: selectTreeNode,
        ...(selectedNodeId ? { selectedNodeId } : {}),
        onInsertComponent: handleInsertComponent,
      }}
      inspectorProps={{
        ...(selectedNode ? { selectedNode } : {}),
        ...(selectedContract ? { contract: selectedContract } : {}),
      }}
      plugins={plugins}
      pluginContext={enhancedPluginContext}
      onCanvasSelectNode={handleCanvasSelectNode}
      onCanvasDeselectNode={handleCanvasDeselectNode}
      {...(selectedNodeId ? { selectedNodeTreeId: selectedNodeId } : {})}
      canCanvasDropInsideNode={(nodeSchemaId) => canSchemaNodeAcceptCanvasChildren(activeSchema, nodeSchemaId)}
      onCanvasInsertComponent={handleCanvasInsertComponent}
      onCanvasMoveSelectedNode={handleCanvasMoveSelectedNode}
      canDeleteSelectedNode={canDeleteSelectedNode}
      canDuplicateSelectedNode={canDuplicateSelectedNode}
      canMoveSelectedNodeUp={canMoveSelectedNodeUp}
      canMoveSelectedNodeDown={canMoveSelectedNodeDown}
      {...(selectedNode?.id ? { selectedNodeSchemaId: selectedNode.id } : {})}
      {...(breadcrumbHoveredSchemaId ? { hoveredNodeSchemaId: breadcrumbHoveredSchemaId } : {})}
      schemaName={shellSchemaName}
      breadcrumbItems={breadcrumbItems}
      onBreadcrumbSelect={handleBreadcrumbSelect}
      onBreadcrumbHover={handleBreadcrumbHover}
      tabs={appMode === 'shell' && tabSnapshot.tabs.length > 0 ? tabSnapshot.tabs : undefined}
      activeTabId={tabSnapshot.activeTabId}
      onActivateTab={handleActivateTab}
      onCloseTab={handleCloseTab}
      onCloseOtherTabs={handleCloseOtherTabs}
      onCloseAllTabs={handleCloseAllTabs}
      onCloseSavedTabs={handleCloseSavedTabs}
      onMoveTab={handleMoveTab}
      toolbarExtra={(
        <div className="flex items-center gap-2">
          <span className="text-text-secondary" style={{ fontSize: '11px' }}>
            {previewT('mode')}
          </span>
          <select
            className="h-7 w-[110px] rounded border border-border-ide bg-bg-panel px-2 text-text-primary outline-none transition-colors hover:bg-bg-activity-bar focus:border-blue-500"
            style={{ fontSize: '12px' }}
            aria-label={previewT('aria.modeSwitch')}
            value={appMode}
            onChange={(event) => setAppMode(event.target.value as AppMode)}
          >
            {modeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="text-text-secondary" style={{ fontSize: '11px' }}>
            Render
          </span>
          <select
            className="h-7 w-[110px] rounded border border-border-ide bg-bg-panel px-2 text-text-primary outline-none transition-colors hover:bg-bg-activity-bar focus:border-blue-500"
            style={{ fontSize: '12px' }}
            aria-label="Canvas render mode"
            value={renderMode}
            onChange={(event) => setRenderMode(event.target.value as RenderMode)}
          >
            <option value="iframe">iframe</option>
            <option value="direct">direct</option>
          </select>
          {appMode === 'scenarios' ? (
            <>
              <span className="text-text-secondary" style={{ fontSize: '11px' }}>
                {previewT('scenario')}
              </span>
              <select
                className="h-7 w-[180px] rounded border border-border-ide bg-bg-panel px-2 text-text-primary outline-none transition-colors hover:bg-bg-activity-bar focus:border-blue-500"
                style={{ fontSize: '12px' }}
                aria-label={previewT('aria.scenarioSwitch')}
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
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                style={{ display: 'none' }}
                onChange={handleImportJSONFile}
              />
              <button
                type="button"
                aria-label={previewT('toolbar.importJSON')}
                className="p-1.5 rounded text-text-secondary transition-colors hover:bg-bg-activity-bar hover:text-text-primary"
                onClick={() => fileInputRef.current?.click()}
                title={previewT('toolbar.importJSON')}
              >
                <FileUp size={15} />
              </button>
              <span
                aria-label={previewT('toolbar.currentFile')}
                className="max-w-[220px] truncate text-text-secondary"
                style={{ fontSize: '11px' }}
              >
                {activeFileName ?? (tabSnapshot.activeTabId
                  ? tabSnapshot.tabs.find((t) => t.fileId === tabSnapshot.activeTabId)?.fileName
                  : previewT('toolbar.untitled'))}
                {isDirty ? ' *' : ''}
              </span>
              <button
                type="button"
                aria-label={previewT('toolbar.undo')}
                className="p-1.5 rounded text-text-secondary transition-colors hover:bg-bg-activity-bar hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canUndo || shellGenerationLock}
                onClick={handleUndoGuarded}
                title={previewT('toolbar.undo')}
              >
                <Undo2 size={15} />
              </button>
              <button
                type="button"
                aria-label={previewT('toolbar.redo')}
                className="p-1.5 rounded text-text-secondary transition-colors hover:bg-bg-activity-bar hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canRedo || shellGenerationLock}
                onClick={handleRedoGuarded}
                title={previewT('toolbar.redo')}
              >
                <Redo2 size={15} />
              </button>
            </>
          ) : null}
          <button
            type="button"
            aria-label={previewT('toolbar.clearPage')}
            className="p-1.5 rounded text-text-secondary transition-colors hover:bg-bg-activity-bar hover:text-text-primary"
            onClick={() => {
              void executeAppCommand('workspace.resetDocument');
            }}
            title={previewT('toolbar.clearPage')}
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}
    >
      <div className="relative min-h-full">
        {shellGenerationLock ? (
          <div className="absolute right-3 top-3 z-20 rounded border border-blue-500/40 bg-bg-panel/90 px-3 py-1.5 text-[11px] text-text-secondary shadow-sm">
            {shellGenerationReason}
          </div>
        ) : null}
        <div className={shellGenerationLock ? 'pointer-events-none select-none' : undefined}>
          <ScenarioRuntimeView key={`${appMode}:${activeScenario}`} schema={activeSchema} />
        </div>
      </div>
    
      <ProjectManagerDialog
        open={showProjectManager}
        activeProjectId={activeProjectId}
        gitlabUser={gitlabUser}
        onClose={() => setShowProjectManager(false)}
        onSelectProject={handleSelectProject}
        onDeleteProject={handleDeleteProject}
      />
    </AppShell>
  );
}
