export const PREVIEW_WORKSPACE_ID = 'shenbi-preview-debug';
export const PREVIEW_PROJECT_ID = 'default';

// ---------------------------------------------------------------------------
// Multi-project support
// ---------------------------------------------------------------------------

/** Convert a GitLab project ID to a VFS project namespace. */
export function projectIdFromGitLab(gitlabProjectId: number): string {
  return `gitlab-${gitlabProjectId}`;
}

/** Persisted state for a project. */
export interface ActiveProjectConfig {
  id?: string | undefined;
  gitlabProjectId?: number | undefined;
  vfsProjectId: string;
  projectName: string;
  /** Chinese / user-friendly display name. Falls back to `projectName` if not set. */
  displayName?: string | undefined;
  branch?: string | undefined;
  createdAt?: number | undefined;
  lastOpenedAt: number;
  gitlabUrl?: string | undefined;
}

/** Return the best display name for the project (displayName > projectName). */
export function getProjectDisplayName(config: ActiveProjectConfig | null | undefined): string {
  if (!config) return '';
  return config.displayName || config.projectName || '';
}

let _localIdCounter = 0;
export function generateLocalProjectId(): string {
  _localIdCounter += 1;
  return `local-${Date.now()}-${_localIdCounter}`;
}

export function createLocalProjectConfig(name?: string): ActiveProjectConfig {
  const id = generateLocalProjectId();
  return {
    id,
    vfsProjectId: id,
    projectName: name ?? '新建项目',
    createdAt: Date.now(),
    lastOpenedAt: Date.now(),
  };
}
