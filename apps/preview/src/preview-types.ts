import type { EditorStateSnapshot } from '@shenbi/editor-core';
import type { EditorPluginManifest } from '@shenbi/editor-plugin-api';
import type { PageSchema } from '@shenbi/schema';
import type {
  CanvasEditingState,
  FilesHostAdapter,
  HostPluginRegistration,
  ShellMode,
  WorkspaceHostState,
} from '@shenbi/editor-ui';
import type { ActiveProjectConfig } from './constants';

export type ScenarioKey =
  | 'user-management'
  | 'form-list'
  | 'tabs-detail'
  | 'tree-management'
  | 'descriptions'
  | 'drawer-detail'
  | 'nine-grid';

export type AppMode = ShellMode;
export type RenderMode = 'direct' | 'iframe';

export const DEFAULT_RENDER_MODE: RenderMode =
  process.env.NODE_ENV === 'test' ? 'direct' : 'iframe';

export interface PersistedShellSession {
  tabs: import('@shenbi/editor-core').TabManagerSnapshot;
  expandedIds: string[];
  focusedId?: string | undefined;
}

export interface PreviewGitLabUser {
  id: number;
  username: string;
  avatarUrl: string;
  instanceUrl: string;
}

export interface PreviewGitLabAuthStatus {
  authenticated: boolean;
  user?: PreviewGitLabUser | undefined;
  defaultGroupId?: number | undefined;
  defaultInstanceUrl?: string | undefined;
}

export interface PreviewGitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  path_with_namespace: string;
  description: string | null;
  web_url: string;
  default_branch: string;
  last_activity_at: string;
}

export interface PreviewGitLabService {
  getAuthStatus: () => Promise<PreviewGitLabAuthStatus>;
  logout: () => Promise<void>;
  listBranches: (projectId: number) => Promise<string[]>;
  listGroupProjects: (groupId: number, search?: string) => Promise<PreviewGitLabProject[]>;
  selectProjectMetadata: (project: PreviewGitLabProject) => ActiveProjectConfig;
}

export interface PreviewServiceContainer {
  gitlab: PreviewGitLabService;
}

export interface PreviewProjectState {
  activeProjectConfig: ActiveProjectConfig | null;
  activeProjectId: string | null;
  isFirstLaunch: boolean;
  gitlabUser: { username: string; avatarUrl: string } | null;
  gitlabBranches: string[];
  consumePendingMigration: () => { sourceProjectId: string; targetProjectId: string } | null;
  handleBranchChange: (branch: string) => void;
  handleLogout: () => void;
  handleSelectProject: (config: ActiveProjectConfig) => void;
  handleSelectGitLabProject: (project: PreviewGitLabProject) => void;
  handleDeleteProject: (projectId: string) => void;
  handleUnbindProject: () => void;
}

export type PreviewWorkspaceState = WorkspaceHostState;

export type PreviewCanvasState = CanvasEditingState;

export interface PreviewGitLabSyncAdapter {
  activeProjectId?: number | undefined;
  activeBranch?: string | undefined;
  onSelectProject: (project: PreviewGitLabProject) => void;
  onUnbindProject?: (() => void) | undefined;
  projectName?: string | undefined;
  getLocalFiles: () => Promise<Map<string, string>>;
  writeLocalFile: (path: string, content: string) => Promise<void>;
  deleteLocalFile: (path: string) => Promise<void>;
  refreshFileTree: () => void;
}

export interface PreviewPluginFactoryContext {
  appMode: AppMode;
  project: PreviewProjectState;
  workspace: PreviewWorkspaceState;
  canvas: PreviewCanvasState;
  services: PreviewServiceContainer;
  commands: {
    executeAppCommand: (commandId: string, payload?: unknown) => Promise<unknown>;
  };
  translations: {
    previewT: (...args: any[]) => string;
    filesT: (...args: any[]) => string;
  };
  featureFlags: {
    shellMode: boolean;
    vfsInitialized: boolean;
    hasFilesPrimaryPanel: boolean;
  };
  adapters: {
    files: FilesHostAdapter & { ref?: { current: FilesHostAdapter } | undefined };
    gitlabSync: PreviewGitLabSyncAdapter;
  };
}

export type PreviewPluginRegistration =
  HostPluginRegistration<PreviewPluginFactoryContext, EditorPluginManifest>;

export interface PreviewScenarioState {
  initialScenarioSnapshots: Record<ScenarioKey, EditorStateSnapshot>;
  initialScenarioSchemas: Record<ScenarioKey, PageSchema>;
}
