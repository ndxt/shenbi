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
  Search, Loader2, Download,
} from 'lucide-react';
import { useTranslation } from '@shenbi/i18n';
import type { ActiveProjectConfig } from './constants';
import { createLocalProjectConfig } from './constants';
import { loadProjectList, upsertProjectInList } from './project-registry';
import type { PreviewGitLabService, PreviewGitLabProject, PreviewGitLabAuthStatus } from './preview-types';
import { getLoginUrl } from '../../../packages/editor-plugins/gitlab-sync/src/gitlab-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WelcomeScreenProps {
  gitlabUser: { username: string; avatarUrl?: string } | null;
  gitlabService: PreviewGitLabService;
  onSelectProject: (config: ActiveProjectConfig) => void;
  /** Start in a specific mode (e.g. 'clone') */
  initialMode?: Mode | undefined;
  /** Called when user dismisses the overlay (only for non-first-launch usage) */
  onClose?: (() => void) | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(ts: number, t: any): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return t('welcome.timeAgo.justNow');
  if (diff < 3600) return t('welcome.timeAgo.minutesAgo', { count: Math.floor(diff / 60) });
  if (diff < 86400) return t('welcome.timeAgo.hoursAgo', { count: Math.floor(diff / 3600) });
  return t('welcome.timeAgo.daysAgo', { count: Math.floor(diff / 86400) });
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
        paddingTop: 24, // Fixed top spacing for icon alignment
        paddingLeft: 12,
        paddingRight: 12,
        width: 132,
        height: 114, // Fixed height to accommodate 2-line wraps perfectly
        borderRadius: 16,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        
        // Ultra-minimalist styling
        background: active || (hovered && !disabled)
          ? 'var(--color-primary-bg)' // Faint transparent light blue background
          : 'transparent',
        transition: 'background 0.2s ease',
      }}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={disabled ? disabledReason : undefined}
    >
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 32, // Fixed height forces horizontal alignment across all cards
        color: active || (hovered && !disabled) ? 'var(--color-primary)' : 'var(--color-text-secondary)',
        transition: 'color 0.2s ease',
      }}>
        {icon}
      </div>
      <div style={{ 
        marginTop: 14, // Fixed gap from icon bottom
        fontSize: 13, 
        lineHeight: 1.3,
        textAlign: 'center',
        maxHeight: 36, // Sufficient for 2 lines
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: active || (hovered && !disabled) ? 'var(--color-primary)' : 'var(--color-text-primary)', 
        fontWeight: 500, // Never change weight on hover (prevents "getting bigger" feel)
        transition: 'color 0.2s ease',
      }}>
        {title}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export type Mode = 'idle' | 'new' | 'open' | 'clone';
type CreateStep = 'template' | 'name';

// ---------------------------------------------------------------------------
// Custom Cover Components for Mockup Precision
// ---------------------------------------------------------------------------

const CoverBlank = () => (
  <div style={{ width: 68, height: 68, border: '2px dashed #6b7fa3', borderRadius: 8, opacity: 0.8 }} />
);

const CoverAdmin = () => (
  <svg width="100" height="68" viewBox="0 0 100 68" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="68" rx="6" fill="#F8FAFC"/>
    <rect width="24" height="68" fill="#1E293B"/>
    <rect x="6" y="8" width="12" height="2" rx="1" fill="#475569"/>
    <rect x="6" y="14" width="8" height="2" rx="1" fill="#475569"/>
    <rect x="6" y="20" width="10" height="2" rx="1" fill="#475569"/>
    {/* header */}
    <rect x="28" y="6" width="60" height="4" rx="2" fill="#E2E8F0"/>
    {/* content boxes */}
    <rect x="28" y="16" width="32" height="20" rx="2" fill="#FFFFFF" stroke="#E2E8F0"/>
    <rect x="64" y="16" width="28" height="20" rx="2" fill="#FFFFFF" stroke="#E2E8F0"/>
    <rect x="28" y="40" width="64" height="22" rx="2" fill="#FFFFFF" stroke="#E2E8F0"/>
    {/* fake charts */}
    <circle cx="44" cy="26" r="6" stroke="#3B82F6" strokeWidth="2"/>
    <circle cx="78" cy="26" r="6" fill="#10B981"/>
    <path d="M32 54 L 40 46 L 50 50 L 60 44 L 70 48 L 86 42" stroke="#F59E0B" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
    {/* fake user profile */}
    <circle cx="78" cy="52" r="4" fill="#64748B"/>
    <path d="M74 58 Q 78 52 82 58" stroke="#64748B" strokeWidth="1.5" fill="none"/>
  </svg>
);

