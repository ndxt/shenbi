/**
 * ProjectManagerDialog — modal for managing projects.
 *
 * Features:
 * - View all local projects
 * - Create new local project
 * - Clone from GitLab (when logged in)
 * - Switch / delete projects
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  FolderGit2, Plus, Trash2, X, GitBranch,
  Search, Loader2, Check, FolderOpen, Download,
} from 'lucide-react';
import type { ActiveProjectConfig } from './constants';
import {
  loadProjectList,
  createLocalProjectConfig,
  upsertProjectInList,
  removeProjectFromList,
  projectIdFromGitLab,
} from './constants';

// ---------------------------------------------------------------------------
// Inline API helpers (avoid cross-package import)
// ---------------------------------------------------------------------------

interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  web_url: string;
  default_branch: string;
}

async function fetchAuthStatus(): Promise<{
  authenticated: boolean;
  defaultGroupId?: number;
}> {
  const res = await fetch(`${import.meta.env.BASE_URL}api/gitlab/oauth/status`, { credentials: 'include' });
  if (!res.ok) return { authenticated: false };
  return res.json();
}

async function fetchGroupProjects(groupId: number, search?: string): Promise<GitLabProject[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  const res = await fetch(`${import.meta.env.BASE_URL}api/gitlab/groups/${groupId}/projects${params}`, { credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const color = {
  bg: '#1a1a2e',
  card: '#16213e',
  bgInput: '#0f172a',
  border: '#1e3a5f',
  text: '#e0e0e0',
  textDim: '#6b7fa3',
  accent: '#00b4d8',
  accentGradient: 'linear-gradient(135deg, #0077b6, #00b4d8)',
};

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999,
  },
  dialog: {
    width: '100%', maxWidth: 520, maxHeight: '80vh', background: color.card,
    borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
    display: 'flex', flexDirection: 'column' as const, overflow: 'hidden',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: `1px solid ${color.border}`,
  },
  title: {
    fontSize: 16, fontWeight: 700, color: '#fff',
    display: 'flex', alignItems: 'center', gap: 8,
  },
  closeBtn: {
    background: 'none', border: 'none', color: color.textDim,
    cursor: 'pointer', padding: 4, borderRadius: 4,
    display: 'flex', alignItems: 'center',
  },
  body: { flex: 1, overflowY: 'auto' as const, padding: '12px 20px 20px' },
  sectionTitle: {
    fontSize: 11, fontWeight: 600, color: color.textDim,
    textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8,
  },
  projectItem: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
    borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s',
    border: '1px solid transparent', marginBottom: 4,
  },
  projectItemActive: {
    border: `1px solid ${color.accent}`, background: 'rgba(0,180,216,0.08)',
  },
  projectName: { fontSize: 13, fontWeight: 500, color: '#fff', flex: 1 },
  projectMeta: { fontSize: 11, color: color.textDim },
  badge: {
    fontSize: 10, padding: '2px 6px', borderRadius: 4,
    background: 'rgba(0,180,216,0.15)', color: color.accent, fontWeight: 600,
  },
  input: {
    width: '100%', padding: '8px 12px', borderRadius: 6,
    border: `1px solid ${color.border}`, background: color.bgInput,
    color: color.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const,
  },
  row: { display: 'flex', gap: 8, marginTop: 8 },
  btn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: '8px 16px', borderRadius: 6, fontSize: 12,
    fontWeight: 600, border: 'none', cursor: 'pointer', color: '#fff',
    background: color.accentGradient, transition: 'opacity 0.2s',
  },
  btnDanger: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: color.textDim, padding: 4, borderRadius: 4,
    display: 'flex', alignItems: 'center',
  },
  empty: {
    padding: '24px 16px', textAlign: 'center' as const, color: color.textDim, fontSize: 13,
  },
  tabs: {
    display: 'flex', gap: 0, borderBottom: `1px solid ${color.border}`, marginBottom: 12,
  },
  tab: {
    padding: '8px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
    color: color.textDim, borderBottom: '2px solid transparent',
    background: 'none', border: 'none', transition: 'color 0.15s',
  },
  tabActive: { color: color.accent, borderBottom: `2px solid ${color.accent}` },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Tab = 'projects' | 'create' | 'clone';

export interface ProjectManagerDialogProps {
  open: boolean;
  activeProjectId: string;
  gitlabUser: { username: string } | null;
  onClose: () => void;
  onSelectProject: (config: ActiveProjectConfig) => void;
  onDeleteProject: (projectId: string) => void;
}

export function ProjectManagerDialog({
  open, activeProjectId, gitlabUser,
  onClose, onSelectProject, onDeleteProject,
}: ProjectManagerDialogProps) {
  const [tab, setTab] = useState<Tab>('projects');
  const [projects, setProjects] = useState<ActiveProjectConfig[]>([]);
  const [newName, setNewName] = useState('');
  const [cloneSearch, setCloneSearch] = useState('');
  const [gitlabProjects, setGitlabProjects] = useState<GitLabProject[]>([]);
  const [cloning, setCloning] = useState<number | null>(null);
  const [authStatus, setAuthStatus] = useState<{ authenticated: boolean; defaultGroupId?: number } | null>(null);

  // Load project list
  useEffect(() => {
    if (!open) return;
    setProjects(loadProjectList());
  }, [open]);

  // Load GitLab auth for clone tab
  useEffect(() => {
    if (!open || tab !== 'clone') return;
    fetchAuthStatus().then(setAuthStatus).catch(() => setAuthStatus(null));
  }, [open, tab]);

  // Load GitLab projects
  useEffect(() => {
    if (!open || tab !== 'clone' || !authStatus?.authenticated || !authStatus.defaultGroupId) return;
    fetchGroupProjects(authStatus.defaultGroupId, cloneSearch || undefined)
      .then(setGitlabProjects)
      .catch(() => setGitlabProjects([]));
  }, [open, tab, authStatus?.authenticated, authStatus?.defaultGroupId, cloneSearch]);

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return;
    const config = createLocalProjectConfig(newName.trim());
    upsertProjectInList(config);
    onSelectProject(config);
    setNewName('');
    onClose();
  }, [newName, onSelectProject, onClose]);

  const handleClone = useCallback(async (project: GitLabProject) => {
    setCloning(project.id);
    try {
      const config: ActiveProjectConfig = {
        id: projectIdFromGitLab(project.id),
        gitlabProjectId: project.id,
        vfsProjectId: projectIdFromGitLab(project.id),
        projectName: project.name,
        branch: project.default_branch || 'main',
        createdAt: Date.now(),
        lastOpenedAt: Date.now(),
        gitlabUrl: project.web_url,
      };
      upsertProjectInList(config);
      onSelectProject(config);
      onClose();
    } finally {
      setCloning(null);
    }
  }, [onSelectProject, onClose]);

  const handleSelect = useCallback((project: ActiveProjectConfig) => {
    upsertProjectInList({ ...project, lastOpenedAt: Date.now() });
    onSelectProject(project);
    onClose();
  }, [onSelectProject, onClose]);

  const handleDelete = useCallback((e: React.MouseEvent, project: ActiveProjectConfig) => {
    e.stopPropagation();
    const key = project.id ?? project.vfsProjectId;
    if (key === activeProjectId) return;
    removeProjectFromList(key);
    onDeleteProject(key);
    setProjects(loadProjectList());
  }, [activeProjectId, onDeleteProject]);

  if (!open) return null;

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.dialog} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={S.header}>
          <div style={S.title}>
            <FolderOpen size={18} style={{ color: color.accent }} />
            项目管理
          </div>
          <button style={S.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div style={{ padding: '0 20px' }}>
          <div style={S.tabs}>
            <button style={{ ...S.tab, ...(tab === 'projects' ? S.tabActive : {}) }} onClick={() => setTab('projects')}>
              我的项目
            </button>
            <button style={{ ...S.tab, ...(tab === 'create' ? S.tabActive : {}) }} onClick={() => setTab('create')}>
              新建项目
            </button>
            <button style={{ ...S.tab, ...(tab === 'clone' ? S.tabActive : {}) }} onClick={() => setTab('clone')}>
              Clone
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={S.body}>
          {/* ── Projects tab ── */}
          {tab === 'projects' && (
            <div>
              {projects.length === 0 ? (
                <div style={S.empty}>还没有项目，创建一个或从 GitLab Clone</div>
              ) : (
                projects
                  .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
                  .map((p) => {
                    const key = p.id ?? p.vfsProjectId;
                    const isActive = key === activeProjectId || p.vfsProjectId === activeProjectId;
                    return (
                      <div
                        key={key}
                        style={{ ...S.projectItem, ...(isActive ? S.projectItemActive : {}) }}
                        onClick={() => handleSelect(p)}
                        onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                        onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <FolderGit2 size={16} style={{ color: p.gitlabProjectId ? color.accent : color.textDim, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={S.projectName}>{p.projectName}</div>
                          <div style={S.projectMeta}>
                            {p.gitlabProjectId ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <GitBranch size={10} /> {p.branch ?? 'main'}
                              </span>
                            ) : '本地项目'}
                          </div>
                        </div>
                        {p.gitlabProjectId && <span style={S.badge}>GitLab</span>}
                        {isActive && <span style={{ ...S.badge, background: 'rgba(46,204,113,0.15)', color: '#2ecc71' }}>当前</span>}
                        {!isActive && (
                          <button style={S.btnDanger} onClick={(e) => handleDelete(e, p)} title="删除项目">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          )}

          {/* ── Create tab ── */}
          {tab === 'create' && (
            <div style={{ marginBottom: 16 }}>
              <div style={S.sectionTitle}>新建本地项目</div>
              <input
                style={S.input}
                placeholder="输入项目名称..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                autoFocus
              />
              <div style={S.row}>
                <button style={S.btn} onClick={handleCreate} disabled={!newName.trim()}>
                  <Plus size={14} /> 创建项目
                </button>
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: color.textDim }}>
                创建后可在 GitLab 面板中绑定远程仓库进行同步
              </div>
            </div>
          )}

          {/* ── Clone tab ── */}
          {tab === 'clone' && (
            <div>
              {!authStatus?.authenticated ? (
                <div style={S.empty}>
                  {gitlabUser ? '正在检查登录状态...' : '请先在 GitLab 面板中登录'}
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, padding: '6px 10px', background: color.bgInput, borderRadius: 6, border: `1px solid ${color.border}`, alignItems: 'center' }}>
                    <Search size={14} style={{ color: color.textDim, flexShrink: 0 }} />
                    <input
                      style={{ ...S.input, border: 'none', padding: 0 }}
                      placeholder="搜索 GitLab 项目..."
                      value={cloneSearch}
                      onChange={(e) => setCloneSearch(e.target.value)}
                    />
                  </div>
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {gitlabProjects.map((p) => {
                      const alreadyCloned = projects.some((lp) => lp.gitlabProjectId === p.id);
                      return (
                        <div
                          key={p.id}
                          style={{ ...S.projectItem, opacity: alreadyCloned ? 0.5 : 1, cursor: alreadyCloned ? 'default' : 'pointer' }}
                          onClick={() => !alreadyCloned && handleClone(p)}
                          onMouseEnter={(e) => { if (!alreadyCloned) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                          <Download size={16} style={{ color: color.accent, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={S.projectName}>{p.name}</div>
                            <div style={S.projectMeta}>{p.path_with_namespace}</div>
                          </div>
                          {cloning === p.id && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                          {alreadyCloned && <span style={S.badge}>已 Clone</span>}
                          {!alreadyCloned && cloning !== p.id && <Check size={14} style={{ color: color.accent }} />}
                        </div>
                      );
                    })}
                    {gitlabProjects.length === 0 && (
                      <div style={S.empty}>{cloneSearch ? '未找到匹配项目' : '加载中...'}</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
