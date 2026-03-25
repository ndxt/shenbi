/**
 * WelcomeScreen — shown on first launch when no project exists.
 * Uses semantic CSS variables for full Dark/Light/Cursor/WebStorm theme support.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  FilePlus2, FolderOpen, GitBranch, FolderGit2, Clock, ArrowRight, Check,
} from 'lucide-react';
import type { ActiveProjectConfig } from './constants';
import {
  createLocalProjectConfig,
  loadProjectList,
  upsertProjectInList,
} from './constants';
import type { PreviewGitLabService } from './preview-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WelcomeScreenProps {
  gitlabUser: { username: string; avatarUrl?: string } | null;
  gitlabService: PreviewGitLabService;
  onSelectProject: (config: ActiveProjectConfig) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActionCard({
  icon,
  title,
  disabled,
  disabledReason,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  disabled?: boolean;
  disabledReason?: string;
  active?: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={disabled ? disabledReason : undefined}
    >
      <div
        style={{
          width: 80,
          height: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 12,
          border: active
            ? '2px solid var(--color-primary)'
            : '2px solid transparent',
          background: active
            ? 'rgba(0,0,0,0.2)'
            : hovered && !disabled
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(255,255,255,0.04)',
          color: active ? 'var(--color-primary)' : 'var(--color-text-primary)',
          transition: 'all 0.15s',
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 13, color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: 500 }}>
        {title}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

type Mode = 'idle' | 'new' | 'open';

export function WelcomeScreen({ gitlabUser, gitlabService, onSelectProject }: WelcomeScreenProps) {
  const [mode, setMode] = useState<Mode>('idle');
  const [newName, setNewName] = useState('');
  const [projects, setProjects] = useState<ActiveProjectConfig[]>([]);
  const [authChecked, setAuthChecked] = useState(false);

  // Load recent projects
  useEffect(() => {
    const list = loadProjectList().sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
    setProjects(list);
  }, []);

  // Check GitLab auth for clone button
  useEffect(() => {
    gitlabService.getAuthStatus()
      .then(() => setAuthChecked(true))
      .catch(() => setAuthChecked(true));
  }, [gitlabService]);

  const canClone = !!gitlabUser;

  const handleCreate = useCallback(() => {
    const name = newName.trim() || '新建项目';
    const config = createLocalProjectConfig(name);
    upsertProjectInList(config);
    onSelectProject(config);
  }, [newName, onSelectProject]);

  const handleOpenProject = useCallback((config: ActiveProjectConfig) => {
    upsertProjectInList({ ...config, lastOpenedAt: Date.now() });
    onSelectProject(config);
  }, [onSelectProject]);

  const handleClone = useCallback(() => {
    // Open ProjectManagerDialog's clone tab by triggering an artificial open
    // We just reuse the dialog — dispatch a custom event that App.tsx can listen for
    window.dispatchEvent(new CustomEvent('shenbi:open-project-manager', { detail: { tab: 'clone' } }));
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(4px)',
        padding: 40,
        gap: 40,
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      {/* Container - no background, just layout */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 40,
          width: '100%',
          maxWidth: 580,
          color: 'var(--color-text-primary)',
        }}
      >
      {/* Logo + Title */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 12, color: '#FFFFFF' }}>
          Welcome to 神笔 IDE
        </div>
        <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          创建一个新项目以从头开始。<br/>
          从磁盘或版本控制中打开现有项目。
        </div>
      </div>

      {/* Action Cards */}
      <div style={{ display: 'flex', gap: 24, justifyContent: 'center', width: '100%', marginTop: 8 }}>
        <ActionCard
          icon={<FilePlus2 size={28} strokeWidth={1.5} />}
          title="New Project"
          active={mode === 'new'}
          onClick={() => setMode(mode === 'new' ? 'idle' : 'new')}
        />
        <ActionCard
          icon={<FolderOpen size={28} strokeWidth={1.5} />}
          title="Open"
          disabled={projects.length === 0}
          disabledReason="暂无历史项目，请先新建一个"
          active={mode === 'open'}
          onClick={() => setMode(mode === 'open' ? 'idle' : 'open')}
        />
        <ActionCard
          icon={<GitBranch size={28} strokeWidth={1.5} />}
          title="Clone Repository"
          disabled={!canClone}
          disabledReason="请先在设置中登录 GitLab"
          onClick={handleClone}
        />
      </div>

      {/* Inline: New Project Form */}
      {mode === 'new' && (
        <div
          style={{
            width: '100%',
            maxWidth: 400,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginTop: 16,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginLeft: 2 }}>
            项目名称
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              autoFocus
              type="text"
              placeholder="我的项目"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setMode('idle'); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--color-border-ide)',
                background: 'var(--color-bg-panel)',
                color: 'var(--color-text-primary)',
                fontSize: 14,
                outline: 'none',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--color-border-ide)'; }}
            />
            <button
              type="button"
              onClick={handleCreate}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', borderRadius: 6, border: 'none',
                background: 'var(--color-primary)', color: 'var(--color-text-inverse)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Check size={14} /> 创建
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            项目文件保存到浏览器 IndexedDB，可随时绑定 GitLab 远程仓库
          </div>
        </div>
      )}

      {/* Inline: Open Project List */}
      {mode === 'open' && projects.length > 0 && (
        <div
          style={{
            width: '100%',
            maxWidth: 480,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginTop: 16,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginLeft: 2, marginBottom: 4 }}>
            最近项目
          </div>
          {projects.slice(0, 8).map((p) => {
            const key = p.id ?? p.vfsProjectId;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleOpenProject(p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: '12px 16px',
                  background: 'rgba(255,255,255,0.03)', border: 'none',
                  borderRadius: 10,
                  cursor: 'pointer', textAlign: 'left',
                  color: 'var(--color-text-primary)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
              >
                <FolderGit2 size={16} style={{ color: p.gitlabProjectId ? 'var(--color-primary)' : 'var(--color-text-muted)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.projectName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={10} />
                    {timeAgo(p.lastOpenedAt)}
                    {p.gitlabProjectId && <span style={{ marginLeft: 6, color: 'var(--color-primary)' }}>GitLab</span>}
                  </div>
                </div>
                <ArrowRight size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
