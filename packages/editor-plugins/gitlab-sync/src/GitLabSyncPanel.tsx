/**
 * GitLab Sync Panel — VS Code Source Control style.
 *
 * Layout:
 *   Header: [Project · Branch]  [avatar username ⟩]
 *   Actions: [↻ Refresh] [↓ Pull]
 *   ─────────────────────────────
 *   Commit: [message input]
 *            [▲ Push (3)]
 *   ─────────────────────────────
 *   ▸ Changes (3)
 *     ☑ 待办看板           M
 *     ☑ 会议详情           A
 *     ☐ 旧页面             D
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LogIn,
  LogOut,
  GitBranch,
  FolderGit2,
  RefreshCw,
  Upload,
  Download,
  Plus,
  Check,
  AlertCircle,
  FilePlus2,
  FileEdit,
  FileX2,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Unlink2,
} from 'lucide-react';
import * as client from './gitlab-client';
import type { FileDiffItem } from './diff-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitLabSyncPanelProps {
  activeProjectId?: number | undefined;
  activeBranch?: string | undefined;
  onSelectProject?: ((project: client.GitLabProject) => void) | undefined;
  getLocalFiles: () => Promise<Map<string, string>>;
  writeLocalFile: (path: string, content: string) => Promise<void>;
  deleteLocalFile: (path: string) => Promise<void>;
  refreshFileTree: () => void;
  /** Called when user wants to unbind the GitLab remote from the current project */
  onUnbindProject?: (() => void) | undefined;
  /** Name of the active project (for display in not-logged-in state) */
  projectName?: string | undefined;
}

type PanelState =
  | { kind: 'loading' }
  | { kind: 'not-logged-in' }
  | { kind: 'project-picker'; user: client.GitLabUser; groupId: number }
  | { kind: 'synced'; user: client.GitLabUser; project: client.GitLabProject; branch: string }
  | { kind: 'error'; message: string };

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const KNOWN_EXTENSIONS = ['.page.json', '.api.json', '.flow.json', '.db.json', '.dict.json'];

function displayName(path: string): string {
  const fileName = path.split('/').pop() ?? path;
  for (const ext of KNOWN_EXTENSIONS) {
    if (fileName.endsWith(ext)) return fileName.slice(0, -ext.length);
  }
  return fileName;
}

