/**
 * ProjectListPage — entry page for selecting/creating GitLab projects.
 *
 * Displayed when no project is active. Allows users to:
 * - See their GitLab Group projects
 * - Search and filter projects
 * - Create a new project
 * - Select a project to open in the editor
 */

import React, { useCallback, useEffect, useState } from 'react';
import { FolderGit2, Plus, Search, LogIn, Loader2, Check, ExternalLink } from 'lucide-react';
import type { ActiveProjectConfig } from './constants';
import { projectIdFromGitLab } from './constants';

// ---------------------------------------------------------------------------
// Types (inline to avoid importing gitlab-client directly from preview app)
// ---------------------------------------------------------------------------

interface GitLabAuthStatus {
  authenticated: boolean;
  user?: { id: number; username: string; avatarUrl: string; instanceUrl: string };
  defaultGroupId?: number;
}

interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  description: string | null;
  web_url: string;
  default_branch: string;
  last_activity_at: string;
}

// ---------------------------------------------------------------------------
// API helpers (fetch through backend proxy)
// ---------------------------------------------------------------------------

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api/gitlab${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return (await res.json()) as T;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/gitlab${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#1a1a2e',
    color: '#e0e0e0',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  card: {
    width: '100%',
    maxWidth: 520,
    background: '#16213e',
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    overflow: 'hidden' as const,
  },
  header: {
    padding: '32px 32px 20px',
    borderBottom: '1px solid #1a3a5c',
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    margin: 0,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7fa3',
    marginTop: 6,
  },
  body: {
    padding: '16px 24px 24px',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: '#0f172a',
    borderRadius: 8,
    border: '1px solid #1e3a5f',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#e0e0e0',
    fontSize: 13,
  },
  projectList: {
    maxHeight: 320,
    overflowY: 'auto' as const,
    borderRadius: 8,
    border: '1px solid #1e3a5f',
    background: '#0f172a',
  },
  projectItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'background 0.15s',
    borderBottom: '1px solid #1e2d4a',
  },
  projectName: {
    fontSize: 14,
    fontWeight: 500,
    color: '#fff',
  },
  projectPath: {
    fontSize: 11,
    color: '#6b7fa3',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  btn: (primary?: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 20px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    transition: 'all 0.2s',
    background: primary ? 'linear-gradient(135deg, #0077b6, #00b4d8)' : '#1e3a5f',
    color: '#fff',
  }),
  createRow: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
  },
  createInput: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #1e3a5f',
    background: '#0f172a',
    color: '#e0e0e0',
    fontSize: 13,
    outline: 'none',
  },
  empty: {
    padding: '32px 16px',
    textAlign: 'center' as const,
    color: '#6b7fa3',
    fontSize: 13,
  },
  loginBox: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 16,
    padding: '40px 32px',
  },
  spinner: {
    animation: 'spin 1s linear infinite',
  },
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ProjectListPageProps {
  onSelectProject: (config: ActiveProjectConfig) => void;
}

export function ProjectListPage({ onSelectProject }: ProjectListPageProps) {
  const [auth, setAuth] = useState<GitLabAuthStatus | null>(null);
  const [projects, setProjects] = useState<GitLabProject[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  // Check auth on mount
  useEffect(() => {
    apiGet<GitLabAuthStatus>('/oauth/status')
      .then((status) => {
        setAuth(status);
        setLoading(false);
      })
      .catch(() => {
        setAuth({ authenticated: false });
        setLoading(false);
      });
  }, []);

  // Load projects when authenticated
  useEffect(() => {
    if (!auth?.authenticated || !auth.defaultGroupId) return;
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    apiGet<GitLabProject[]>(`/groups/${auth.defaultGroupId}/projects${params}`)
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [auth?.authenticated, auth?.defaultGroupId, search]);

  const handleLogin = useCallback(() => {
    window.location.href = '/api/gitlab/oauth/login';
  }, []);

  const handleSelectProject = useCallback((project: GitLabProject) => {
    const config: ActiveProjectConfig = {
      gitlabProjectId: project.id,
      vfsProjectId: projectIdFromGitLab(project.id),
      projectName: project.name,
      branch: project.default_branch || 'main',
      lastOpenedAt: Date.now(),
      gitlabUrl: project.web_url,
    };
    onSelectProject(config);
  }, [onSelectProject]);

  const handleCreateProject = useCallback(async () => {
    if (!newName.trim() || !auth?.defaultGroupId) return;
    setCreating(true);
    try {
      const project = await apiPost<GitLabProject>('/projects', {
        name: newName.trim(),
        namespaceId: auth.defaultGroupId,
      });
      handleSelectProject(project);
    } catch {
      // Could show error, for now just stop spinner
    } finally {
      setCreating(false);
    }
  }, [newName, auth?.defaultGroupId, handleSelectProject]);

  // ── Loading ──
  if (loading) {
    return (
      <div style={styles.page}>
        <Loader2 size={32} style={styles.spinner} />
      </div>
    );
  }

  // ── Not logged in ──
  if (!auth?.authenticated) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.loginBox}>
            <FolderGit2 size={48} style={{ color: '#00b4d8' }} />
            <h2 style={{ ...styles.title, justifyContent: 'center' }}>Shenbi 工程管理</h2>
            <p style={{ ...styles.subtitle, textAlign: 'center', maxWidth: 300 }}>
              登录 GitLab 以访问你的工程
            </p>
            <button style={styles.btn(true)} onClick={handleLogin}>
              <LogIn size={16} /> 登录 GitLab
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Project list ──
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            <FolderGit2 size={22} style={{ color: '#00b4d8' }} />
            选择工程
          </h2>
          <p style={styles.subtitle}>
            以 {auth.user?.username} 身份登录 · 选择一个 GitLab 工程开始编辑
          </p>
        </div>

        <div style={styles.body}>
          {/* Search */}
          <div style={styles.searchBox}>
            <Search size={14} style={{ color: '#6b7fa3', flexShrink: 0 }} />
            <input
              style={styles.searchInput}
              placeholder="搜索工程..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Project list */}
          <div style={styles.projectList}>
            {projects.map((p) => (
              <div
                key={p.id}
                style={styles.projectItem}
                onClick={() => handleSelectProject(p)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#1e2d4a'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <FolderGit2 size={18} style={{ color: '#00b4d8', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.projectName}>{p.name}</div>
                  <div style={styles.projectPath}>{p.path_with_namespace}</div>
                </div>
                <a
                  href={p.web_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: '#6b7fa3', display: 'flex' }}
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            ))}
            {projects.length === 0 && (
              <div style={styles.empty}>
                {search ? '未找到匹配的工程' : '暂无工程'}
              </div>
            )}
          </div>

          {/* Create project */}
          {!showCreate ? (
            <div style={{ marginTop: 12 }}>
              <button style={styles.btn()} onClick={() => setShowCreate(true)}>
                <Plus size={14} /> 新建工程
              </button>
            </div>
          ) : (
            <div style={styles.createRow}>
              <input
                style={styles.createInput}
                placeholder="输入工程名称..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateProject(); }}
                autoFocus
              />
              <button
                style={{ ...styles.btn(true), width: 'auto', padding: '8px 16px' }}
                onClick={() => void handleCreateProject()}
                disabled={creating || !newName.trim()}
              >
                {creating ? <Loader2 size={14} style={styles.spinner} /> : <Check size={14} />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Keyframe for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
