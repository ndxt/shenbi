/**
 * GitLab REST API v4 adapter
 *
 * Wraps fetch calls to a GitLab instance.
 * Every public method requires an `accessToken` so the caller
 * (route handler) decides which user's credentials to use.
 */

import { logger } from './logger.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  avatar_url: string;
  web_url: string;
}

export interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  path: string;
  path_with_namespace: string;
  description: string | null;
  web_url: string;
  default_branch: string;
  created_at: string;
  last_activity_at: string;
  namespace: { id: number; name: string; path: string; kind: string };
}

export interface GitLabTreeItem {
  id: string;
  name: string;
  type: 'tree' | 'blob';
  path: string;
  mode: string;
}

export interface GitLabBranch {
  name: string;
  default: boolean;
  commit: { id: string; short_id: string; title: string; created_at: string };
}

export interface GitLabCommitAction {
  action: 'create' | 'update' | 'delete' | 'move';
  file_path: string;
  content?: string | undefined;
  previous_path?: string | undefined;
  encoding?: 'text' | 'base64' | undefined;
}

export interface GitLabCommitResult {
  id: string;
  short_id: string;
  title: string;
  message: string;
  web_url: string;
  created_at: string;
}

export interface GitLabFileContent {
  file_name: string;
  file_path: string;
  size: number;
  encoding: string;
  content: string;      // base64-encoded
  content_sha256: string;
  ref: string;
  blob_id: string;
  commit_id: string;
  last_commit_id: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface GitLabApiOptions {
  /** GitLab instance base URL, e.g. "https://gitlab.example.com" */
  instanceUrl: string;
  /** User's OAuth access token */
  accessToken: string;
}

class GitLabApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'GitLabApiError';
  }
}

async function gitlabFetch<T>(
  opts: GitLabApiOptions,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${opts.instanceUrl.replace(/\/+$/, '')}/api/v4${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.accessToken}`,
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text().catch(() => '');
    }
    logger.warn('gitlab.api.error', {
      status: response.status,
      path,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
    throw new GitLabApiError(response.status, body, `GitLab API ${response.status}: ${path}`);
  }
  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get the currently authenticated user. */
export async function getCurrentUser(opts: GitLabApiOptions): Promise<GitLabUser> {
  return gitlabFetch<GitLabUser>(opts, '/user');
}

/** List projects in a group. */
export async function listGroupProjects(
  opts: GitLabApiOptions,
  groupId: number | string,
  params?: { search?: string; per_page?: number; page?: number },
): Promise<GitLabProject[]> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  qs.set('per_page', String(params?.per_page ?? 50));
  qs.set('page', String(params?.page ?? 1));
  qs.set('order_by', 'last_activity_at');
  qs.set('sort', 'desc');
  qs.set('include_subgroups', 'false');
  return gitlabFetch<GitLabProject[]>(opts, `/groups/${encodeURIComponent(groupId)}/projects?${qs.toString()}`);
}

/** Create a project under a namespace (group). */
export async function createProject(
  opts: GitLabApiOptions,
  name: string,
  namespaceId: number,
  options?: { path?: string; description?: string; defaultBranch?: string; initializeWithReadme?: boolean },
): Promise<GitLabProject> {
  // GitLab requires an ASCII path — derive one from the name if not provided
  const projectPath = options?.path || sanitizePath(name);
  return gitlabFetch<GitLabProject>(opts, '/projects', {
    method: 'POST',
    body: JSON.stringify({
      name,
      path: projectPath,
      namespace_id: namespaceId,
      visibility: 'private',
      initialize_with_readme: options?.initializeWithReadme ?? true,
      ...(options?.description ? { description: options.description } : {}),
      ...(options?.defaultBranch ? { default_branch: options.defaultBranch } : {}),
    }),
  });
}

/**
 * Convert a potentially non-ASCII string to a valid GitLab project path.
 * GitLab path: only letters, digits, '_', '-', '.', cannot start with '-'.
 */
function sanitizePath(name: string): string {
  // Transliterate common patterns, strip everything else
  const slug = name
    .normalize('NFD')                        // decompose accented chars
    .replace(/[\u0300-\u036f]/g, '')         // strip combining marks
    .replace(/[^a-zA-Z0-9_\-.]+/g, '-')     // replace non-slug chars with dash
    .replace(/^-+|-+$/g, '')                 // trim leading/trailing dashes
    .replace(/-{2,}/g, '-')                  // collapse multiple dashes
    .toLowerCase();
  // Fallback: use timestamp-based name if nothing is left (e.g. all Chinese input)
  return slug || `project-${Date.now()}`;
}


/** Get a single project by ID. */
export async function getProject(
  opts: GitLabApiOptions,
  projectId: number | string,
): Promise<GitLabProject> {
  return gitlabFetch<GitLabProject>(opts, `/projects/${encodeURIComponent(projectId)}`);
}

/** List branches of a project. */
export async function listBranches(
  opts: GitLabApiOptions,
  projectId: number | string,
): Promise<GitLabBranch[]> {
  return gitlabFetch<GitLabBranch[]>(opts, `/projects/${encodeURIComponent(projectId)}/repository/branches?per_page=100`);
}

/** Get repository tree (file listing). */
export async function getTree(
  opts: GitLabApiOptions,
  projectId: number | string,
  params?: { path?: string; ref?: string; recursive?: boolean; per_page?: number },
): Promise<GitLabTreeItem[]> {
  const qs = new URLSearchParams();
  if (params?.path) qs.set('path', params.path);
  if (params?.ref) qs.set('ref', params.ref);
  if (params?.recursive) qs.set('recursive', 'true');
  qs.set('per_page', String(params?.per_page ?? 100));
  return gitlabFetch<GitLabTreeItem[]>(
    opts,
    `/projects/${encodeURIComponent(projectId)}/repository/tree?${qs.toString()}`,
  );
}

/** Read a single file from the repository. */
export async function getFile(
  opts: GitLabApiOptions,
  projectId: number | string,
  filePath: string,
  ref?: string,
): Promise<GitLabFileContent> {
  const qs = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  return gitlabFetch<GitLabFileContent>(
    opts,
    `/projects/${encodeURIComponent(projectId)}/repository/files/${encodeURIComponent(filePath)}${qs}`,
  );
}

/** Create a commit with multiple file actions. */
export async function createCommit(
  opts: GitLabApiOptions,
  projectId: number | string,
  branch: string,
  commitMessage: string,
  actions: GitLabCommitAction[],
): Promise<GitLabCommitResult> {
  return gitlabFetch<GitLabCommitResult>(
    opts,
    `/projects/${encodeURIComponent(projectId)}/repository/commits`,
    {
      method: 'POST',
      body: JSON.stringify({
        branch,
        commit_message: commitMessage,
        actions,
      }),
    },
  );
}
