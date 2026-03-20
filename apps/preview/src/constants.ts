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
  branch?: string | undefined;
  createdAt?: number | undefined;
  lastOpenedAt: number;
  gitlabUrl?: string | undefined;
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

// ---------------------------------------------------------------------------
// Active project (currently open)
// ---------------------------------------------------------------------------

const ACTIVE_PROJECT_KEY = 'shenbi_active_project';
const LAST_GITLAB_PROJECT_KEY = 'shenbi_last_gitlab_project';

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

export function loadLastGitLabProject(): ActiveProjectConfig | null {
  try {
    const raw = localStorage.getItem(LAST_GITLAB_PROJECT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveProjectConfig;
  } catch {
    return null;
  }
}

export function saveLastGitLabProject(config: ActiveProjectConfig): void {
  localStorage.setItem(LAST_GITLAB_PROJECT_KEY, JSON.stringify(config));
}

export function clearLastGitLabProject(): void {
  localStorage.removeItem(LAST_GITLAB_PROJECT_KEY);
}

// ---------------------------------------------------------------------------
// Project list (all local projects)
// ---------------------------------------------------------------------------

const PROJECTS_KEY = 'shenbi_projects';

export function loadProjectList(): ActiveProjectConfig[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ActiveProjectConfig[];
  } catch {
    return [];
  }
}

export function saveProjectList(projects: ActiveProjectConfig[]): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

/** Add or update a project in the list. */
export function upsertProjectInList(project: ActiveProjectConfig): void {
  const list = loadProjectList();
  const key = project.id ?? project.vfsProjectId;
  const idx = list.findIndex((p) => (p.id ?? p.vfsProjectId) === key);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...project, lastOpenedAt: Date.now() };
  } else {
    list.push({ ...project, lastOpenedAt: Date.now() });
  }
  saveProjectList(list);
}

/** Remove a project from the list. */
export function removeProjectFromList(projectId: string): void {
  const list = loadProjectList();
  saveProjectList(list.filter((p) => (p.id ?? p.vfsProjectId) !== projectId));
}
