import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createLocalProjectConfig,
  loadActiveProject,
  loadLastGitLabProject,
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

interface UsePreviewProjectStateOptions {
  gitlabService: PreviewGitLabService;
}

export function usePreviewProjectState({
  gitlabService,
}: UsePreviewProjectStateOptions): PreviewProjectState {
  const [activeProjectConfig, setActiveProjectConfig] = useState<ActiveProjectConfig>(
    () => loadActiveProject() ?? createLocalProjectConfig(),
  );
  const [lastGitLabProjectConfig, setLastGitLabProjectConfig] = useState<ActiveProjectConfig | null>(
    () => loadLastGitLabProject(),
  );
  const [gitlabUser, setGitlabUser] = useState<{ username: string; avatarUrl: string } | null>(null);
  const [gitlabBranches, setGitlabBranches] = useState<string[]>([]);
  const pendingMigrationRef = useRef<{ sourceProjectId: string; targetProjectId: string } | null>(null);
  const activeProjectId = activeProjectConfig.vfsProjectId;

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
    if (!activeProjectConfig.gitlabProjectId) {
      setGitlabBranches([]);
      return;
    }

    gitlabService.listBranches(activeProjectConfig.gitlabProjectId)
      .then(setGitlabBranches)
      .catch(() => setGitlabBranches([]));
  }, [activeProjectConfig.gitlabProjectId, gitlabService]);

  const handleBranchChange = useCallback((branch: string) => {
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
    saveActiveProject(config);
    upsertProjectInList(config);
    setActiveProjectConfig(config);
    if (config.gitlabProjectId) {
      saveLastGitLabProject(config);
      setLastGitLabProjectConfig(config);
    }
  }, []);

  const handleSelectGitLabProject = useCallback((project: PreviewGitLabProject) => {
    const nextConfig = gitlabService.selectProjectMetadata(project);
    const nextProjectId = nextConfig.vfsProjectId;
    if (activeProjectId !== nextProjectId) {
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