function displayDir(path: string): string {
  const parts = path.split('/');
  if (parts.length <= 1) return '';
  parts.pop();
  return parts.join('/');
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const color = {
  bg: 'transparent',
  bgPanel: 'transparent',
  bgHover: 'var(--color-hover-bg)',
  bgInput: 'var(--color-active-bg)',
  border: 'var(--color-border-ide)',
  borderLight: 'var(--color-border-hover, var(--color-border-ide))',
  text: 'var(--color-text-primary)',
  textDim: 'var(--color-text-secondary)',
  textBright: 'var(--color-text-primary)',
  accent: 'var(--color-primary)',
  accentHover: 'var(--color-primary-hover)',
  green: '#4ade80',
  greenBg: 'var(--color-hover-bg)',
  yellow: '#facc15',
  yellowBg: 'var(--color-hover-bg)',
  red: 'var(--color-danger, #f87171)',
  redBg: 'transparent',
} as const;

const S = {
  panel: {
    display: 'flex', flexDirection: 'column' as const, height: '100%',
    fontSize: 13, color: color.text, background: color.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  // Header
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 12px', borderBottom: `1px solid ${color.border}`, background: color.bgPanel,
    minHeight: 36,
  },
  headerLeft: {
    display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1,
  },
  headerRight: {
    display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
  },
  projectLabel: {
    fontSize: 12, fontWeight: 600, color: color.textBright,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  },
  branchBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 3,
    fontSize: 11, color: color.textDim, background: color.bgInput,
    padding: '1px 6px', borderRadius: 3, flexShrink: 0,
  },
  avatar: { width: 20, height: 20, borderRadius: '50%' },
  userName: { fontSize: 11, color: color.textDim },
  // Action bar
  actionBar: {
    display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
    borderBottom: `1px solid ${color.border}`,
  },
  iconBtn: (active?: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: 4, borderRadius: 4, border: 'none', cursor: 'pointer',
    background: active ? color.bgHover : 'transparent', color: color.textDim,
    transition: 'all 0.15s',
  }),
  // Commit section
  commitSection: {
    padding: '8px 12px', borderBottom: `1px solid ${color.border}`,
  },
  commitInput: {
    width: '100%', padding: '6px 8px', borderRadius: 4,
    border: `1px solid ${color.borderLight}`, background: color.bgInput,
    color: color.text, fontSize: 12, outline: 'none', boxSizing: 'border-box' as const,
    resize: 'none' as const, fontFamily: 'inherit',
  },
  pushBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    width: '100%', padding: '6px 12px', borderRadius: 4,
    border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
    background: color.accent, color: '#fff', marginTop: 6,
    transition: 'background 0.15s',
  },
  // Changes section
  sectionHeader: {
    display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px',
    cursor: 'pointer', userSelect: 'none' as const, fontSize: 11, fontWeight: 600,
    textTransform: 'uppercase' as const, color: color.textDim,
    letterSpacing: '0.3px',
  },
  changesBadge: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 18, height: 18, borderRadius: 9, fontSize: 10, fontWeight: 600,
    background: color.accent, color: '#fff', marginLeft: 'auto',
  },
  fileRow: (isSelected: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, padding: '2px 12px 2px 24px',
    cursor: 'pointer', fontSize: 12,
    background: isSelected ? color.bgHover : 'transparent',
    transition: 'background 0.1s',
  }),
  statusLetter: (status: string): React.CSSProperties => ({
    width: 16, textAlign: 'center' as const, fontSize: 11, fontWeight: 700,
    color: status === 'added' ? color.green : status === 'modified' ? color.yellow : color.red,
    flexShrink: 0,
  }),
  empty: {
    padding: '24px 12px', textAlign: 'center' as const, color: color.textDim, fontSize: 12,
  },
  // Login / picker
  loginSection: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    justifyContent: 'center', flex: 1, gap: 12, padding: 24,
  },
  btn: (primary?: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
    borderRadius: 4, fontSize: 12, border: 'none', cursor: 'pointer',
    background: primary ? color.accent : color.bgInput, color: primary ? '#fff' : color.text,
    transition: 'background 0.15s',
  }),
  input: {
    width: '100%', padding: '5px 8px', borderRadius: 4,
    border: `1px solid ${color.borderLight}`, background: color.bgInput,
    color: color.text, fontSize: 12, outline: 'none', boxSizing: 'border-box' as const,
  },
  projectItem: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
    cursor: 'pointer', transition: 'background 0.1s', fontSize: 12,
  },
  progressBar: { height: 2, background: color.accent, transition: 'width 0.3s', borderRadius: 1 },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GitLabSyncPanel({
  activeProjectId,
  activeBranch,
  onSelectProject,
  getLocalFiles,
  writeLocalFile,
  deleteLocalFile,
  refreshFileTree,
  onUnbindProject,
  projectName,
}: GitLabSyncPanelProps) {
  const [state, setState] = useState<PanelState>({ kind: 'loading' });
  const [instanceUrl, setInstanceUrl] = useState('');
  const [projects, setProjects] = useState<client.GitLabProject[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [diffs, setDiffs] = useState<FileDiffItem[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [commitMessage, setCommitMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [changesExpanded, setChangesExpanded] = useState(true);
  const localFilesRef = useRef<Map<string, string>>(new Map());
  const autoRefreshedRef = useRef<string>('');

  // ── Initialize ──
  useEffect(() => {
    let cancelled = false;

    client.getAuthStatus()
      .then((status) => {
        if (cancelled) return;
        if (status.authenticated && status.user) {
          const user = status.user;
          if (activeProjectId) {
            client.getProject(activeProjectId).then((project) => {
              if (cancelled) return;
              setDiffs([]);
              setSelectedPaths(new Set());
              autoRefreshedRef.current = '';
              setState({
                kind: 'synced',
                user,
                project,
                branch: activeBranch ?? (project.default_branch || 'main'),
              });
            }).catch(() => {
              if (cancelled) return;
              setState({ kind: 'project-picker', user, groupId: status.defaultGroupId ?? 0 });
            });
            return;
          }
          setState({ kind: 'project-picker', user, groupId: status.defaultGroupId ?? 0 });
        } else {
          if (status.defaultInstanceUrl) {
            setInstanceUrl(status.defaultInstanceUrl);
          }
          setState({ kind: 'not-logged-in' });
        }
      })
      .catch(() => setState({ kind: 'not-logged-in' }));
    return () => {
      cancelled = true;
    };
  }, [activeBranch, activeProjectId]);

  // ── Load projects ──
  useEffect(() => {
    if (state.kind !== 'project-picker') return;
    if (!state.groupId) return;
    client.listGroupProjects(state.groupId, projectSearch || undefined)
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [state.kind, state.kind === 'project-picker' ? state.groupId : 0, projectSearch]);

  // ── Login / Logout ──
  const handleLogin = useCallback(() => {
    window.location.href = client.getLoginUrl(instanceUrl || undefined);
  }, [instanceUrl]);

  const handleLogout = useCallback(() => {
    client.logout().then(() => {
      setState({ kind: 'not-logged-in' });
    });
  }, []);

  // ── Select / Create project ──
  const handleSelectProject = useCallback((project: client.GitLabProject) => {
    if (state.kind !== 'project-picker') return;
    const branch = project.default_branch || 'main';
    onSelectProject?.(project);
    setState({ kind: 'synced', user: state.user, project, branch });
  }, [onSelectProject, state]);

  const handleCreateProject = useCallback(async () => {
    if (state.kind !== 'project-picker' || !newProjectName.trim()) return;
    setIsBusy(true);
    try {
      const project = await client.createProject(newProjectName.trim(), state.groupId);
      setShowCreateProject(false);
      setNewProjectName('');
      handleSelectProject(project);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsBusy(false);
    }
  }, [state, newProjectName, handleSelectProject]);

  // ── Diff (SHA-based) ──
  const handleRefreshDiff = useCallback(async () => {
    if (state.kind !== 'synced') return;
    setIsBusy(true);
    setStatusMsg('正在计算差异...');
    try {
      const localFiles = await getLocalFiles();
      localFilesRef.current = localFiles;
      const { computeLocalShas, computeDiffBySha, saveShaCache } = await import('./diff-utils');
      const localShas = await computeLocalShas(localFiles);
      const remoteTree = await client.getTree(state.project.id, state.branch);
      saveShaCache(state.project.id, state.branch, remoteTree);
      const diffResult = computeDiffBySha(localShas, remoteTree);
      setDiffs(diffResult);
      setSelectedPaths(new Set(diffResult.filter((d) => d.status !== 'deleted').map((d) => d.path)));
      setStatusMsg(diffResult.length === 0 ? '✓ 已同步' : '');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Diff failed');
    } finally {
      setIsBusy(false);
    }
  }, [state, getLocalFiles]);

  // ── Auto-refresh ──
  useEffect(() => {
    if (state.kind !== 'synced') return;
    const key = `${state.project.id}:${state.branch}`;
    if (autoRefreshedRef.current === key) return;
    autoRefreshedRef.current = key;
    const timer = setTimeout(() => void handleRefreshDiff(), 300);
    return () => clearTimeout(timer);
  }, [state.kind, state.kind === 'synced' ? state.project.id : 0, state.kind === 'synced' ? state.branch : '', handleRefreshDiff]);

  // ── Push ──
  const handlePush = useCallback(async () => {
    if (state.kind !== 'synced') return;
    if (!commitMessage.trim()) { setStatusMsg('请输入提交信息'); return; }
    const selectedDiffs = diffs.filter((d) => selectedPaths.has(d.path));
    if (selectedDiffs.length === 0) { setStatusMsg('没有选中的文件'); return; }
    setIsBusy(true);
    setStatusMsg('正在推送...');
    try {
      const { diffToCommitActions, clearShaCache } = await import('./diff-utils');
      const actions = diffToCommitActions(selectedDiffs, localFilesRef.current, true);
      const result = await client.pushCommit(state.project.id, state.branch, commitMessage.trim(), actions);
      setStatusMsg(`✓ ${result.short_id}`);
      setCommitMessage('');
      setDiffs([]);
      setSelectedPaths(new Set());
      clearShaCache();
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Push failed');
    } finally {
      setIsBusy(false);
    }
  }, [state, commitMessage, diffs, selectedPaths]);

  // ── Pull (incremental) ──
  const handlePull = useCallback(async () => {
    if (state.kind !== 'synced') return;
    setIsBusy(true);
    setStatusMsg('分析变更...');
    try {
      const { computeLocalShas, decodeBase64, runWithConcurrency, saveShaCache } = await import('./diff-utils');
      const localFiles = await getLocalFiles();
      const localShas = await computeLocalShas(localFiles);
      const remoteTree = await client.getTree(state.project.id, state.branch);
      const remoteBlobs = remoteTree.filter((item) => item.type === 'blob');
      const remotePaths = new Set(remoteBlobs.map((blob) => blob.path));
      const toDownload = remoteBlobs.filter((blob) => {
        const localSha = localShas.get(blob.path);
        return !localSha || localSha !== blob.id;
      });
      const toDelete = [...localShas.keys()].filter((path) => !remotePaths.has(path));
      if (toDownload.length === 0 && toDelete.length === 0) {
        setStatusMsg('✓ 已是最新');
        setDiffs([]);
        return;
      }
      const downloadTasks = toDownload.map((blob) => async () => {
        const file = await client.getFile(state.project.id, blob.path, state.branch);
        await writeLocalFile(blob.path, decodeBase64(file.content));
        return blob.path;
      });
      const deleteTasks = toDelete.map((path) => async () => {
        await deleteLocalFile(path);
        return path;
      });
      const totalTasks = downloadTasks.length + deleteTasks.length;
      if (downloadTasks.length > 0) {
        await runWithConcurrency(downloadTasks, 5, (completed, total) => {
          setStatusMsg(`拉取 ${completed}/${totalTasks || total}`);
        });
      }
      if (deleteTasks.length > 0) {
        await runWithConcurrency(deleteTasks, 5, (completed, total) => {
          setStatusMsg(`拉取 ${downloadTasks.length + completed}/${totalTasks || total}`);
        });
      }
      saveShaCache(state.project.id, state.branch, remoteTree);
      refreshFileTree();
      setStatusMsg(`✓ 已同步 ${toDownload.length} 个更新，删除 ${toDelete.length} 个文件`);
      setDiffs([]);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Pull failed');
    } finally {
      setIsBusy(false);
    }
  }, [state, deleteLocalFile, getLocalFiles, refreshFileTree, writeLocalFile]);

  // ── Toggles ──
  const togglePath = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedPaths.size === diffs.length) setSelectedPaths(new Set());
    else setSelectedPaths(new Set(diffs.map((d) => d.path)));
  }, [diffs, selectedPaths]);

  const handleChangeProject = useCallback(() => {
    if (state.kind !== 'synced') return;
    setState({ kind: 'project-picker', user: state.user, groupId: 0 });
    setDiffs([]);
    setSelectedPaths(new Set());
    client.getAuthStatus().then((status) => {
      if (status.authenticated && status.user) {
        setState({ kind: 'project-picker', user: status.user, groupId: status.defaultGroupId ?? 0 });
      }
    });
  }, [state]);

  // ────────────────────────── RENDER ──────────────────────────

  // Loading
  if (state.kind === 'loading') {
    return (
      <div style={S.panel}>
        <div style={S.empty}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /></div>
      </div>
    );
  }

  // Not logged in
  if (state.kind === 'not-logged-in') {
    return (
      <div style={S.panel}>
        <div style={S.loginSection}>
          <FolderGit2 size={28} style={{ color: color.accent }} />
          {activeProjectId && projectName ? (
            <>
              <div style={{ fontSize: 13, color: color.textBright, textAlign: 'center', fontWeight: 500 }}>
                {projectName}
              </div>
              <div style={{ fontSize: 11, color: color.textDim, textAlign: 'center' }}>
                已绑定 GitLab · 登录以同步
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: color.textDim, textAlign: 'center' }}>连接 GitLab 同步代码</div>
          )}
          <div style={{ width: '100%', maxWidth: 200 }}>
            <input
              style={{ ...S.input, marginBottom: 8 }}
              placeholder="GitLab URL"
              value={instanceUrl}
              onChange={(e) => setInstanceUrl(e.target.value)}
            />
            <button style={{ ...S.btn(true), width: '100%', justifyContent: 'center' }} onClick={handleLogin}>
              <LogIn size={14} /> 登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Project picker
  if (state.kind === 'project-picker') {
    return (
      <div style={S.panel}>
        <div style={S.header}>
          <div style={S.headerLeft}>
            <FolderGit2 size={14} style={{ color: color.accent }} />
            <span style={S.projectLabel}>选择项目</span>
          </div>
          <div style={S.headerRight}>
            <img src={state.user.avatarUrl} alt="" style={S.avatar} />
            <span style={S.userName}>{state.user.username}</span>
            <button style={S.iconBtn()} onClick={handleLogout} title="登出"><LogOut size={13} /></button>
          </div>
        </div>
        <div style={{ padding: '8px 12px' }}>
          <input
            style={{ ...S.input, marginBottom: 6 }}
            placeholder="搜索项目..."
            value={projectSearch}
            onChange={(e) => setProjectSearch(e.target.value)}
          />
          {!showCreateProject ? (
            <button
              style={{ ...S.btn(), width: '100%', justifyContent: 'center', marginBottom: 6 }}
              onClick={() => setShowCreateProject(true)}
            >
              <Plus size={13} /> 新建项目
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              <input
                style={{ ...S.input, flex: 1 }}
                placeholder="项目名称"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateProject(); }}
                autoFocus
              />
              <button style={S.btn(true)} onClick={() => void handleCreateProject()} disabled={isBusy}>
                <Check size={13} />
              </button>
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {projects.map((p) => (
            <div
              key={p.id}
              style={S.projectItem}
              onClick={() => handleSelectProject(p)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = color.bgHover; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              <FolderGit2 size={14} style={{ color: color.accent, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: color.textBright }}>{p.name}</div>
                <div style={{ fontSize: 10, color: color.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.path_with_namespace}</div>
              </div>
            </div>
          ))}
          {projects.length === 0 && <div style={S.empty}>没有找到项目</div>}
        </div>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div style={S.panel}>
        <div style={S.empty}><AlertCircle size={18} style={{ color: color.red }} /><div>{state.message}</div></div>
      </div>
    );
  }

  // ── Synced state ──
  const selectedCount = selectedPaths.size;
  const statusIcon = (status: string) => {
    switch (status) {
      case 'added': return <FilePlus2 size={14} style={{ color: color.green }} />;
      case 'modified': return <FileEdit size={14} style={{ color: color.yellow }} />;
      case 'deleted': return <FileX2 size={14} style={{ color: color.red }} />;
      default: return null;
    }
  };
  const statusLetter = (status: string) => status === 'added' ? 'A' : status === 'modified' ? 'M' : 'D';

  return (
    <div style={S.panel}>
      {/* ── Action bar: Refresh + Pull ── */}
      <div style={S.actionBar}>
        <button
          style={S.iconBtn()}
          onClick={() => void handleRefreshDiff()}
          disabled={isBusy}
          title="刷新差异"
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = color.textBright; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = color.textDim; }}
        >
          <RefreshCw size={14} />
        </button>
        <button
          style={S.iconBtn()}
          onClick={() => void handlePull()}
          disabled={isBusy}
          title="拉取远程变更"
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = color.textBright; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = color.textDim; }}
        >
          <Download size={14} />
        </button>
        {onUnbindProject && (
          <button
            style={S.iconBtn()}
            onClick={onUnbindProject}
            title="解绑 GitLab 远程仓库"
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = color.red; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = color.textDim; }}
          >
            <Unlink2 size={14} />
          </button>
        )}
        <div style={{ flex: 1 }} />
        {/* Status */}
        {(statusMsg || isBusy) && (
          <div style={{
            fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
            color: statusMsg.startsWith('✓') ? color.green : statusMsg.includes('失败') || statusMsg.includes('Failed') ? color.red : color.textDim,
          }}>
            {isBusy && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
            {statusMsg}
          </div>
        )}
      </div>

      {/* ── Commit section (only when there are changes) ── */}
      {diffs.length > 0 && (
        <div style={S.commitSection}>
          <textarea
            style={{ ...S.commitInput, minHeight: 30, maxHeight: 100 }}
            placeholder="提交信息 (Ctrl+Enter 推送)"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void handlePush(); } }}
            rows={1}
          />
          <button
            style={{
              ...S.pushBtn,
              opacity: !commitMessage.trim() || selectedCount === 0 ? 0.5 : 1,
              cursor: !commitMessage.trim() || selectedCount === 0 || isBusy ? 'not-allowed' : 'pointer',
            }}
            onClick={() => void handlePush()}
            disabled={isBusy || !commitMessage.trim() || selectedCount === 0}
          >
            <Upload size={13} />
            推送{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </button>
        </div>
      )}

      {/* ── Changes section ── */}
      {diffs.length > 0 && (
        <>
          <div
            style={S.sectionHeader}
            onClick={() => setChangesExpanded(!changesExpanded)}
          >
            {changesExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>变更</span>
            <span style={S.changesBadge}>{diffs.length}</span>
            <div style={{ flex: 1 }} />
            <button
              style={{ ...S.iconBtn(), padding: 2, fontSize: 10 }}
              onClick={(e) => { e.stopPropagation(); toggleAll(); }}
              title={selectedPaths.size === diffs.length ? '全不选' : '全选'}
            >
              {selectedPaths.size === diffs.length ? '✓ 全选' : '☐ 全选'}
            </button>
          </div>
          {changesExpanded && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {diffs.map((d) => {
                const dir = displayDir(d.path);
                return (
                  <div
                    key={d.path}
                    style={S.fileRow(selectedPaths.has(d.path))}
                    onClick={() => togglePath(d.path)}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = color.bgHover; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = selectedPaths.has(d.path) ? color.bgHover : 'transparent'; }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPaths.has(d.path)}
                      onChange={() => togglePath(d.path)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ accentColor: color.accent, margin: 0 }}
                    />
                    {statusIcon(d.status)}
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.path}>
                      {displayName(d.path)}
                    </span>
                    {dir && <span style={{ fontSize: 10, color: color.textDim, flexShrink: 0 }}>{dir}</span>}
                    <span style={S.statusLetter(d.status)}>{statusLetter(d.status)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {diffs.length === 0 && !isBusy && !statusMsg && (
        <div style={{ ...S.empty, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Check size={20} style={{ color: color.green }} />
          <span>暂无变更</span>
        </div>
      )}

      {diffs.length === 0 && !isBusy && statusMsg && (
        <div style={{ ...S.empty, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {statusMsg}
        </div>
      )}

      {/* Keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
