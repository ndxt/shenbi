import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, FileCode, FileJson, Workflow, Database, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import type { FileType, TabState } from '@shenbi/editor-core';
import { useTranslation } from '@shenbi/i18n';

function getTabIcon(fileType?: FileType) {
  switch (fileType) {
    case 'page': return FileCode;
    case 'api': return FileJson;
    case 'flow': return Workflow;
    case 'db': return Database;
    case 'dict': return BookOpen;
    default: return FileCode;
  }
}

export interface EditorTabsProps {
  /** Legacy single-tab mode */
  label?: string | undefined;
  /** Multi-tab mode */
  tabs?: TabState[] | undefined;
  activeTabId?: string | undefined;
  onActivateTab?: ((fileId: string) => void) | undefined;
  onCloseTab?: ((fileId: string) => void) | undefined;
  onCloseOtherTabs?: ((fileId: string) => void) | undefined;
  onCloseAllTabs?: (() => void) | undefined;
  onCloseSavedTabs?: (() => void) | undefined;
  onMoveTab?: ((fromIndex: number, toIndex: number) => void) | undefined;
}

/* ─── Context menu state ─── */
interface TabContextMenu {
  x: number;
  y: number;
  fileId: string;
  index: number;
}

/* ─── TabItem ─── */
function TabItem({
  label,
  icon: Icon,
  active = false,
  isDirty = false,
  dragging = false,
  dropSide,
  onClose,
  onClick,
  onAuxClick,
  onContextMenu,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  t,
}: {
  label: string;
  icon: React.ComponentType<{ size: number; className?: string }>;
  active?: boolean;
  isDirty?: boolean;
  dragging?: boolean;
  dropSide?: 'left' | 'right' | null;
  onClose?: () => void;
  onClick?: () => void;
  onAuxClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  t: (key: string) => string;
}) {
  return (
    <div
      className={`
        group relative h-full px-3 flex items-center gap-2 border-r border-border-ide cursor-pointer min-w-[120px] max-w-[200px] transition-colors
        ${active ? 'bg-bg-sidebar text-text-primary' : 'bg-bg-editor text-text-secondary hover:bg-bg-sidebar/50 hover:text-text-primary'}
        ${dragging ? 'opacity-50' : ''}
      `}
      title={isDirty ? `${label} - ${t('editorTabs.unsaved')}` : label}
      onClick={onClick}
      onAuxClick={onAuxClick}
      onContextMenu={onContextMenu}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {/* Drop indicator lines */}
      {dropSide === 'left' && <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-blue-500 z-10" />}
      {dropSide === 'right' && <div className="absolute right-0 top-1 bottom-1 w-[2px] bg-blue-500 z-10" />}
      <Icon size={14} className={active ? 'text-blue-400' : 'text-text-secondary'} />
      <span className={`text-[13px] truncate flex-1 ${isDirty ? 'italic' : ''}`}>{label}</span>
      {onClose ? (
        <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
          {isDirty && (
            <span
              className="w-2 h-2 rounded-full bg-text-secondary group-hover:hidden"
              title={t('editorTabs.unsavedTooltip')}
            />
          )}
          <div
            className={`p-0.5 rounded-sm hover:bg-bg-activity-bar ${isDirty ? 'hidden group-hover:block' : (active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}`}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <X size={12} />
          </div>
        </div>
      ) : isDirty ? (
        <span
          className="w-2 h-2 rounded-full bg-text-secondary shrink-0"
          title={t('editorTabs.unsavedTooltip')}
        />
      ) : null}
      {active && <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500" />}
    </div>
  );
}

/* ─── EditorTabs ─── */
export function EditorTabs({
  label,
  tabs,
  activeTabId,
  onActivateTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseAllTabs,
  onCloseSavedTabs,
  onMoveTab,
}: EditorTabsProps) {
  const { t } = useTranslation('editorUi');
  /* ── Context menu ── */
  const [ctxMenu, setCtxMenu] = useState<TabContextMenu | null>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [ctxMenu]);

  const handleTabContextMenu = useCallback((e: React.MouseEvent, fileId: string, index: number) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, fileId, index });
  }, []);

  /* ── Middle-click close ── */
  const handleAuxClick = useCallback((e: React.MouseEvent, fileId: string) => {
    if (e.button === 1) {
      e.preventDefault();
      onCloseTab?.(fileId);
    }
  }, [onCloseTab]);

  /* ── Drag & drop ── */
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; side: 'left' | 'right' } | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) {
      setDropTarget(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const side = e.clientX < midX ? 'left' : 'right';
    setDropTarget({ index, side });
  }, [dragIndex]);

  const handleDrop = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || !onMoveTab) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    let toIndex = e.clientX < midX ? index : index + 1;
    if (dragIndex < toIndex) toIndex--;
    if (dragIndex !== toIndex) onMoveTab(dragIndex, toIndex);
    setDragIndex(null);
    setDropTarget(null);
  }, [dragIndex, onMoveTab]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropTarget(null);
  }, []);

  /* ── Overflow scroll indicators ── */
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState, tabs]);

  const scrollBy = useCallback((delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  }, []);

  // Multi-tab mode
  if (tabs && tabs.length > 0) {
    return (
      <div className="relative h-9 bg-bg-editor border-b border-border-ide shrink-0">
        {/* Left scroll arrow */}
        {canScrollLeft && (
          <button
            type="button"
            className="absolute left-0 top-0 bottom-0 z-10 w-6 flex items-center justify-center bg-gradient-to-r from-bg-editor to-transparent hover:from-bg-editor"
            onClick={() => scrollBy(-200)}
          >
            <ChevronLeft size={14} className="text-text-secondary" />
          </button>
        )}

        <div
          ref={scrollRef}
          className="h-full flex items-center overflow-x-auto scrollbar-hide"
        >
          {tabs.map((tab, index) => {
            const Icon = getTabIcon(tab.fileType);
            const ds = dropTarget?.index === index ? dropTarget.side : null;
            return (
              <TabItem
                key={tab.fileId}
                label={tab.fileName}
                icon={Icon}
                active={tab.fileId === activeTabId}
                isDirty={tab.isDirty}
                dragging={dragIndex === index}
                dropSide={ds}
                onClick={() => onActivateTab?.(tab.fileId)}
                onClose={() => onCloseTab?.(tab.fileId)}
                onAuxClick={(e) => handleAuxClick(e, tab.fileId)}
                onContextMenu={(e) => handleTabContextMenu(e, tab.fileId, index)}
                draggable={!!onMoveTab}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                t={t}
              />
            );
          })}
        </div>

        {/* Right scroll arrow */}
        {canScrollRight && (
          <button
            type="button"
            className="absolute right-0 top-0 bottom-0 z-10 w-6 flex items-center justify-center bg-gradient-to-l from-bg-editor to-transparent hover:from-bg-editor"
            onClick={() => scrollBy(200)}
          >
            <ChevronRight size={14} className="text-text-secondary" />
          </button>
        )}

        {/* Context menu */}
        {ctxMenu && (
          <div
            className="fixed bg-bg-panel border border-border-ide rounded shadow-lg py-1 min-w-[160px] z-50"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left text-[12px] text-text-primary hover:bg-bg-activity-bar"
              onClick={() => { onCloseTab?.(ctxMenu.fileId); setCtxMenu(null); }}
            >
              {t('editorTabs.close')}
            </button>
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left text-[12px] text-text-primary hover:bg-bg-activity-bar"
              onClick={() => { onCloseOtherTabs?.(ctxMenu.fileId); setCtxMenu(null); }}
            >
              {t('editorTabs.closeOthers')}
            </button>
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left text-[12px] text-text-primary hover:bg-bg-activity-bar"
              onClick={() => { onCloseSavedTabs?.(); setCtxMenu(null); }}
            >
              {t('editorTabs.closeSaved')}
            </button>
            <div className="border-t border-border-ide my-1" />
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left text-[12px] text-text-primary hover:bg-bg-activity-bar"
              onClick={() => { onCloseAllTabs?.(); setCtxMenu(null); }}
            >
              {t('editorTabs.closeAll')}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Legacy single-tab mode
  const displayLabel = label?.trim();
  if (!displayLabel) {
    return null;
  }
  return (
    <div className="h-9 bg-bg-editor border-b border-border-ide flex items-center shrink-0 overflow-x-auto scrollbar-hide">
      <TabItem label={displayLabel} icon={FileCode} active t={t} />
    </div>
  );
}
