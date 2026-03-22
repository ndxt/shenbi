import { describe, expect, it, vi } from 'vitest';
import {
  getEnabledPreviewPluginIds,
  resolvePreviewPlugins,
} from './preview-plugin-registry';
import type {
  PreviewCanvasState,
  PreviewPluginFactoryContext,
  PreviewProjectState,
  PreviewServiceContainer,
  PreviewWorkspaceState,
} from './preview-types';

function createContext(appMode: 'shell' | 'scenarios', vfsInitialized: boolean): PreviewPluginFactoryContext {
  const workspace = {
    vfs: {} as any,
    tabManager: {} as any,
    vfsInitialized,
    vfsInitializationFailed: false,
    fsTree: [],
    fileExplorerExpandedIds: [],
    fileExplorerFocusedId: undefined,
    setFileExplorerExpandedIds: vi.fn(),
    setFileExplorerFocusedId: vi.fn(),
    handleExpandedIdsChange: vi.fn(),
    handleFocusedIdChange: vi.fn(),
    tabSnapshot: { tabs: [], activeTabId: undefined },
    dirtyFileIds: new Set<string>(),
    activeFileName: undefined,
    filesPrimaryPanelOptions: { files: [], status: 'idle', onOpenFile: vi.fn(), onSaveFile: vi.fn(), onSaveAsFile: vi.fn(), onRefresh: vi.fn() },
    isDirty: false,
    canUndo: false,
    canRedo: false,
    fileExplorerStatusText: 'idle',
    shellGenerationLock: false,
    shellGenerationReason: '',
    notifyGenerationLock: vi.fn(() => false),
    filesystemService: undefined,
    handleSaveGuarded: vi.fn(),
    handleUndoGuarded: vi.fn(),
    handleRedoGuarded: vi.fn(),
    ensureCurrentShellTab: vi.fn(async () => undefined),
    refreshFsTree: vi.fn(),
    handleActivateTab: vi.fn(),
    handleCloseTab: vi.fn(),
    handleCloseOtherTabs: vi.fn(),
    handleCloseAllTabs: vi.fn(),
    handleCloseSavedTabs: vi.fn(),
    handleMoveTab: vi.fn(),
    handleOpenFileFromTree: vi.fn(),
    handleCreateFile: vi.fn(),
    handleCreateDirectory: vi.fn(),
    handleDeleteNode: vi.fn(),
    handleRenameNode: vi.fn(),
    handleMoveNode: vi.fn(),
    handleImportJSONFile: vi.fn(async () => undefined),
  } as PreviewWorkspaceState;

  const project = {
    activeProjectConfig: {
      id: 'gitlab-42',
      gitlabProjectId: 42,
      vfsProjectId: 'gitlab-42',
      projectName: 'preview-demo',
      branch: 'main',
      lastOpenedAt: Date.now(),
      gitlabUrl: 'https://gitlab.example.com/group/preview-demo',
    },
    lastGitLabProjectConfig: null,
    activeProjectId: 'gitlab-42',
    gitlabUser: null,
    gitlabBranches: [],
    consumePendingMigration: vi.fn(() => null),
    handleBranchChange: vi.fn(),
    handleLogout: vi.fn(),
    handleSelectProject: vi.fn(),
    handleSelectGitLabProject: vi.fn(),
    handleDeleteProject: vi.fn(),
    handleUnbindProject: vi.fn(),
  } as PreviewProjectState;

  const canvas = {
    treeNodes: [],
    selectedNodeId: undefined,
    selectedNode: undefined,
    selectedContract: undefined,
    breadcrumbItems: [],
    breadcrumbHoveredSchemaId: null,
    canDeleteSelectedNode: false,
    canDuplicateSelectedNode: false,
    canMoveSelectedNodeUp: false,
    canMoveSelectedNodeDown: false,
    patchSelectedNode: {
      props: vi.fn(),
      columns: vi.fn(),
      style: vi.fn(),
      events: vi.fn(),
      logic: vi.fn(),
    },
    selectTreeNode: vi.fn(),
    handleCanvasSelectNode: vi.fn(),
    handleCanvasDeselectNode: vi.fn(),
    handleBreadcrumbSelect: vi.fn(),
    handleBreadcrumbHover: vi.fn(),
    handleInsertComponent: vi.fn(),
    handleDeleteSelectedNode: vi.fn(),
    handleDuplicateSelectedNode: vi.fn(),
    moveSelectedNode: vi.fn(),
    handleCanvasInsertComponent: vi.fn(),
    handleCanvasMoveSelectedNode: vi.fn(),
    canCanvasDropInsideNode: vi.fn(() => false),
  } as unknown as PreviewCanvasState;

  const services: PreviewServiceContainer = {
    gitlab: {
      getAuthStatus: vi.fn(async () => ({ authenticated: false })),
      logout: vi.fn(async () => undefined),
      listBranches: vi.fn(async () => []),
      listGroupProjects: vi.fn(async () => []),
      selectProjectMetadata: vi.fn((gitlabProject) => ({
        id: `gitlab-${gitlabProject.id}`,
        gitlabProjectId: gitlabProject.id,
        vfsProjectId: `gitlab-${gitlabProject.id}`,
        projectName: gitlabProject.name,
        branch: gitlabProject.default_branch || 'main',
        createdAt: Date.now(),
        lastOpenedAt: Date.now(),
        gitlabUrl: gitlabProject.web_url,
      })),
    },
  };

  return {
    appMode,
    project,
    workspace,
    canvas,
    services,
    commands: {
      executeAppCommand: vi.fn(async () => undefined),
    },
    translations: {
      previewT: (key: string) => key,
      filesT: (key: string) => key,
    },
    featureFlags: {
      shellMode: appMode === 'shell',
      vfsInitialized,
      hasFilesPrimaryPanel: Boolean(workspace.filesPrimaryPanelOptions),
    },
    adapters: {
      files: {
        explorerProps: {
          tree: workspace.fsTree,
          activeFileId: workspace.tabSnapshot.activeTabId,
          dirtyFileIds: workspace.dirtyFileIds,
          statusText: workspace.fileExplorerStatusText,
          canSaveActiveFile: false,
          onSaveActiveFile: workspace.handleSaveGuarded,
          initialExpandedIds: workspace.fileExplorerExpandedIds,
          initialFocusedId: workspace.fileExplorerFocusedId,
          onExpandedIdsChange: workspace.handleExpandedIdsChange,
          onFocusedIdChange: workspace.handleFocusedIdChange,
          onOpenFile: workspace.handleOpenFileFromTree,
          onCreateFile: workspace.handleCreateFile,
          onCreateDirectory: workspace.handleCreateDirectory,
          onDeleteNode: workspace.handleDeleteNode,
          onRenameNode: workspace.handleRenameNode,
          onRefresh: workspace.refreshFsTree,
          onMoveNode: workspace.handleMoveNode,
        },
        activeFileId: workspace.tabSnapshot.activeTabId,
        closeActiveFile: vi.fn(),
      },
      gitlabSync: {
        activeProjectId: 42,
        activeBranch: 'main',
        onSelectProject: vi.fn(),
        onUnbindProject: vi.fn(),
        projectName: 'preview-demo',
        getLocalFiles: vi.fn(async () => new Map()),
        writeLocalFile: vi.fn(async () => undefined),
        deleteLocalFile: vi.fn(async () => undefined),
        refreshFileTree: vi.fn(),
      },
    },
  };
}

