export const PREVIEW_WORKSPACE_ID = 'shenbi-preview-debug';
export const PREVIEW_PROJECT_ID = 'default';

// ---------------------------------------------------------------------------
// Multi-project support
// ---------------------------------------------------------------------------

/** Convert a GitLab project ID to a VFS project namespace. */
export function projectIdFromGitLab(gitlabProjectId: number): string {
  return `gitlab-${gitlabProjectId}`;
}

/** Persisted state for the currently active project. */
export interface ActiveProjectConfig {
  gitlabProjectId: number;
  vfsProjectId: string;
  projectName: string;
  branch: string;
  lastOpenedAt: number;
}

const ACTIVE_PROJECT_KEY = 'shenbi_active_project';

export function loadActiveProject(): ActiveProjectConfig | null {
  try {
    const raw = localStorage.getItem(ACTIVE_PROJECT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveProjectConfig;
  } catch {
    return null;
  }
}

export function saveActiveProject(config: ActiveProjectConfig): void {
  localStorage.setItem(ACTIVE_PROJECT_KEY, JSON.stringify(config));
}

export function clearActiveProject(): void {
  localStorage.removeItem(ACTIVE_PROJECT_KEY);
}
