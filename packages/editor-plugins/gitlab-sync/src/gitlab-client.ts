/**
 * Frontend GitLab API client.
 *
 * All requests go through the backend proxy at /api/gitlab/*
 * to avoid CORS and keep tokens on the server side.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitLabUser {
  id: number;
  username: string;
  avatarUrl: string;
  instanceUrl: string;
}

export interface GitLabAuthStatus {
  authenticated: boolean;
  user?: GitLabUser | undefined;
  defaultGroupId?: number | undefined;
}

export interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  path_with_namespace: string;
  description: string | null;
  web_url: string;
  default_branch: string;
  last_activity_at: string;
}

export interface GitLabTreeItem {
  id: string;
  name: string;
  type: 'tree' | 'blob';
  path: string;
}

export interface GitLabBranch {
  name: string;
  default: boolean;
}

export interface GitLabFileContent {
  file_path: string;
  content: string; // base64-encoded
  last_commit_id: string;
}

export interface CommitAction {
  action: 'create' | 'update' | 'delete';
  file_path: string;
  content?: string | undefined;
  encoding?: 'text' | 'base64' | undefined;
}

export interface CommitResult {
  id: string;
  short_id: string;
  title: string;
  message: string;
  web_url: string;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class GitLabClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GitLabClientError';
  }
}

// ---------------------------------------------------------------------------
// Client functions
// ---------------------------------------------------------------------------

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/gitlab${path}`, {
    credentials: 'include', // send session cookie
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!response.ok) {
    let msg = `GitLab API error: ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch { /* ignore */ }
    throw new GitLabClientError(response.status, msg);
  }
  return (await response.json()) as T;
}

// ── Auth ──

export function getAuthStatus(): Promise<GitLabAuthStatus> {
  return apiRequest<GitLabAuthStatus>('/oauth/status');
}

export function getLoginUrl(instanceUrl?: string): string {
  const params = instanceUrl ? `?instance=${encodeURIComponent(instanceUrl)}` : '';
  return `/api/gitlab/oauth/login${params}`;
}

export async function logout(): Promise<void> {
  await apiRequest<{ ok: boolean }>('/oauth/logout', { method: 'POST' });
}

// ── Groups & Projects ──

export function listGroupProjects(groupId: number, search?: string): Promise<GitLabProject[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiRequest<GitLabProject[]>(`/groups/${groupId}/projects${params}`);
}

export function createProject(name: string, namespaceId: number, description?: string): Promise<GitLabProject> {
  return apiRequest<GitLabProject>('/projects', {
    method: 'POST',
    body: JSON.stringify({ name, namespaceId, description }),
  });
}

export function getProject(projectId: number): Promise<GitLabProject> {
  return apiRequest<GitLabProject>(`/projects/${projectId}`);
}

// ── Repository ──

export function getTree(projectId: number, ref?: string, recursive = true): Promise<GitLabTreeItem[]> {
  const params = new URLSearchParams();
  if (ref) params.set('ref', ref);
  if (recursive) params.set('recursive', 'true');
  const qs = params.toString();
  return apiRequest<GitLabTreeItem[]>(`/projects/${projectId}/tree${qs ? `?${qs}` : ''}`);
}

export function getFile(projectId: number, filePath: string, ref?: string): Promise<GitLabFileContent> {
  const qs = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  return apiRequest<GitLabFileContent>(`/projects/${projectId}/files/${encodeURIComponent(filePath)}${qs}`);
}

export function pushCommit(
  projectId: number,
  branch: string,
  commitMessage: string,
  actions: CommitAction[],
): Promise<CommitResult> {
  return apiRequest<CommitResult>(`/projects/${projectId}/commits`, {
    method: 'POST',
    body: JSON.stringify({ branch, commitMessage, actions }),
  });
}

export function listBranches(projectId: number): Promise<GitLabBranch[]> {
  return apiRequest<GitLabBranch[]>(`/projects/${projectId}/branches`);
}
