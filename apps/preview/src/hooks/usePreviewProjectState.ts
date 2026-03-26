import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createLocalProjectConfig,
  loadActiveProject,
  loadLastGitLabProject,
  loadProjectList,
  saveActiveProject,
  saveLastGitLabProject,
  upsertProjectInList,
} from '../constants';
import type { ActiveProjectConfig } from '../constants';
import type {
  PreviewGitLabProject,
  PreviewGitLabService,
  PreviewProjectState,
} from '../preview-types';
import { navigateToProject } from './useProjectIdFromUrl';

interface UsePreviewProjectStateOptions {
  gitlabService: PreviewGitLabService;
  /** Project ID parsed from the URL path. When set, overrides localStorage. */
  urlProjectId?: string | null;
}

/**
 * Resolve the initial active project config.
 *
 * Priority:
 *   1. URL project ID → look up in project list
 *   2. localStorage active project
 *   3. null (first launch)
 */
function resolveInitialProject(urlProjectId: string | null | undefined): ActiveProjectConfig | null {
  if (urlProjectId) {
    const list = loadProjectList();
    const match = list.find(
      (p) => (p.id ?? p.vfsProjectId) === urlProjectId,
    );
    if (match) {
      // Also persist as active project so the rest of the system is consistent
      saveActiveProject(match);
      return match;
    }
    // URL has a project ID but it doesn't match any known project – fall through
  }
  return loadActiveProject() ?? null;
}

export function usePreviewProjectState({
  gitlabService,
  urlProjectId,
}: UsePreviewProjectStateOptions): PreviewProjectState {
  const [activeProjectConfig, setActiveProjectConfig] = useState<ActiveProjectConfig | null>(
    () => resolveInitialProject(urlProjectId),
  );
  const [lastGitLabProjectConfig, setLastGitLabProjectConfig] = useState<ActiveProjectConfig | null>(
    () => loadLastGitLabProject(),
  );
  const [gitlabUser, setGitlabUser] = useState<{ username: string; avatarUrl: string } | null>(null);
  const [gitlabBranches, setGitlabBranches] = useState<string[]>([]);
  const pendingMigrationRef = useRef<{ sourceProjectId: string; targetProjectId: string } | null>(null);
  const activeProjectId = activeProjectConfig?.vfsProjectId ?? null;
  const isFirstLaunch = activeProjectConfig === null;

  useEffect(() => {
    gitlabService.getAuthStatus()
      .then((status) => {
        if (status.authenticated && status.user) {
          setGitlabUser({
            username: status.user.username,
            avatarUrl: status.user.avatarUrl,
          });
        }
      })
      .catch(() => undefined);
  }, [gitlabService]);

  useEffect(() => {
    if (!activeProjectConfig?.gitlabProjectId) {
      setGitlabBranches([]);
      return;
    }

    gitlabService.listBranches(activeProjectConfig.gitlabProjectId)
      .then(setGitlabBranches)
      .catch(() => setGitlabBranches([]));
  }, [activeProjectConfig?.gitlabProjectId, gitlabService]);

  const handleBranchChange = useCallback((branch: string) => {
    if (!activeProjectConfig) return;
    const updated = { ...activeProjectConfig, branch };
    saveActiveProject(updated);
    setActiveProjectConfig(updated);
  }, [activeProjectConfig]);

  const handleLogout = useCallback(() => {
    gitlabService.logout()
      .then(() => {
        setGitlabUser(null);
        setGitlabBranches([]);
      })
      .catch(() => undefined);
  }, [gitlabService]);

  const handleSelectProject = useCallback((config: ActiveProjectConfig) => {
    const previousProjectId = activeProjectConfig?.vfsProjectId;
    saveActiveProject(config);
    upsertProjectInList(config);
    if (config.gitlabProjectId) {
      saveLastGitLabProject(config);
    }
    const nextProjectId = config.id ?? config.vfsProjectId;
    // When switching to a different project, navigate to its URL so the
    // editor/VFS/tab instances are cleanly re-created with the correct projectId.
    if (previousProjectId && previousProjectId !== config.vfsProjectId) {
      navigateToProject(nextProjectId);
      return;
    }
    // Always update local state so the UI reflects the selection immediately.
    setActiveProjectConfig(config);
    if (config.gitlabProjectId) {
      setLastGitLabProjectConfig(config);
    }
    // For first project selection, also update the URL (causes a navigation/reload,
    // but state is already persisted to localStorage above).
    if (!previousProjectId) {
      navigateToProject(nextProjectId);
    }
  }, [activeProjectConfig?.vfsProjectId]);

  const handleSelectGitLabProject = useCallback((project: PreviewGitLabProject) => {
    const nextConfig = gitlabService.selectProjectMetadata(project);
    const nextProjectId = nextConfig.vfsProjectId;
    if (activeProjectId !== null && activeProjectId !== nextProjectId) {
      pendingMigrationRef.current = {
        sourceProjectId: activeProjectId,
        targetProjectId: nextProjectId,
      };
    }

    handleSelectProject(nextConfig);
  }, [activeProjectId, gitlabService, handleSelectProject]);

  const handleDeleteProject = useCallback((projectId: string) => {
    try {
      indexedDB.deleteDatabase(`shenbi-vfs-${projectId}`);
    } catch {
      // Ignore deletion failures from the browser environment.
    }
  }, []);

  const handleUnbindProject = useCallback(() => {
    if (!activeProjectConfig) return;
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

  const consumePendingMigration = useCallback(() => {
    const migration = pendingMigrationRef.current;
    if (!migration || migration.targetProjectId !== activeProjectId) {
      return null;
    }
    pendingMigrationRef.current = null;
    return migration;
  }, [activeProjectId]);

  return {
    activeProjectConfig,
    lastGitLabProjectConfig,
    activeProjectId,
    isFirstLaunch,
    gitlabUser,
    gitlabBranches,
    consumePendingMigration,
    handleBranchChange,
    handleLogout,
    handleSelectProject,
    handleSelectGitLabProject,
    handleDeleteProject,
    handleUnbindProject,
  };
}
