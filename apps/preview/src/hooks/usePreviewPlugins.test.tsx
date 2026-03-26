import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePreviewPlugins } from './usePreviewPlugins';
import type {
  PreviewCanvasState,
  PreviewProjectState,
  PreviewServiceContainer,
  PreviewWorkspaceState,
} from '../preview-types';

function createWorkspace(overrides?: Partial<PreviewWorkspaceState>): PreviewWorkspaceState {
  return {
    vfs: {} as never,
    tabManager: {} as never,
    vfsInitialized: true,
    vfsInitializationFailed: false,
    fsTree: [],
    fileExplorerExpandedIds: [],
    fileExplorerFocusedId: undefined,
    setFileExplorerExpandedIds: vi.fn(),
    setFileExplorerFocusedId: vi.fn(),
    handleExpandedIdsChange: vi.fn(),
    handleFocusedIdChange: vi.fn(),
    tabSnapshot: {
      tabs: [],
      activeTabId: 'page-1',
    },
    dirtyFileIds: new Set<string>(),
    activeFileName: 'page-1',
    filesPrimaryPanelOptions: {
      files: [],
      activeFileId: 'page-1',
      status: 'saved',
      onOpenFile: vi.fn(),
      onSaveFile: vi.fn(),
      onSaveAsFile: vi.fn(),
      onRefresh: vi.fn(),
    },
    isDirty: false,
    canUndo: false,
    canRedo: false,
    fileExplorerStatusText: 'saved',
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
    ...overrides,
  } as PreviewWorkspaceState;
}

function createCanvas(): PreviewCanvasState {
  return {
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
}

function createProject(): PreviewProjectState {
  return {
    activeProjectConfig: {
      id: 'demo',
      vfsProjectId: 'demo',
      projectName: 'demo',
      branch: 'main',
      lastOpenedAt: Date.now(),
    },
    activeProjectId: 'demo',
    isFirstLaunch: false,
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
}

function createServices(): PreviewServiceContainer {
  return {
    gitlab: {
      getAuthStatus: vi.fn(async () => ({ authenticated: false })),
      logout: vi.fn(async () => undefined),
      listBranches: vi.fn(async () => []),
      listGroupProjects: vi.fn(async () => []),
      selectProjectMetadata: vi.fn((project) => ({
        id: String(project.id),
        gitlabProjectId: project.id,
        vfsProjectId: String(project.id),
        projectName: project.name,
        branch: project.default_branch,
        lastOpenedAt: Date.now(),
        gitlabUrl: project.web_url,
      })),
    },
  };
}

describe('usePreviewPlugins', () => {
  it('keeps plugin manifests stable across workspace object churn in shell mode', () => {
    const services = createServices();
    const project = createProject();
    const canvas = createCanvas();
    const executeAppCommand = vi.fn(async () => undefined);
    const previewT = vi.fn((key: string) => key);
    const filesT = vi.fn((key: string) => key);
    const vfs = {} as never;
    const initialWorkspace = createWorkspace();

    const { result, rerender } = renderHook(
      ({ workspace }) => usePreviewPlugins({
        appMode: 'shell',
        previewT,
        filesT,
        executeAppCommand,
        vfs,
        services,
        project,
        workspace,
        canvas,
      }),
      {
        initialProps: {
          workspace: initialWorkspace,
        },
      },
    );

    const firstManifests = result.current;

    rerender({
      workspace: createWorkspace({
        tabSnapshot: {
          tabs: [],
          activeTabId: 'page-2',
        },
        filesPrimaryPanelOptions: {
          files: [],
          activeFileId: 'page-2',
          status: 'saved',
          onOpenFile: vi.fn(),
          onSaveFile: vi.fn(),
          onSaveAsFile: vi.fn(),
          onRefresh: vi.fn(),
        },
        fileExplorerStatusText: 'saved',
        activeFileName: 'page-2',
      }),
    });

    expect(result.current).toBe(firstManifests);
    expect(result.current.map((manifest) => manifest.id)).toContain('shenbi.plugin.files');
    expect(result.current.map((manifest) => manifest.id)).toContain('shenbi.plugin.files.commands');
  });
});