const CoverPortal = () => (
  <svg width="100" height="68" viewBox="0 0 100 68" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Desktop Browser Window Frame (Light) */}
    <rect width="100" height="68" rx="6" fill="#F8FAFC"/>
    {/* Header Navbar */}
    <rect x="0" y="0" width="100" height="8" fill="#FFFFFF" rx="3"/>
    <rect x="0" y="4" width="100" height="4" fill="#FFFFFF"/> 
    <rect x="0" y="8" width="100" height="0.5" fill="#E2E8F0"/> 
    <rect x="6" y="3" width="10" height="2" rx="1" fill="#3B82F6"/> 
    <rect x="74" y="3.5" width="4" height="1" rx="0.5" fill="#94A3B8"/> 
    <rect x="80" y="3.5" width="4" height="1" rx="0.5" fill="#94A3B8"/>
    <rect x="86" y="3.5" width="4" height="1" rx="0.5" fill="#94A3B8"/>
    <rect x="92" y="3" width="4" height="2" rx="0.5" fill="#3B82F6"/> 

    {/* Hero Section */}
    <rect x="0" y="8" width="100" height="24" fill="#EFF6FF"/>
    {/* Hero Text */}
    <rect x="10" y="14" width="24" height="4" rx="1" fill="#1E293B"/>
    <rect x="10" y="20" width="30" height="2" rx="1" fill="#475569"/>
    <rect x="10" y="24" width="18" height="2" rx="1" fill="#475569"/>
    <rect x="10" y="28" width="12" height="3" rx="1.5" fill="#3B82F6"/>
    {/* Hero Image */}
    <rect x="60" y="12" width="30" height="16" rx="2" fill="#DBEAFE"/>
    <circle cx="75" cy="20" r="4" fill="#BFDBFE"/>

    {/* Features Section (3 columns) */}
    <rect x="10" y="38" width="22" height="22" rx="2" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.5"/>
    <circle cx="21" cy="45" r="3" fill="#10B981"/>
    <rect x="14" y="51" width="14" height="1.5" rx="0.5" fill="#94A3B8"/>
    <rect x="14" y="54" width="10" height="1.5" rx="0.5" fill="#94A3B8"/>

    <rect x="39" y="38" width="22" height="22" rx="2" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.5"/>
    <circle cx="50" cy="45" r="3" fill="#F59E0B"/>
    <rect x="43" y="51" width="14" height="1.5" rx="0.5" fill="#94A3B8"/>
    <rect x="43" y="54" width="10" height="1.5" rx="0.5" fill="#94A3B8"/>

    <rect x="68" y="38" width="22" height="22" rx="2" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.5"/>
    <circle cx="79" cy="45" r="3" fill="#8B5CF6"/>
    <rect x="72" y="51" width="14" height="1.5" rx="0.5" fill="#94A3B8"/>
    <rect x="72" y="54" width="10" height="1.5" rx="0.5" fill="#94A3B8"/>
  </svg>
);

