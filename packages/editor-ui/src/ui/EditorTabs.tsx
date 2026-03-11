import React, { useCallback } from 'react';
import { X, FileCode, FileJson, Workflow, Database, BookOpen } from 'lucide-react';
import type { FileType, TabState } from '@shenbi/editor-core';

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
}

function TabItem({
  label,
  icon: Icon,
  active = false,
  isDirty = false,
  onClose,
  onClick,
  onAuxClick,
}: {
  label: string;
  icon: React.ComponentType<{ size: number; className?: string }>;
  active?: boolean;
  isDirty?: boolean;
  onClose?: () => void;
  onClick?: () => void;
  onAuxClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={`
        relative h-full px-3 flex items-center gap-2 border-r border-border-ide cursor-pointer min-w-[120px] max-w-[200px] transition-colors
        ${active ? 'bg-bg-sidebar text-text-primary' : 'bg-bg-editor text-text-secondary hover:bg-bg-sidebar/50 hover:text-text-primary'}
      `}
      onClick={onClick}
      onAuxClick={onAuxClick}
    >
      <Icon size={14} className={active ? 'text-blue-400' : 'text-text-secondary'} />
      <span className="text-[13px] truncate flex-1">{label}</span>
      {isDirty && (
        <span className="w-2 h-2 rounded-full bg-text-secondary shrink-0" />
      )}
      {onClose && (
        <div
          className={`p-0.5 rounded-sm hover:bg-bg-activity-bar shrink-0 ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <X size={12} />
        </div>
      )}
      {active && <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500" />}
    </div>
  );
}

export function EditorTabs({
  label,
  tabs,
  activeTabId,
  onActivateTab,
  onCloseTab,
}: EditorTabsProps) {
  const handleAuxClick = useCallback((e: React.MouseEvent, fileId: string) => {
    // Middle mouse button closes tab
    if (e.button === 1) {
      e.preventDefault();
      onCloseTab?.(fileId);
    }
  }, [onCloseTab]);

  // Multi-tab mode
  if (tabs && tabs.length > 0) {
    return (
      <div className="h-9 bg-bg-editor border-b border-border-ide flex items-center shrink-0 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = getTabIcon(tab.fileType);
          return (
            <TabItem
              key={tab.fileId}
              label={tab.fileName}
              icon={Icon}
              active={tab.fileId === activeTabId}
              isDirty={tab.isDirty}
              onClick={() => onActivateTab?.(tab.fileId)}
              onClose={() => onCloseTab?.(tab.fileId)}
              onAuxClick={(e) => handleAuxClick(e, tab.fileId)}
            />
          );
        })}
      </div>
    );
  }

  // Legacy single-tab mode
  const displayLabel = label || 'Untitled';
  return (
    <div className="h-9 bg-bg-editor border-b border-border-ide flex items-center shrink-0 overflow-x-auto scrollbar-hide">
      <TabItem label={displayLabel} icon={FileCode} active />
    </div>
  );
}
