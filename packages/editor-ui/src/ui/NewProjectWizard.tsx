import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Monitor,
  Smartphone,
  LayoutDashboard,
  FileText,
  BarChart3,
  Globe,
  ShoppingCart,
  BookOpen,
  MessageSquare,
  Gamepad2,
  Wallet,
  MapPin,
  Camera,
  Activity,
  Box,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  /** Optional color accent for the icon */
  color?: string;
}

export interface ProjectCategory {
  id: string;
  name: string;
  icon: React.ElementType;
  templates: ProjectTemplate[];
}

export interface NewProjectWizardProps {
  /** Whether the wizard dialog is open */
  open: boolean;
  /** Called when the user cancels or closes the wizard */
  onClose: () => void;
  /** Called when the user selects a template and proceeds */
  onCreateProject: (categoryId: string, templateId: string) => void;
  /** Optional custom categories — if not provided, built-in defaults are used */
  categories?: ProjectCategory[];
}

// ---------------------------------------------------------------------------
// Built-in default categories & templates
// ---------------------------------------------------------------------------

const DEFAULT_CATEGORIES: ProjectCategory[] = [
  {
    id: 'web',
    name: 'Web 端',
    icon: Monitor,
    templates: [
      {
        id: 'blank',
        name: '空白项目',
        description: '一个全新的空白画布，自由搭建您的页面',
        icon: Box,
        color: '#6b7280',
      },
      {
        id: 'admin',
        name: '管理系统',
        description: '企业级后台管理系统，包含布局框架、表单、表格等',
        icon: LayoutDashboard,
        color: '#3b82f6',
      },
      {
        id: 'cms',
        name: 'CMS 内容管理',
        description: '内容管理平台，支持文章、媒体、分类管理',
        icon: FileText,
        color: '#8b5cf6',
      },
      {
        id: 'dashboard',
        name: '数据大屏',
        description: '数据可视化大屏，支持图表、地图、实时数据展示',
        icon: BarChart3,
        color: '#10b981',
      },
      {
        id: 'portal',
        name: '门户网站',
        description: '企业官网或门户站点，响应式多页布局',
        icon: Globe,
        color: '#f59e0b',
      },
      {
        id: 'ecommerce',
        name: '电商商城',
        description: '在线购物平台，包含商品展示、购物车、订单流程',
        icon: ShoppingCart,
        color: '#ef4444',
      },
    ],
  },
  {
    id: 'mobile',
    name: '移动端',
    icon: Smartphone,
    templates: [
      {
        id: 'blank-mobile',
        name: '空白应用',
        description: '一个全新的空白手机画布，自由构建移动端页面',
        icon: Box,
        color: '#6b7280',
      },
      {
        id: 'news',
        name: '资讯阅读',
        description: '新闻、博客或阅读类应用，含文章列表、详情等',
        icon: BookOpen,
        color: '#3b82f6',
      },
      {
        id: 'social',
        name: '社交通讯',
        description: '即时通讯或社交应用，含消息列表、聊天界面',
        icon: MessageSquare,
        color: '#8b5cf6',
      },
      {
        id: 'lifestyle',
        name: '生活服务',
        description: '本地生活服务类应用，含地图、商家、订单等',
        icon: MapPin,
        color: '#10b981',
      },
      {
        id: 'finance',
        name: '金融理财',
        description: '移动端金融应用，含账户、交易、数据图表等',
        icon: Wallet,
        color: '#f59e0b',
      },
      {
        id: 'health',
        name: '健康运动',
        description: '运动健康类应用，含数据追踪、计划、统计',
        icon: Activity,
        color: '#ef4444',
      },
      {
        id: 'camera',
        name: '工具拍照',
        description: '图片编辑或拍照工具类应用，含滤镜、编辑',
        icon: Camera,
        color: '#ec4899',
      },
      {
        id: 'game',
        name: '休闲游戏',
        description: '轻量级小游戏或互动内容应用',
        icon: Gamepad2,
        color: '#14b8a6',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Template card component
// ---------------------------------------------------------------------------

function TemplateCard({
  template,
  selected,
  onClick,
}: {
  template: ProjectTemplate;
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = template.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        group relative flex flex-col items-center rounded-lg border-2 p-4 pb-3
        transition-all duration-200 cursor-pointer text-center
        ${selected
          ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_var(--color-primary)]'
          : 'border-transparent bg-[var(--bg-activity-bar)] hover:bg-[var(--hover-bg)] hover:border-[var(--border-ide)]'
        }
      `}
    >
      {/* Icon area */}
      <div
        className={`
          mb-3 flex h-16 w-16 items-center justify-center rounded-xl
          transition-transform duration-200 group-hover:scale-105
        `}
        style={{ backgroundColor: `${template.color ?? '#6b7280'}15` }}
      >
        <Icon
          size={28}
          strokeWidth={1.5}
          style={{ color: template.color ?? 'var(--color-text-secondary)' }}
        />
      </div>

      {/* Title */}
      <span className={`
        text-[12px] font-medium leading-tight
        ${selected ? 'text-primary' : 'text-[var(--text-primary)]'}
      `}>
        {template.name}
      </span>

      {/* Description */}
      <span className="mt-1 text-[10px] leading-snug text-[var(--text-secondary)] line-clamp-2 max-w-[120px]">
        {template.description}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Category sidebar item
// ---------------------------------------------------------------------------

function CategoryItem({
  category,
  active,
  onClick,
}: {
  category: ProjectCategory;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = category.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[12px]
        transition-colors cursor-pointer
        ${active
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
        }
      `}
    >
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-primary rounded-r" />
      )}
      <Icon size={16} strokeWidth={1.5} />
      <span>{category.name}</span>
      <span className="ml-auto text-[10px] opacity-60">{category.templates.length}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------

export function NewProjectWizard({
  open,
  onClose,
  onCreateProject,
  categories: customCategories,
}: NewProjectWizardProps) {
  const categories = customCategories ?? DEFAULT_CATEGORIES;
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? '');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const activeCategory = useMemo(
    () => categories.find((c) => c.id === activeCategoryId) ?? categories[0],
    [activeCategoryId, categories],
  );

  const handleCategorySwitch = useCallback((id: string) => {
    setActiveCategoryId(id);
    setSelectedTemplateId(null);
  }, []);

  const handleCreate = useCallback(() => {
    if (!selectedTemplateId || !activeCategory) return;
    onCreateProject(activeCategory.id, selectedTemplateId);
  }, [activeCategory, onCreateProject, selectedTemplateId]);

  // Reset state when re-opened
  React.useEffect(() => {
    if (open) {
      setActiveCategoryId(categories[0]?.id ?? '');
      setSelectedTemplateId(null);
    }
  }, [open, categories]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className="relative z-10 flex flex-col w-[740px] max-w-[90vw] h-[520px] max-h-[85vh]
          rounded-xl border border-[var(--border-ide)]
          bg-[var(--bg-panel)] shadow-2xl overflow-hidden
          animate-in fade-in zoom-in-95 duration-200"
      >
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between h-11 px-5 border-b border-[var(--border-ide)] shrink-0">
          <div className="flex items-center gap-2">
            <img
              src="/logo_light_128_transparent.png"
              alt=""
              className="w-5 h-5 object-contain"
            />
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">
              新建项目
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-6 h-6 rounded-md
              text-[var(--text-secondary)] hover:text-[var(--text-primary)]
              hover:bg-[var(--hover-bg)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* ─── Body ─── */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-[180px] shrink-0 border-r border-[var(--border-ide)] p-3 flex flex-col gap-0.5
            bg-[var(--bg-sidebar)] overflow-y-auto">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] opacity-60 px-3 mb-2">
              项目类型
            </div>
            {categories.map((cat) => (
              <CategoryItem
                key={cat.id}
                category={cat}
                active={cat.id === activeCategoryId}
                onClick={() => handleCategorySwitch(cat.id)}
              />
            ))}
          </div>

          {/* Template grid */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-4">
              <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">
                选择模板
              </h3>
              <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
                选择一个模板快速开始，后续可自由修改
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {activeCategory?.templates.map((tpl) => (
                <TemplateCard
                  key={tpl.id}
                  template={tpl}
                  selected={selectedTemplateId === tpl.id}
                  onClick={() => setSelectedTemplateId(tpl.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-ide)] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-7 rounded-md px-4 text-[12px] text-[var(--text-secondary)]
              hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!selectedTemplateId}
            className={`
              h-7 rounded-md px-5 text-[12px] font-medium transition-all
              ${selectedTemplateId
                ? 'bg-primary text-white hover:brightness-110 active:scale-[0.97]'
                : 'bg-[var(--bg-activity-bar)] text-[var(--text-secondary)] opacity-50 cursor-not-allowed'
              }
            `}
          >
            创建项目
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
