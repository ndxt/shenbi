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
  Monitor, Smartphone, LayoutDashboard, FileText,
  BarChart3, Globe, ShoppingCart, BookOpen,
  MessageSquare, MapPin, Wallet, Activity,
  Camera, Gamepad2, Box, ArrowLeft,
} from 'lucide-react';
import type { ActiveProjectConfig } from './constants';
import {
  loadProjectList,
  createLocalProjectConfig,
  upsertProjectInList,
  removeProjectFromList,
} from './constants';
import type {
  PreviewGitLabProject,
  PreviewGitLabService,
} from './preview-types';

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
    width: '100%', maxWidth: 640, maxHeight: '85vh', background: color.card,
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
      { id: 'blank', name: '空白项目', description: '一个全新的空白画布，自由搭建您的页面', icon: Box, color: '#6b7280' },
      { id: 'admin', name: '管理系统', description: '企业级后台管理系统，包含布局框架、表单、表格等', icon: LayoutDashboard, color: '#3b82f6' },
      { id: 'cms', name: 'CMS 内容管理', description: '内容管理平台，支持文章、媒体、分类管理', icon: FileText, color: '#8b5cf6' },
      { id: 'dashboard', name: '数据大屏', description: '数据可视化大屏，支持图表、地图、实时数据展示', icon: BarChart3, color: '#10b981' },
      { id: 'portal', name: '门户网站', description: '企业官网或门户站点，响应式多页布局', icon: Globe, color: '#f59e0b' },
      { id: 'ecommerce', name: '电商商城', description: '在线购物平台，包含商品展示、购物车、订单流程', icon: ShoppingCart, color: '#ef4444' },
    ],
  },
  {
    id: 'mobile',
    name: '移动端',
    icon: Smartphone,
    templates: [
      { id: 'blank-mobile', name: '空白应用', description: '一个全新的空白手机画布，自由构建移动端页面', icon: Box, color: '#6b7280' },
      { id: 'news', name: '资讯阅读', description: '新闻、博客或阅读类应用，含文章列表、详情等', icon: BookOpen, color: '#3b82f6' },
      { id: 'social', name: '社交通讯', description: '即时通讯或社交应用，含消息列表、聊天界面', icon: MessageSquare, color: '#8b5cf6' },
      { id: 'lifestyle', name: '生活服务', description: '本地生活服务类应用，含地图、商家、订单等', icon: MapPin, color: '#10b981' },
      { id: 'finance', name: '金融理财', description: '移动端金融应用，含账户、交易、数据图表等', icon: Wallet, color: '#f59e0b' },
      { id: 'health', name: '健康运动', description: '运动健康类应用，含数据追踪、计划、统计', icon: Activity, color: '#ef4444' },
      { id: 'camera', name: '工具拍照', description: '图片编辑或拍照工具类应用，含滤镜、编辑', icon: Camera, color: '#ec4899' },
      { id: 'game', name: '休闲游戏', description: '轻量级小游戏或互动内容应用', icon: Gamepad2, color: '#14b8a6' },
    ],
  },
];

export interface ProjectManagerDialogProps {
  open: boolean;
  activeProjectId: string;
  gitlabUser: { username: string } | null;
  gitlabService: PreviewGitLabService;
  onClose: () => void;
  onSelectProject: (config: ActiveProjectConfig) => void;
  onDeleteProject: (projectId: string) => void;
}

