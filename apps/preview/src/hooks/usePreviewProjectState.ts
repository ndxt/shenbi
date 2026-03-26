import { useCallback, useEffect, useRef, useState } from 'react';
import { createLocalProjectConfig } from '../constants';
import type { ActiveProjectConfig } from '../constants';
import {
  loadActiveProject,
  loadProjectList,
  saveActiveProject,
  upsertProjectInList,
} from '../project-registry';
import type {
  PreviewGitLabProject,
  PreviewGitLabService,
  PreviewProjectState,
} from '../preview-types';
import { navigateToProject } from './useProjectIdFromUrl';

interface UsePreviewProjectStateOptions {
  gitlabService: PreviewGitLabService;
  /** Project ID parsed from the URL path. When set, overrides stored state. */
  urlProjectId?: string | null;
}

export function usePreviewProjectState({
  gitlabService,
  urlProjectId,
}: UsePreviewProjectStateOptions): PreviewProjectState {
  const [activeProjectConfig, setActiveProjectConfig] = useState<ActiveProjectConfig | null>(null);
  const [projectLoaded, setProjectLoaded] = useState(false);
  const [gitlabUser, setGitlabUser] = useState<{ username: string; avatarUrl: string } | null>(null);
  const [gitlabBranches, setGitlabBranches] = useState<string[]>([]);
  const [authRefreshCounter, setAuthRefreshCounter] = useState(0);
  const pendingMigrationRef = useRef<{ sourceProjectId: string; targetProjectId: string } | null>(null);
  const activeProjectId = activeProjectConfig?.vfsProjectId ?? null;
  const isFirstLaunch = projectLoaded && activeProjectConfig === null;

  // Load initial project from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (urlProjectId) {
        const list = await loadProjectList();
        const match = list.find(
          (p) => (p.id ?? p.vfsProjectId) === urlProjectId,
        );
        if (match) {
          await saveActiveProject(match);
          if (!cancelled) {
            setActiveProjectConfig(match);
            setProjectLoaded(true);
          }
          return;
        }
      }
      const active = await loadActiveProject();
      if (!cancelled) {
        setActiveProjectConfig(active);
        setProjectLoaded(true);
      }
    }

    void resolve();

    return () => {
      cancelled = true;
    };
  // Only run on mount / when urlProjectId changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlProjectId]);

  // Listen for global auth changes (login/logout from popups or other tabs)
  useEffect(() => {
    const channel = new BroadcastChannel('gitlab-auth');
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'login-success' || event.data === 'logout-success') {
        setAuthRefreshCounter((c) => c + 1);
      }
    };
    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, []);

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
  }, [gitlabService, authRefreshCounter]);

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
    void saveActiveProject(updated);
    setActiveProjectConfig(updated);
  }, [activeProjectConfig]);

  const handleLogout = useCallback(() => {
    gitlabService.logout()
      .then(() => {
        setGitlabUser(null);
        setGitlabBranches([]);
        // Broadcast logout success
        const channel = new BroadcastChannel('gitlab-auth');
        channel.postMessage('logout-success');
        channel.close();
      })
      .catch(() => undefined);
  }, [gitlabService]);

  const handleSelectProject = useCallback((config: ActiveProjectConfig) => {
    const previousProjectId = activeProjectConfig?.vfsProjectId;
    void saveActiveProject(config);
    void upsertProjectInList(config);
    const nextProjectId = config.id ?? config.vfsProjectId;
    // When switching to a different project, navigate to its URL so the
    // editor/VFS/tab instances are cleanly re-created with the correct projectId.
    if (previousProjectId && previousProjectId !== config.vfsProjectId) {
      navigateToProject(nextProjectId);
      return;
    }
    // Always update local state so the UI reflects the selection immediately.
    setActiveProjectConfig(config);
    // For first project selection, also update the URL (causes a navigation/reload,
    // but state is already persisted to IndexedDB above).
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
    void saveActiveProject(updated);
    setActiveProjectConfig(updated);
    void upsertProjectInList(updated);
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