const CoverDashboard = () => (
  <svg width="100" height="68" viewBox="0 0 100 68" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="68" rx="6" fill="#0F172A"/>
    <rect width="100" height="12" fill="#1E293B"/>
    <rect x="8" y="4" width="20" height="3" rx="1.5" fill="#3B82F6"/>
    <rect x="32" y="4" width="10" height="3" rx="1.5" fill="#64748B"/>
    <rect x="46" y="4" width="12" height="3" rx="1.5" fill="#64748B"/>
    {/* Main chart */}
    <rect x="6" y="16" width="56" height="30" rx="2" fill="#1E293B"/>
    <path d="M10 38 L 22 24 L 30 30 L 42 20 L 56 28" stroke="#3B82F6" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
    <path d="M10 42 L 20 34 L 32 38 L 44 28 L 56 36" stroke="#10B981" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
    {/* side charts */}
    <rect x="66" y="16" width="28" height="13" rx="2" fill="#1E293B"/>
    <circle cx="80" cy="22.5" r="4" stroke="#F59E0B" strokeWidth="1.5"/>
    <circle cx="80" cy="22.5" r="1.5" fill="#F59E0B"/>
    <rect x="66" y="33" width="28" height="13" rx="2" fill="#1E293B"/>
    <rect x="70" y="38" width="4" height="6" rx="1" fill="#3B82F6"/>
    <rect x="76" y="36" width="4" height="8" rx="1" fill="#10B981"/>
    <rect x="82" y="39" width="4" height="5" rx="1" fill="#F59E0B"/>
    <rect x="88" y="35" width="4" height="9" rx="1" fill="#8B5CF6"/>
    {/* bottom panels */}
    <rect x="6" y="50" width="26" height="14" rx="2" fill="#1E293B"/>
    <circle cx="19" cy="57" r="4" stroke="#8B5CF6" strokeWidth="1.5"/>
    <rect x="36" y="50" width="58" height="14" rx="2" fill="#1E293B"/>
    {/* fake map dots */}
    <circle cx="50" cy="55" r="1.5" fill="#475569"/>
    <circle cx="54" cy="58" r="2" fill="#64748B"/>
    <circle cx="58" cy="54" r="1" fill="#475569"/>
    <circle cx="68" cy="56" r="2.5" fill="#64748B"/>
    <circle cx="76" cy="53" r="1.5" fill="#475569"/>
    <circle cx="82" cy="57" r="1" fill="#475569"/>
  </svg>
);

// ---------------------------------------------------------------------------
// Mobile Cover Components (Android Studio Style Precision)
// ---------------------------------------------------------------------------