describe('preview-plugin-registry', () => {
  it('shell 模式按顺序启用 shell 专属插件', () => {
    const context = createContext('shell', true);
    expect(getEnabledPreviewPluginIds(context)).toEqual([
      'preview.workspace',
      'preview.canvas-editing',
      'shenbi.plugin.setter.debug',
      'shenbi.plugin.ai-chat',
      'shenbi.plugin.gateway',
      'shenbi.plugin.page-canvas',
      'shenbi.plugin.files',
      'shenbi.plugin.files.commands',
      'shenbi.plugin.gitlab-sync',
    ]);

    const manifests = resolvePreviewPlugins(context);
    expect(manifests.map((manifest) => manifest.id)).toEqual([
      'preview.workspace',
      'preview.canvas-editing',
      'shenbi.plugin.setter',
      'shenbi.plugin.ai-chat',
      'shenbi.plugin.gateway',
      'shenbi.plugin.page-canvas',
      'shenbi.plugin.files',
      'shenbi.plugin.files.commands',
      'shenbi.plugin.gitlab-sync',
    ]);
  });

  it('scenarios 模式不会挂载 shell-only 插件', () => {
    const context = createContext('scenarios', false);
    expect(getEnabledPreviewPluginIds(context)).toEqual([
      'preview.workspace',
      'preview.canvas-editing',
      'shenbi.plugin.setter.debug',
      'shenbi.plugin.ai-chat',
      'shenbi.plugin.gateway',
      'shenbi.plugin.page-canvas',
    ]);
  });
});
