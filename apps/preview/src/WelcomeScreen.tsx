/**
 * WelcomeScreen — shown on first launch when no project exists.
 * Uses semantic CSS variables for full Dark/Light/Cursor/WebStorm theme support.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  FilePlus2, FolderOpen, GitBranch, FolderGit2, Clock, ArrowRight, Check,
  Monitor, Smartphone, LayoutDashboard, FileText,
  BarChart3, Globe, ShoppingCart, BookOpen,
  MessageSquare, MapPin, Wallet, Activity,
  Camera, Gamepad2, Box, ArrowLeft,
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
type CreateStep = 'template' | 'name';

// ---------------------------------------------------------------------------
// Built-in project templates
// ---------------------------------------------------------------------------

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

interface ProjectTypeCategory {
  id: string;
  name: string;
  icon: React.ElementType;
  templates: ProjectTemplate[];
}

const PROJECT_CATEGORIES: ProjectTypeCategory[] = [
  {
    id: 'web',
    name: 'Web 端',
    icon: Monitor,
    templates: [
      { id: 'blank', name: '空白项目', description: '全新空白画布，自由搭建页面', icon: Box, color: '#6b7280' },
      { id: 'admin', name: '管理系统', description: '后台管理系统，含布局、表单、表格', icon: LayoutDashboard, color: '#3b82f6' },
      { id: 'cms', name: 'CMS 内容管理', description: '文章、媒体、分类管理平台', icon: FileText, color: '#8b5cf6' },
      { id: 'dashboard', name: '数据大屏', description: '图表、地图、实时数据可视化', icon: BarChart3, color: '#10b981' },
      { id: 'portal', name: '门户网站', description: '企业官网，响应式多页布局', icon: Globe, color: '#f59e0b' },
      { id: 'ecommerce', name: '电商商城', description: '商品展示、购物车、订单流程', icon: ShoppingCart, color: '#ef4444' },
    ],
  },
  {
    id: 'mobile',
    name: '移动端',
    icon: Smartphone,
    templates: [
      { id: 'blank-mobile', name: '空白应用', description: '空白手机画布，自由构建移动页面', icon: Box, color: '#6b7280' },
      { id: 'news', name: '资讯阅读', description: '新闻、博客阅读类应用', icon: BookOpen, color: '#3b82f6' },
      { id: 'social', name: '社交通讯', description: '即时通讯、消息、聊天界面', icon: MessageSquare, color: '#8b5cf6' },
      { id: 'lifestyle', name: '生活服务', description: '地图、商家、订单服务应用', icon: MapPin, color: '#10b981' },
      { id: 'finance', name: '金融理财', description: '账户、交易、数据图表', icon: Wallet, color: '#f59e0b' },
      { id: 'health', name: '健康运动', description: '数据追踪、计划、统计应用', icon: Activity, color: '#ef4444' },
      { id: 'camera', name: '工具拍照', description: '图片编辑、滤镜工具应用', icon: Camera, color: '#ec4899' },
      { id: 'game', name: '休闲游戏', description: '轻量级小游戏或互动内容', icon: Gamepad2, color: '#14b8a6' },
    ],
  },
];

export function WelcomeScreen({ gitlabUser, gitlabService, onSelectProject }: WelcomeScreenProps) {
  const [mode, setMode] = useState<Mode>('idle');
  const [newName, setNewName] = useState('');
  const [projects, setProjects] = useState<ActiveProjectConfig[]>([]);
  const [authChecked, setAuthChecked] = useState(false);
  // Template wizard state
  const [createStep, setCreateStep] = useState<CreateStep>('template');
  const [activeCategoryId, setActiveCategoryId] = useState(PROJECT_CATEGORIES[0]?.id || 'web');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const activeCategory = (PROJECT_CATEGORIES.find((c) => c.id === activeCategoryId) || PROJECT_CATEGORIES[0]) as ProjectTypeCategory;

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
      {/* Dialog Wrapper */}
      <div
        style={{
          width: '100%',
          maxWidth: mode === 'new' ? 720 : 680,
          background: 'var(--color-bg-panel)',
          borderRadius: 12,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          border: '1px solid var(--color-border-ide)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'max-width 0.25s ease',
        }}
      >
        {/* Dialog Header */}
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--color-border-ide)', background: 'var(--color-header-bg, transparent)' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f56' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#27c93f' }} />
          </div>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
            {mode === 'new' ? 'New Project' : 'Welcome'}
          </div>
          <div style={{ width: 48 }} /> {/* spacer for balance */}
        </div>

        {/* Dynamic Content */}
        {mode === 'new' ? (
          /* =========================================================
             WIZARD TAKEOVER (Replaces Welcome Content)
             ========================================================= */
          <div style={{ display: 'flex', flexDirection: 'column', height: 480 }}>
            {createStep === 'template' ? (
              /* ── Step 1: Template selection ── */
              <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                {/* Category sidebar */}
                <div style={{ width: 140, borderRight: '1px solid var(--color-border-ide)', padding: '16px 0', flexShrink: 0, background: 'rgba(0,0,0,0.1)' }}>
                  {PROJECT_CATEGORIES.map((cat) => {
                    const isActive = cat.id === activeCategoryId;
                    return (
                      <div
                        key={cat.id}
                        onClick={() => { setActiveCategoryId(cat.id); setSelectedTemplateId(null); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '10px 16px', cursor: 'pointer',
                          fontSize: 13, transition: 'all 0.15s',
                          background: isActive ? 'var(--color-primary)' : 'transparent',
                          color: isActive ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                          fontWeight: isActive ? 600 : 400,
                        }}
                      >
                        <span>{cat.name}</span>
                      </div>
                    );
                  })}
                </div>
                {/* Template grid */}
                <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {activeCategory.templates.map((tpl) => {
                      const TplIcon = tpl.icon;
                      const isSelected = selectedTemplateId === tpl.id;
                      return (
                        <div
                          key={tpl.id}
                          onClick={() => setSelectedTemplateId(tpl.id)}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            padding: '24px 12px 16px', borderRadius: 8, cursor: 'pointer',
                            border: isSelected ? '2px solid var(--color-primary)' : '2px solid transparent',
                            background: isSelected ? 'rgba(var(--color-primary-rgb, 59,130,246), 0.1)' : 'var(--color-bg-overlay)',
                            transition: 'all 0.15s', textAlign: 'center',
                          }}
                        >
                          <div style={{
                            width: 56, height: 56, borderRadius: 12, display: 'flex',
                            alignItems: 'center', justifyContent: 'center', marginBottom: 12,
                            background: `${tpl.color}15`,
                          }}>
                            <TplIcon size={28} strokeWidth={1.5} style={{ color: tpl.color }} />
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>{tpl.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, lineHeight: 1.4, WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{tpl.description}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* ── Step 2: Name input ── */
              <div style={{ flex: 1, padding: 40, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>
                  配置项目
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 32 }}>
                  选择了模板: <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{activeCategory.templates.find((t) => t.id === selectedTemplateId)?.name}</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>项目名称</label>
                  <input
                    autoFocus
                    type="text"
                    placeholder="我的项目"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreateStep('template'); }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 6,
                      border: '1px solid var(--color-border-ide)',
                      background: 'var(--color-bg-base)',
                      color: 'var(--color-text-primary)',
                      fontSize: 14,
                      outline: 'none',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--color-border-ide)'; }}
                  />
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    项目文件保存到本地浏览器，后续可绑定 GitLab。
                  </div>
                </div>
              </div>
            )}

            {/* Wizard Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 24px', borderTop: '1px solid var(--color-border-ide)', background: 'var(--color-bg-overlay)' }}>
              {createStep === 'template' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setMode('idle')}
                    style={{
                      padding: '8px 20px', borderRadius: 6, border: '1px solid var(--color-border-ide)',
                      background: 'transparent', color: 'var(--color-text-secondary)',
                      fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    }}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={!selectedTemplateId}
                    onClick={() => setCreateStep('name')}
                    style={{
                      padding: '8px 20px', borderRadius: 6, border: 'none',
                      background: 'var(--color-primary)', color: 'var(--color-text-inverse)',
                      fontSize: 13, fontWeight: 600,
                      cursor: selectedTemplateId ? 'pointer' : 'not-allowed',
                      opacity: selectedTemplateId ? 1 : 0.4,
                    }}
                  >
                    下一步
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setCreateStep('template')}
                    style={{
                      padding: '8px 20px', borderRadius: 6, border: '1px solid var(--color-border-ide)',
                      background: 'transparent', color: 'var(--color-text-secondary)',
                      fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    }}
                  >
                    上一步
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!newName.trim()}
                    style={{
                      padding: '8px 24px', borderRadius: 6, border: 'none',
                      background: 'var(--color-primary)', color: 'var(--color-text-inverse)',
                      fontSize: 13, fontWeight: 600,
                      cursor: newName.trim() ? 'pointer' : 'not-allowed',
                      opacity: newName.trim() ? 1 : 0.4,
                    }}
                  >
                    创建
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          /* =========================================================
             WELCOME SCREEN IDLE / OPEN
             ========================================================= */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 40,
              width: '100%',
              padding: '40px 40px 48px',
              color: 'var(--color-text-primary)',
            }}
          >
        {/* Logo + Title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 12, color: 'var(--color-text-primary)' }}>
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
          active={false}
          onClick={() => {
            setMode('new');
            setCreateStep('template');
            setSelectedTemplateId(null);
          }}
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
        )}
      </div>
    </div>
  );
}