const CoverMobileBasic = () => (
  <svg width="100" height="68" viewBox="0 0 100 68" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="33" y="0" width="34" height="68" rx="6" fill="#1E293B"/>
    <rect x="35" y="2" width="30" height="64" rx="4" fill="#F8FAFC"/>
    <rect x="35" y="2" width="30" height="10" rx="4" fill="#3B82F6"/> 
    <path d="M 39 7 L 43 7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/> 
    
    <rect x="39" y="16" width="22" height="12" rx="2" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.5"/>
    <rect x="42" y="19" width="10" height="2" rx="1" fill="#94A3B8"/>
    <rect x="42" y="23" width="14" height="2" rx="1" fill="#E2E8F0"/>
    
    <rect x="39" y="32" width="22" height="12" rx="2" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.5"/>
    <rect x="42" y="35" width="16" height="2" rx="1" fill="#94A3B8"/>
    <rect x="42" y="39" width="8" height="2" rx="1" fill="#E2E8F0"/>
    
    <rect x="39" y="48" width="22" height="12" rx="2" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.5"/>
    <rect x="42" y="51" width="12" height="2" rx="1" fill="#94A3B8"/>
    <rect x="42" y="55" width="10" height="2" rx="1" fill="#E2E8F0"/>
    
    <circle cx="59" cy="58" r="5" fill="#10B981"/> 
    <path d="M 59 55 L 59 61 M 56 58 L 62 58" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const CoverMobileBottomNav = () => (
  <svg width="100" height="68" viewBox="0 0 100 68" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="33" y="0" width="34" height="68" rx="6" fill="#1E293B"/>
    <rect x="35" y="2" width="30" height="64" rx="4" fill="#F8FAFC"/>
    <rect x="35" y="2" width="30" height="10" rx="4" fill="#3B82F6"/> 
    
    <rect x="39" y="16" width="22" height="32" rx="2" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.5"/>
    <circle cx="50" cy="24" r="5" fill="#E2E8F0"/>
    <rect x="44" y="34" width="12" height="2" rx="1" fill="#94A3B8"/>
    <rect x="42" y="40" width="16" height="2" rx="1" fill="#CBD5E1"/>
    
    <rect x="35" y="54" width="30" height="12" rx="4" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.5"/>
    <circle cx="41" cy="60" r="2.5" fill="#3B82F6"/>
    <circle cx="50" cy="60" r="2" fill="#94A3B8"/>
    <circle cx="59" cy="60" r="2" fill="#94A3B8"/>
  </svg>
);


// ---------------------------------------------------------------------------
// Built-in project templates
// ---------------------------------------------------------------------------

interface ProjectTemplate {
  id: string;
  name: string;
  cover?: React.ReactNode;
}

interface ProjectTypeCategory {
  id: string;
  name: string;
  templates: ProjectTemplate[];
}

// ---------------------------------------------------------------------------
// WelcomeScreen Component
// ---------------------------------------------------------------------------

export function WelcomeScreen({ gitlabUser, gitlabService, onSelectProject, initialMode, onClose }: WelcomeScreenProps) {
  const { t } = useTranslation('preview');

  const PROJECT_CATEGORIES: ProjectTypeCategory[] = [
    {
      id: 'web',
      name: t('welcome.categories.web'),
      templates: [
        { id: 'blank', name: t('welcome.templates.blank'), cover: <CoverBlank /> },
        { id: 'admin', name: t('welcome.templates.admin'), cover: <CoverAdmin /> },
        { id: 'portal', name: t('welcome.templates.portal'), cover: <CoverPortal /> },
        { id: 'dashboard', name: t('welcome.templates.dashboard'), cover: <CoverDashboard /> },
      ],
    },
    {
      id: 'mobile',
      name: t('welcome.categories.mobile'),
      templates: [
        { id: 'mobile-blank', name: t('welcome.templates.mobileBlank'), cover: <CoverBlank /> },
        { id: 'mobile-basic', name: t('welcome.templates.basic'), cover: <CoverMobileBasic /> },
        { id: 'mobile-bottom-nav', name: t('welcome.templates.bottomNav'), cover: <CoverMobileBottomNav /> },
      ],
    },
  ];

  const [mode, setMode] = useState<Mode>(initialMode ?? 'idle');
  const [newName, setNewName] = useState('');
  const [projects, setProjects] = useState<ActiveProjectConfig[]>([]);
  // Template wizard state
  const [createStep, setCreateStep] = useState<CreateStep>('template');
  const [activeCategoryId, setActiveCategoryId] = useState(PROJECT_CATEGORIES[0]?.id || 'web');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const activeCategory = (PROJECT_CATEGORIES.find((c) => c.id === activeCategoryId) || PROJECT_CATEGORIES[0]) as ProjectTypeCategory;

  // Clone flow state
  const [cloneAuthStatus, setCloneAuthStatus] = useState<PreviewGitLabAuthStatus | null>(null);
  const [cloneAuthLoading, setCloneAuthLoading] = useState(false);
  const [cloneSearch, setCloneSearch] = useState('');
  const [cloneProjects, setCloneProjects] = useState<PreviewGitLabProject[]>([]);
  const [cloneProjectsLoading, setCloneProjectsLoading] = useState(false);
  const [cloningId, setCloningId] = useState<number | null>(null);

  // Load recent projects
  useEffect(() => {
    void loadProjectList().then((list) => {
      setProjects(list.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt));
    });
  }, []);

  // When entering clone mode, check auth status
  useEffect(() => {
    if (mode !== 'clone') return;
    setCloneAuthLoading(true);
    gitlabService.getAuthStatus()
      .then((status) => setCloneAuthStatus(status))
      .catch(() => setCloneAuthStatus({ authenticated: false }))
      .finally(() => setCloneAuthLoading(false));
  }, [mode, gitlabService]);

  // Listen for global auth changes (login/logout)
  useEffect(() => {
    const channel = new BroadcastChannel('gitlab-auth');
    const handleRefresh = () => {
      if (mode === 'clone') {
        setCloneAuthLoading(true);
        gitlabService.getAuthStatus()
          .then((status) => setCloneAuthStatus(status))
          .catch(() => setCloneAuthStatus({ authenticated: false }))
          .finally(() => setCloneAuthLoading(false));
      }
    };
    const handleMessageEvent = (event: MessageEvent) => {
      if (event.data === 'gitlab-login-success' || event.data === 'login-success' || event.data === 'logout-success') {
        handleRefresh();
      }
    };
    channel.addEventListener('message', handleMessageEvent);
    window.addEventListener('message', handleMessageEvent);
    return () => {
      channel.removeEventListener('message', handleMessageEvent);
      channel.close();
      window.removeEventListener('message', handleMessageEvent);
    };
  }, [mode, gitlabService]);

  // When authenticated in clone mode, load projects
  useEffect(() => {
    if (mode !== 'clone' || !cloneAuthStatus?.authenticated || !cloneAuthStatus.defaultGroupId) return;
    setCloneProjectsLoading(true);
    gitlabService.listGroupProjects(cloneAuthStatus.defaultGroupId, cloneSearch || undefined)
      .then(setCloneProjects)
      .catch(() => setCloneProjects([]))
      .finally(() => setCloneProjectsLoading(false));
  }, [mode, cloneAuthStatus?.authenticated, cloneAuthStatus?.defaultGroupId, cloneSearch, gitlabService]);

  const handleCreate = useCallback(() => {
    const name = newName.trim() || t('welcome.create.blankProject');
    const config = createLocalProjectConfig(name);
    void upsertProjectInList(config);
    onSelectProject(config);
  }, [newName, onSelectProject, t]);

  const handleOpenProject = useCallback((config: ActiveProjectConfig) => {
    void upsertProjectInList({ ...config, lastOpenedAt: Date.now() });
    onSelectProject(config);
  }, [onSelectProject]);

  const handleCloneProject = useCallback(async (project: PreviewGitLabProject) => {
    setCloningId(project.id);
    try {
      const config = gitlabService.selectProjectMetadata(project);
      await upsertProjectInList(config);
      onSelectProject(config);
    } finally {
      setCloningId(null);
    }
  }, [gitlabService, onSelectProject]);

  const handleConnectGitLab = useCallback(() => {
    // Open OAuth login in a centered popup window
    const w = 1200, h = 800;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(
      getLoginUrl(),
      'gitlab-oauth',
      `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=yes,status=no`,
    );
    // Poll until popup closes, then re-check auth
    if (popup) {
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          setCloneAuthLoading(true);
          gitlabService.getAuthStatus()
            .then((status) => setCloneAuthStatus(status))
            .catch(() => setCloneAuthStatus({ authenticated: false }))
            .finally(() => setCloneAuthLoading(false));
        }
      }, 1000);
    }
  }, [gitlabService]);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
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
          maxWidth: (mode === 'new' || mode === 'clone') ? 720 : 680,
          minWidth: 560,
          background: 'var(--color-bg-editor)',
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
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--color-border-ide)', background: 'var(--color-bg-panel)' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f56' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#27c93f' }} />
          </div>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
            {mode === 'new' ? t('welcome.newProject') : mode === 'clone' ? t('welcome.cloneRepository') : t('welcome.title')}
          </div>
          <div style={{ width: 48 }} /> {/* spacer for balance */}
        </div>

        {/* Dynamic Content */}
        {mode === 'new' ? (
          /* =========================================================
             NEW PROJECT WIZARD
             ========================================================= */
          <div style={{ display: 'flex', flexDirection: 'column', height: 480, background: 'var(--color-bg-editor)' }}>
            <style>{`
              .category-item:hover {
                background: rgba(75,158,250,0.15) !important;
                color: var(--color-primary) !important;
              }
              .template-card {
                transition: all 0.2s ease, transform 0.2s ease;
              }
              .template-card:hover {
                border-color: var(--color-primary) !important;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
              }
            `}</style>
            {createStep === 'template' ? (
              /* ── Step 1: Template selection ── */
              <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                {/* Category sidebar (mockup style) */}
                <div style={{ width: 140, borderRight: '1px solid var(--color-border-ide)', padding: '16px 0', flexShrink: 0, background: 'var(--color-bg-panel)' }}>
                  {PROJECT_CATEGORIES.map((cat) => {
                    const isActive = cat.id === activeCategoryId;
                    return (
                      <div
                        key={cat.id}
                        className="category-item"
                        onClick={() => { setActiveCategoryId(cat.id); setSelectedTemplateId(null); }}
                        style={{
                          display: 'flex', alignItems: 'center',
                          padding: '8px 16px', cursor: 'pointer',
                          fontSize: 13, transition: 'background 0.15s, color 0.15s',
                          background: isActive ? 'rgba(75,158,250,0.15)' : 'transparent',
                          color: isActive ? 'var(--color-primary)' : 'var(--color-text-primary)',
                          fontWeight: isActive ? 500 : 400,
                          borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                        }}
                      >
                        {cat.name}
                      </div>
                    );
                  })}
                </div>
                {/* Template grid (mockup style) */}
                <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', background: 'var(--color-bg-canvas)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {activeCategory.templates.map((tpl) => {
                      const isSelected = selectedTemplateId === tpl.id;
                      return (
                        <div
                          key={tpl.id}
                          className="template-card"
                          onClick={() => setSelectedTemplateId(tpl.id)}
                          style={{
                            display: 'flex', flexDirection: 'column',
                            borderRadius: 8, cursor: 'pointer',
                            border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border-ide)',
                            background: 'var(--color-bg-panel)',
                            overflow: 'hidden',
                            height: 140,
                            boxShadow: isSelected ? '0 0 0 1px var(--color-primary)' : 'none',
                          }}
                        >
                          <div style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'var(--color-bg-activity-bar)', borderBottom: '1px solid var(--color-border-ide)',
                          }}>
                            {tpl.cover}
                          </div>
                          <div style={{ 
                            height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 400
                           }}>
                            {tpl.name}
                          </div>
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
                  {t('welcome.create.title')}
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 32 }}>
                  {t('welcome.create.selectTemplate')}: <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{activeCategory.templates.find((t) => t.id === selectedTemplateId)?.name}</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{t('welcome.create.projectName')}</label>
                  <input
                    autoFocus
                    type="text"
                    placeholder={t('welcome.templates.blank')}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreateStep('template'); }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 6,
                      border: '1px solid var(--color-border-ide)',
                      background: 'var(--color-bg-canvas)',
                      color: 'var(--color-text-primary)',
                      fontSize: 14,
                      outline: 'none',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--color-border-ide)'; }}
                  />
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {t('welcome.create.localHint')}
                  </div>
                </div>
              </div>
            )}

            {/* Wizard Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 24px', borderTop: '1px solid var(--color-border-ide)', background: 'var(--color-bg-panel)' }}>
              {createStep === 'template' ? (
                <>
                  <button
                    type="button"
                    onClick={() => onClose ? onClose() : setMode('idle')}
                    style={{
                      padding: '6px 20px', borderRadius: 4, border: '1px solid var(--color-border-ide)',
                      background: 'var(--color-bg-activity-bar)', color: 'var(--color-text-primary)',
                      fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    {t('welcome.create.cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={!selectedTemplateId}
                    onClick={() => setCreateStep('name')}
                    style={{
                      padding: '6px 20px', borderRadius: 4, border: 'none',
                      background: 'var(--color-primary)', color: 'var(--color-text-inverse)',
                      fontSize: 13,
                      cursor: selectedTemplateId ? 'pointer' : 'not-allowed',
                      opacity: selectedTemplateId ? 1 : 0.4,
                    }}
                  >
                    {t('welcome.create.next')}
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
                    {t('welcome.create.back')}
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
                    {t('welcome.create.finish')}
                  </button>
                </>
              )}
            </div>
          </div>
        ) : mode === 'clone' ? (
          /* =========================================================
             CLONE REPOSITORY FLOW
             ========================================================= */
          <div style={{ display: 'flex', flexDirection: 'column', height: 480, background: 'var(--color-bg-editor)' }}>
            {cloneAuthLoading ? (
              /* Loading auth status */
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 size={24} style={{ color: 'var(--color-primary)', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : !cloneAuthStatus?.authenticated ? (
              /* ── Not logged in: Login guidance ── */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 40 }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-bg-panel)', border: '1px solid var(--color-border-ide)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <GitBranch size={36} strokeWidth={1.5} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)' }}>{t('welcome.clone.connectTitle')}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.6, maxWidth: 320 }}>
                  {t('welcome.clone.connectDesc')}
                </div>
                <button
                  type="button"
                  onClick={handleConnectGitLab}
                  style={{
                    marginTop: 8, padding: '10px 32px', borderRadius: 6, border: 'none',
                    background: 'var(--color-primary)', color: 'var(--color-text-inverse)',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                >
                  {t('welcome.clone.connectBtn')}
                </button>
              </div>
            ) : (
              /* ── Logged in: Project list ── */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {/* Search bar */}
                <div style={{ padding: '16px 24px 0 24px' }}>
                  <div style={{
                    display: 'flex', gap: 8, padding: '8px 12px',
                    background: 'var(--color-bg-panel)', borderRadius: 6,
                    border: '1px solid var(--color-border-ide)', alignItems: 'center',
                  }}>
                    <Search size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                    <input
                      style={{
                        flex: 1, border: 'none', padding: 0, background: 'transparent',
                        color: 'var(--color-text-primary)', fontSize: 13, outline: 'none',
                      }}
                      placeholder={t('welcome.clone.searchPlaceholder')}
                      value={cloneSearch}
                      onChange={(e) => setCloneSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                {/* Project list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px' }}>
                  {cloneProjectsLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                      <Loader2 size={20} style={{ color: 'var(--color-primary)', animation: 'spin 1s linear infinite' }} />
                      <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>{t('welcome.clone.loading')}</span>
                    </div>
                  ) : cloneProjects.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      {cloneSearch ? t('welcome.clone.noResults') : t('welcome.clone.empty')}
                    </div>
                  ) : (
                    cloneProjects.map((p) => {
                      const alreadyCloned = projects.some((lp) => lp.gitlabProjectId === p.id);
                      return (
                        <div
                          key={p.id}
                          className="template-card"
                          onClick={() => !alreadyCloned && handleCloneProject(p)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '12px 14px', borderRadius: 8, marginBottom: 4,
                            cursor: alreadyCloned ? 'default' : 'pointer',
                            opacity: alreadyCloned ? 0.5 : 1,
                            border: '1px solid var(--color-border-ide)',
                            background: 'var(--color-bg-panel)',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => { if (!alreadyCloned) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-activity-bar)'; } }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-ide)'; (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-panel)'; }}
                        >
                          <Download size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.path_with_namespace}</div>
                          </div>
                          {cloningId === p.id && <Loader2 size={14} style={{ color: 'var(--color-primary)', animation: 'spin 1s linear infinite' }} />}
                          {alreadyCloned && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(75,158,250,0.15)', color: 'var(--color-primary)', fontWeight: 600 }}>{t('welcome.clone.alreadyCloned')}</span>}
                          {!alreadyCloned && cloningId !== p.id && <Check size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
            {/* Clone Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 24px', borderTop: '1px solid var(--color-border-ide)', background: 'var(--color-bg-panel)' }}>
              <button
                type="button"
                onClick={() => { if (onClose) { onClose(); } else { setMode('idle'); setCloneSearch(''); setCloneProjects([]); setCloneAuthStatus(null); } }}
                style={{
                  padding: '6px 20px', borderRadius: 4, border: '1px solid var(--color-border-ide)',
                  background: 'var(--color-bg-activity-bar)', color: 'var(--color-text-primary)',
                  fontSize: 13, cursor: 'pointer',
                }}
              >
                {t('welcome.create.cancel')}
              </button>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
            {t('welcome.title')}
          </div>
          <div style={{ fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {t('welcome.subtitle')}
          </div>
        </div>

      {/* Action Cards */}
      <div style={{ display: 'flex', gap: 24, justifyContent: 'center', width: '100%', marginTop: 8 }}>
        <ActionCard
          icon={<FilePlus2 size={28} strokeWidth={1.5} />}
          title={t('welcome.newProject')}
          active={false}
          onClick={() => {
            setMode('new');
            setCreateStep('template');
            setSelectedTemplateId(null);
          }}
        />
        <ActionCard
          icon={<FolderOpen size={28} strokeWidth={1.5} />}
          title={t('welcome.open')}
          disabled={projects.length === 0}
          disabledReason={t('welcome.noProjects')}
          active={mode === 'open'}
          onClick={() => setMode(mode === 'open' ? 'idle' : 'open')}
        />
        <ActionCard
          icon={<GitBranch size={28} strokeWidth={1.5} />}
          title={t('welcome.cloneRepository')}
          active={false}
          onClick={() => setMode('clone')}
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
            {t('welcome.recentProjects')}
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
                    {timeAgo(p.lastOpenedAt, t)}
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
