/**
 * GitLab Sync Panel — main UI component for the sidebar.
 *
 * States: Not Logged In → Project Picker → Synced (diff/push/pull)
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
} from 'lucide-react';
import * as client from './gitlab-client';
import type { FileDiffItem } from './diff-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitLabSyncPanelProps {
  /** Read all local files: returns Map<path, jsonContent> */
  getLocalFiles: () => Promise<Map<string, string>>;
  /** Write files pulled from remote into VFS */
  writeLocalFile: (path: string, content: string) => Promise<void>;
  /** Delete a local VFS file */
  deleteLocalFile: (path: string) => Promise<void>;
  /** Refresh the file explorer tree after pull */
  refreshFileTree: () => void;
}

type PanelState =
  | { kind: 'loading' }
  | { kind: 'not-logged-in' }
  | { kind: 'project-picker'; user: client.GitLabUser; groupId: number }
  | { kind: 'synced'; user: client.GitLabUser; project: client.GitLabProject; branch: string }
  | { kind: 'error'; message: string };

// ---------------------------------------------------------------------------
// Styles (VS Code dark theme)
// ---------------------------------------------------------------------------

const S = {
  panel: { display: 'flex', flexDirection: 'column' as const, height: '100%', fontSize: 13, color: '#cccccc' },
  section: { padding: '12px 14px', borderBottom: '1px solid #2d2d2d' },
  sectionTitle: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, color: '#888', marginBottom: 8, letterSpacing: '0.5px' },
  btn: (primary?: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 4,
    fontSize: 12, border: 'none', cursor: 'pointer', transition: 'background 0.15s',
    background: primary ? '#007acc' : '#3c3c3c', color: primary ? '#fff' : '#ccc',
  }),
  btnFull: (primary?: boolean): React.CSSProperties => ({
    ...S.btn(primary), width: '100%', justifyContent: 'center',
  }),
  input: {
    width: '100%', padding: '5px 8px', borderRadius: 4, border: '1px solid #454545',
    background: '#1e1e1e', color: '#ccc', fontSize: 12, outline: 'none', boxSizing: 'border-box' as const,
  },
  label: { fontSize: 11, color: '#999', marginBottom: 4, display: 'block' },
  userRow: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid #2d2d2d',
  },
  avatar: { width: 24, height: 24, borderRadius: '50%' },
  diffRow: (isSelected: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, padding: '3px 14px', fontSize: 12,
    cursor: 'pointer', background: isSelected ? '#37373d' : 'transparent',
    transition: 'background 0.1s',
  }),
  badge: (status: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600,
    padding: '1px 6px', borderRadius: 3,
    background: status === 'added' ? '#1a3a2a' : status === 'modified' ? '#3a3520' : '#3a1a1a',
    color: status === 'added' ? '#4ade80' : status === 'modified' ? '#facc15' : '#f87171',
  }),
  projectItem: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: 'pointer',
    transition: 'background 0.1s', fontSize: 12,
  },
  empty: { padding: '20px 14px', textAlign: 'center' as const, color: '#666', fontSize: 12 },
  progressBar: { height: 2, background: '#007acc', transition: 'width 0.3s', borderRadius: 1 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Known file type extensions used by the Shenbi VFS. */
const KNOWN_EXTENSIONS = ['.page.json', '.api.json', '.flow.json', '.db.json', '.dict.json'];

/** Strip known VFS extensions for display (e.g. "系统看板.page.json" → "系统看板"). */
function displayName(path: string): string {
  const fileName = path.split('/').pop() ?? path;
  for (const ext of KNOWN_EXTENSIONS) {
    if (fileName.endsWith(ext)) {
      return fileName.slice(0, -ext.length);
    }
  }
  return fileName;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GitLabSyncPanel({
  getLocalFiles,
  writeLocalFile,
  deleteLocalFile,
  refreshFileTree,
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
  const [branches, setBranches] = useState<client.GitLabBranch[]>([]);
  const localFilesRef = useRef<Map<string, string>>(new Map());

  // ── Initialize: check auth status ──
  useEffect(() => {
    client.getAuthStatus()
      .then((status) => {
        if (status.authenticated && status.user) {
          // Try to restore saved project from localStorage
          const saved = localStorage.getItem('gitlab_sync_config');
          if (saved) {
            try {
              const config = JSON.parse(saved) as { projectId?: number; branch?: string };
              if (config.projectId) {
                client.getProject(config.projectId).then((project) => {
                  setState({ kind: 'synced', user: status.user!, project, branch: config.branch ?? project.default_branch });
                }).catch(() => {
                  setState({ kind: 'project-picker', user: status.user!, groupId: status.defaultGroupId ?? 0 });
                });
                return;
              }
            } catch { /* ignore */ }
          }
          setState({ kind: 'project-picker', user: status.user, groupId: status.defaultGroupId ?? 0 });
        } else {
          setState({ kind: 'not-logged-in' });
        }
      })
      .catch(() => setState({ kind: 'not-logged-in' }));
  }, []);

  // ── Load projects when in picker mode ──
  useEffect(() => {
    if (state.kind !== 'project-picker') return;
    if (!state.groupId) return;
    client.listGroupProjects(state.groupId, projectSearch || undefined)
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [state.kind, state.kind === 'project-picker' ? state.groupId : 0, projectSearch]);

  // ── Load branches when synced ──
  useEffect(() => {
    if (state.kind !== 'synced') return;
    client.listBranches(state.project.id)
      .then(setBranches)
      .catch(() => setBranches([]));
  }, [state.kind, state.kind === 'synced' ? state.project.id : 0]);


  // ── Login ──
  const handleLogin = useCallback(() => {
    const url = client.getLoginUrl(instanceUrl || undefined);
    window.location.href = url;
  }, [instanceUrl]);

  // ── Logout ──
  const handleLogout = useCallback(() => {
    client.logout().then(() => {
      localStorage.removeItem('gitlab_sync_config');
      setState({ kind: 'not-logged-in' });
    });
  }, []);

  // ── Select a project ──
  const handleSelectProject = useCallback((project: client.GitLabProject) => {
    if (state.kind !== 'project-picker') return;
    const branch = project.default_branch || 'main';
    localStorage.setItem('gitlab_sync_config', JSON.stringify({ projectId: project.id, branch }));
    setState({ kind: 'synced', user: state.user, project, branch });
  }, [state]);

  // ── Create a new project ──
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

  // ── Compute diff (SHA-based, no content download) ──
  const handleRefreshDiff = useCallback(async () => {
    if (state.kind !== 'synced') return;
    setIsBusy(true);
    setStatusMsg('正在计算差异...');
    try {
      const localFiles = await getLocalFiles();
      localFilesRef.current = localFiles;

      // 1. Compute local git blob SHAs (parallel, CPU only — fast)
      const { computeLocalShas, computeDiffBySha, saveShaCache } = await import('./diff-utils');
      setStatusMsg('计算本地文件指纹...');
      const localShas = await computeLocalShas(localFiles);

      // 2. Get remote tree (1 API call — contains SHA for every blob)
      setStatusMsg('获取远程文件树...');
      const remoteTree = await client.getTree(state.project.id, state.branch);

      // 3. Cache remote tree SHAs for future use
      saveShaCache(state.project.id, state.branch, remoteTree);

      // 4. Compare by SHA — zero content downloads!
      const diffResult = computeDiffBySha(localShas, remoteTree);
      setDiffs(diffResult);
      setSelectedPaths(new Set(diffResult.filter((d) => d.status !== 'deleted').map((d) => d.path)));
      setStatusMsg(diffResult.length === 0 ? '✓ 本地与远程一致' : `${diffResult.length} 个文件有差异`);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Diff failed');
    } finally {
      setIsBusy(false);
    }
  }, [state, getLocalFiles]);

  // ── Auto-refresh diff when entering synced state ──
  const autoRefreshedRef = useRef<string>('');
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
    if (!commitMessage.trim()) {
      setStatusMsg('请输入提交信息');
      return;
    }
    const selectedDiffs = diffs.filter((d) => selectedPaths.has(d.path));
    if (selectedDiffs.length === 0) {
      setStatusMsg('没有选中的文件');
      return;
    }

    setIsBusy(true);
    setStatusMsg('正在推送...');
    try {
      const { diffToCommitActions, clearShaCache } = await import('./diff-utils');
      const actions = diffToCommitActions(selectedDiffs, localFilesRef.current, true);
      const result = await client.pushCommit(state.project.id, state.branch, commitMessage.trim(), actions);
      setStatusMsg(`✓ 推送成功: ${result.short_id}`);
      setCommitMessage('');
      setDiffs([]);
      setSelectedPaths(new Set());
      // Invalidate SHA cache after push (remote tree changed)
      clearShaCache();
      localStorage.setItem('gitlab_sync_config', JSON.stringify({
        projectId: state.project.id,
        branch: state.branch,
        lastPushAt: Date.now(),
      }));
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Push failed');
    } finally {
      setIsBusy(false);
    }
  }, [state, commitMessage, diffs, selectedPaths]);

  // ── Pull (incremental + parallel) ──
  const handlePull = useCallback(async () => {
    if (state.kind !== 'synced') return;
    setIsBusy(true);
    setStatusMsg('正在分析变更...');
    try {
      const {
        computeLocalShas,
        decodeBase64,
        runWithConcurrency,
        saveShaCache,
        clearShaCache,
      } = await import('./diff-utils');

      // 1. Get local SHAs and remote tree
      const localFiles = await getLocalFiles();
      const localShas = await computeLocalShas(localFiles);
      const remoteTree = await client.getTree(state.project.id, state.branch);
      const remoteBlobs = remoteTree.filter((item) => item.type === 'blob');

      // 2. Find files that need downloading (SHA mismatch or new remote files)
      const toDownload = remoteBlobs.filter((blob) => {
        const localSha = localShas.get(blob.path);
        return !localSha || localSha !== blob.id;
      });

      if (toDownload.length === 0) {
        setStatusMsg('✓ 已是最新，无需拉取');
        setDiffs([]);
        setIsBusy(false);
        return;
      }

      setStatusMsg(`需要更新 ${toDownload.length} 个文件...`);

      // 3. Download changed files in parallel (concurrency = 5)
      const downloadTasks = toDownload.map((blob) => async () => {
        const file = await client.getFile(state.project.id, blob.path, state.branch);
        const content = decodeBase64(file.content);
        await writeLocalFile(blob.path, content);
        return blob.path;
      });

      await runWithConcurrency(downloadTasks, 5, (completed, total) => {
        setStatusMsg(`拉取中... ${completed}/${total}`);
      });

      // 4. Update SHA cache & refresh
      saveShaCache(state.project.id, state.branch, remoteTree);
      refreshFileTree();
      setStatusMsg(`✓ 拉取完成: ${toDownload.length} 个文件已更新`);
      setDiffs([]);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Pull failed');
    } finally {
      setIsBusy(false);
    }
  }, [state, getLocalFiles, writeLocalFile, refreshFileTree]);

  // ── Toggle diff selection ──
  const togglePath = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedPaths.size === diffs.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(diffs.map((d) => d.path)));
    }
  }, [diffs, selectedPaths]);

  // ── Change project ──
  const handleChangeProject = useCallback(() => {
    if (state.kind !== 'synced') return;
    setState({ kind: 'project-picker', user: state.user, groupId: 0 });
    setDiffs([]);
    setSelectedPaths(new Set());
    // Try to get groupId from auth status
    client.getAuthStatus().then((status) => {
      if (status.authenticated && status.user) {
        setState({ kind: 'project-picker', user: status.user, groupId: status.defaultGroupId ?? 0 });
      }
    });
  }, [state]);

  // ── Branch change ──
  const handleBranchChange = useCallback((branch: string) => {
    if (state.kind !== 'synced') return;
    setState({ ...state, branch });
    setDiffs([]);
    setSelectedPaths(new Set());
    localStorage.setItem('gitlab_sync_config', JSON.stringify({ projectId: state.project.id, branch }));
  }, [state]);

  // ── Render ──

  if (state.kind === 'loading') {
    return (
      <div style={S.panel}>
        <div style={S.empty}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
      </div>
    );
  }

  if (state.kind === 'not-logged-in') {
    return (
      <div style={S.panel}>
        <div style={S.section}>
          <div style={S.sectionTitle}>GitLab 连接</div>
          <div style={{ marginBottom: 8 }}>
            <label style={S.label}>GitLab 实例 URL (可选)</label>
            <input
              style={S.input}
              placeholder="https://gitlab.com"
              value={instanceUrl}
              onChange={(e) => setInstanceUrl(e.target.value)}
            />
          </div>
          <button style={S.btnFull(true)} onClick={handleLogin}>
            <LogIn size={14} /> 登录 GitLab
          </button>
        </div>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div style={S.panel}>
        <div style={S.empty}>
          <AlertCircle size={20} style={{ color: '#f87171', marginBottom: 8 }} />
          <div>{state.message}</div>
        </div>
      </div>
    );
  }

  if (state.kind === 'project-picker') {
    return (
      <div style={S.panel}>
        {/* User info */}
        <div style={S.userRow}>
          <img src={state.user.avatarUrl} alt="" style={S.avatar} />
          <span style={{ flex: 1, fontSize: 12 }}>{state.user.username}</span>
          <button style={S.btn()} onClick={handleLogout} title="登出"><LogOut size={13} /></button>
        </div>

        {/* Search / Create */}
        <div style={S.section}>
          <div style={S.sectionTitle}>选择项目</div>
          <input
            style={{ ...S.input, marginBottom: 8 }}
            placeholder="搜索项目..."
            value={projectSearch}
            onChange={(e) => setProjectSearch(e.target.value)}
          />

          {!showCreateProject ? (
            <button style={{ ...S.btn(), width: '100%', justifyContent: 'center', marginBottom: 8 }} onClick={() => setShowCreateProject(true)}>
              <Plus size={13} /> 新建项目
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
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

        {/* Project list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {projects.map((p) => (
            <div
              key={p.id}
              style={S.projectItem}
              onClick={() => handleSelectProject(p)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#2a2d2e'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              <FolderGit2 size={14} style={{ color: '#e8c17a', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: 10, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.path_with_namespace}
                </div>
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <div style={S.empty}>没有找到项目</div>
          )}
        </div>

        {statusMsg && (
          <div style={{ padding: '8px 14px', fontSize: 11, color: '#f87171', borderTop: '1px solid #2d2d2d' }}>
            {statusMsg}
          </div>
        )}
      </div>
    );
  }

  // ── Synced state ──
  const DiffIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'added': return <FilePlus2 size={13} style={{ color: '#4ade80' }} />;
      case 'modified': return <FileEdit size={13} style={{ color: '#facc15' }} />;
      case 'deleted': return <FileX2 size={13} style={{ color: '#f87171' }} />;
      default: return null;
    }
  };

  return (
    <div style={S.panel}>
      {/* User + project info */}
      <div style={S.userRow}>
        <img src={state.user.avatarUrl} alt="" style={S.avatar} />
        <span style={{ flex: 1, fontSize: 12 }}>{state.user.username}</span>
        <button style={S.btn()} onClick={handleLogout} title="登出"><LogOut size={13} /></button>
      </div>

      {/* Project / Branch */}
      <div style={S.section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <FolderGit2 size={14} style={{ color: '#e8c17a' }} />
          <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{state.project.name}</span>
          <button style={{ ...S.btn(), padding: '2px 6px', fontSize: 10 }} onClick={handleChangeProject}>切换</button>
          <a
            href={state.project.web_url}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#888', display: 'flex' }}
            title="在 GitLab 中打开"
          >
            <ExternalLink size={13} />
          </a>
        </div>
        {branches.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <GitBranch size={13} style={{ color: '#888' }} />
            <select
              style={{ ...S.input, flex: 1, cursor: 'pointer' }}
              value={state.branch}
              onChange={(e) => handleBranchChange(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b.name} value={b.name}>{b.name}{b.default ? ' (default)' : ''}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ ...S.section, display: 'flex', gap: 6 }}>
        <button style={S.btn()} onClick={() => void handleRefreshDiff()} disabled={isBusy} title="刷新差异">
          <RefreshCw size={13} /> 刷新
        </button>
        <button style={S.btn()} onClick={() => void handlePull()} disabled={isBusy} title="从 GitLab 拉取">
          <Download size={13} /> 拉取
        </button>
      </div>

      {/* Diff list */}
      {diffs.length > 0 && (
        <>
          <div style={{ ...S.section, paddingBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ ...S.sectionTitle, flex: 1, marginBottom: 0 }}>
              变更 ({diffs.length})
            </div>
            <button
              style={{ ...S.btn(), padding: '1px 6px', fontSize: 10 }}
              onClick={toggleAll}
            >
              {selectedPaths.size === diffs.length ? '全不选' : '全选'}
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {diffs.map((d) => (
              <div
                key={d.path}
                style={S.diffRow(selectedPaths.has(d.path))}
                onClick={() => togglePath(d.path)}
              >
                <input
                  type="checkbox"
                  checked={selectedPaths.has(d.path)}
                  onChange={() => togglePath(d.path)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ accentColor: '#007acc' }}
                />
                <DiffIcon status={d.status} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.path}>
                  {displayName(d.path)}
                </span>
                <span style={S.badge(d.status)}>
                  {d.status === 'added' ? '新增' : d.status === 'modified' ? '修改' : '删除'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {diffs.length === 0 && !isBusy && (
        <div style={{ ...S.empty, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          点击"刷新"查看变更
        </div>
      )}

      {/* Commit message + Push */}
      {diffs.length > 0 && (
        <div style={{ ...S.section, borderTop: '1px solid #2d2d2d', borderBottom: 'none' }}>
          <input
            style={{ ...S.input, marginBottom: 6 }}
            placeholder="提交信息..."
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handlePush(); } }}
          />
          <button
            style={S.btnFull(true)}
            onClick={() => void handlePush()}
            disabled={isBusy || !commitMessage.trim() || selectedPaths.size === 0}
          >
            <Upload size={14} /> 推送 ({selectedPaths.size} 个文件)
          </button>
        </div>
      )}

      {/* Status bar */}
      {(statusMsg || isBusy) && (
        <div style={{
          padding: '6px 14px', fontSize: 11, borderTop: '1px solid #2d2d2d',
          color: statusMsg.startsWith('✓') ? '#4ade80' : (statusMsg.includes('失败') || statusMsg.includes('Failed')) ? '#f87171' : '#999',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {isBusy && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
          {statusMsg}
        </div>
      )}
    </div>
  );
}