export function ProjectManagerDialog({
  open, activeProjectId, gitlabUser,
  gitlabService,
  onClose, onSelectProject, onDeleteProject,
}: ProjectManagerDialogProps) {
  const [tab, setTab] = useState<Tab>('projects');
  const [projects, setProjects] = useState<ActiveProjectConfig[]>([]);
  const [newName, setNewName] = useState('');
  const [cloneSearch, setCloneSearch] = useState('');
  const [gitlabProjects, setGitlabProjects] = useState<PreviewGitLabProject[]>([]);
  const [cloning, setCloning] = useState<number | null>(null);
  const [authStatus, setAuthStatus] = useState<{ authenticated: boolean; defaultGroupId?: number } | null>(null);
  // Create tab state
  const [createStep, setCreateStep] = useState<CreateStep>('template');
  const [activeCategoryId, setActiveCategoryId] = useState(PROJECT_CATEGORIES[0].id);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const activeCategory = PROJECT_CATEGORIES.find((c) => c.id === activeCategoryId) ?? PROJECT_CATEGORIES[0];

  // Load project list
  useEffect(() => {
    if (!open) return;
    setProjects(loadProjectList());
  }, [open]);

  // Load GitLab auth for clone tab
  useEffect(() => {
    if (!open || tab !== 'clone') return;
    gitlabService.getAuthStatus()
      .then((status) => {
        setAuthStatus({
          authenticated: status.authenticated,
          ...(status.defaultGroupId ? { defaultGroupId: status.defaultGroupId } : {}),
        });
      })
      .catch(() => setAuthStatus(null));
  }, [gitlabService, open, tab]);

  // Load GitLab projects
  useEffect(() => {
    if (!open || tab !== 'clone' || !authStatus?.authenticated || !authStatus.defaultGroupId) return;
    gitlabService.listGroupProjects(authStatus.defaultGroupId, cloneSearch || undefined)
      .then(setGitlabProjects)
      .catch(() => setGitlabProjects([]));
  }, [authStatus?.authenticated, authStatus?.defaultGroupId, cloneSearch, gitlabService, open, tab]);

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return;
    const config = createLocalProjectConfig(newName.trim());
    upsertProjectInList(config);
    onSelectProject(config);
    setNewName('');
    setCreateStep('template');
    setSelectedTemplateId(null);
    onClose();
  }, [newName, onSelectProject, onClose]);

  const handleClone = useCallback(async (project: PreviewGitLabProject) => {
    setCloning(project.id);
    try {
      const config = gitlabService.selectProjectMetadata(project);
      upsertProjectInList(config);
      onSelectProject(config);
      onClose();
    } finally {
      setCloning(null);
    }
  }, [gitlabService, onClose, onSelectProject]);

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
            <div>
              {createStep === 'template' ? (
                /* ── Template selection ── */
                <div style={{ display: 'flex', gap: 0, minHeight: 340 }}>
                  {/* Category sidebar */}
                  <div style={{ width: 140, borderRight: `1px solid ${color.border}`, paddingRight: 12, flexShrink: 0 }}>
                    <div style={{ ...S.sectionTitle, marginBottom: 10 }}>项目类型</div>
                    {PROJECT_CATEGORIES.map((cat) => {
                      const isActive = cat.id === activeCategoryId;
                      const CatIcon = cat.icon;
                      return (
                        <div
                          key={cat.id}
                          onClick={() => { setActiveCategoryId(cat.id); setSelectedTemplateId(null); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                            marginBottom: 2, fontSize: 12, transition: 'all 0.15s',
                            background: isActive ? 'rgba(0,180,216,0.12)' : 'transparent',
                            color: isActive ? color.accent : color.textDim,
                            fontWeight: isActive ? 600 : 400,
                            borderLeft: isActive ? `3px solid ${color.accent}` : '3px solid transparent',
                          }}
                        >
                          <CatIcon size={14} />
                          <span>{cat.name}</span>
                          <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.5 }}>{cat.templates.length}</span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Template grid */}
                  <div style={{ flex: 1, paddingLeft: 16, overflowY: 'auto' }}>
                    <div style={{ ...S.sectionTitle, marginBottom: 4 }}>选择模板</div>
                    <div style={{ fontSize: 11, color: color.textDim, marginBottom: 12 }}>选择一个模板快速开始，后续可自由修改</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                      {activeCategory.templates.map((tpl) => {
                        const TplIcon = tpl.icon;
                        const isSelected = selectedTemplateId === tpl.id;
                        return (
                          <div
                            key={tpl.id}
                            onClick={() => setSelectedTemplateId(tpl.id)}
                            style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center',
                              padding: '14px 8px 10px', borderRadius: 10, cursor: 'pointer',
                              border: isSelected ? `2px solid ${color.accent}` : '2px solid transparent',
                              background: isSelected ? 'rgba(0,180,216,0.08)' : color.bgInput,
                              transition: 'all 0.15s', textAlign: 'center',
                            }}
                          >
                            <div style={{
                              width: 48, height: 48, borderRadius: 12, display: 'flex',
                              alignItems: 'center', justifyContent: 'center', marginBottom: 8,
                              background: `${tpl.color}18`,
                            }}>
                              <TplIcon size={22} strokeWidth={1.5} style={{ color: tpl.color }} />
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: isSelected ? color.accent : '#fff', lineHeight: 1.3 }}>{tpl.name}</div>
                            <div style={{ fontSize: 10, color: color.textDim, marginTop: 3, lineHeight: 1.4, maxWidth: 100, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{tpl.description}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Name input step ── */
                <div>
                  <button
                    onClick={() => setCreateStep('template')}
                    style={{ background: 'none', border: 'none', color: color.accent, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, marginBottom: 12, padding: 0 }}
                  >
                    <ArrowLeft size={14} /> 返回选择模板
                  </button>
                  <div style={{ ...S.sectionTitle, marginBottom: 4 }}>项目名称</div>
                  <div style={{ fontSize: 11, color: color.textDim, marginBottom: 8 }}>
                    模板: {activeCategory.templates.find((t) => t.id === selectedTemplateId)?.name}
                  </div>
                  <input
                    style={S.input}
                    placeholder="输入项目名称..."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                    autoFocus
                  />
                  <div style={{ marginTop: 12, fontSize: 12, color: color.textDim }}>
                    项目文件保存到浏览器 IndexedDB，可随时绑定 GitLab 远程仓库
                  </div>
                </div>
              )}

              {/* Footer row */}
              <div style={{ ...S.row, justifyContent: 'flex-end', marginTop: 16, borderTop: `1px solid ${color.border}`, paddingTop: 12 }}>
                {createStep === 'template' ? (
                  <button
                    style={{ ...S.btn, width: 'auto', opacity: selectedTemplateId ? 1 : 0.4, cursor: selectedTemplateId ? 'pointer' : 'not-allowed' }}
                    disabled={!selectedTemplateId}
                    onClick={() => setCreateStep('name')}
                  >
                    下一步
                  </button>
                ) : (
                  <button style={S.btn} onClick={handleCreate} disabled={!newName.trim()}>
                    <Check size={14} /> 创建项目
                  </button>
                )}
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
