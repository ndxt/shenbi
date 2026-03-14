import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronRight,
  ChevronDown,
  FileCode,
  FileJson,
  Folder,
  FolderOpen,
  FolderPlus,
  RefreshCw,
  ChevronsDownUp,
  Trash2,
  Pencil,
  Save,
  Database,
  Workflow,
  BookOpen,
  FilePlus,
} from 'lucide-react';
import type { FSTreeNode, FileType } from '@shenbi/editor-core';
import { useTranslation } from '@shenbi/i18n';
import './i18n';

// ─── Inline Dialog Hook ───────────────────────────────────────────────────────

interface _DialogState {
  open: boolean;
  message: string;
  resolve: ((ok: boolean) => void) | null;
}

function useDialog() {
  const [dlg, setDlg] = useState<_DialogState>({ open: false, message: '', resolve: null });
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDlg({ open: true, message, resolve });
    });
  }, []);

  const handleOk = useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setDlg({ open: false, message: '', resolve: null });
  }, []);

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setDlg({ open: false, message: '', resolve: null });
  }, []);

  const DialogPortal = dlg.open
    ? createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onMouseDown={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative z-10 w-[300px] rounded-lg border border-[var(--border-ide)] bg-[var(--bg-panel)] shadow-2xl"
            onKeyDown={(e) => { if (e.key === 'Enter') handleOk(); else if (e.key === 'Escape') handleCancel(); }}
          >
            <div className="px-4 pt-4 pb-3">
              <p className="text-[13px] text-[var(--text-primary)] leading-relaxed">{dlg.message}</p>
            </div>
            <div className="h-px bg-[var(--border-ide)]" />
            <div className="flex items-center justify-end gap-2 px-4 py-3">
              <button
                type="button"
                onClick={handleCancel}
                className="h-[26px] rounded px-3 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleOk}
                autoFocus
                className="h-[26px] rounded bg-blue-600 px-3 text-[12px] text-white hover:bg-blue-500 transition-colors"
              >
                确认
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return { confirm, DialogPortal };
}

export interface FileExplorerProps {
  tree: FSTreeNode[];
  activeFileId: string | undefined;
  dirtyFileIds?: Set<string> | undefined;
  statusText?: string | undefined;
  canSaveActiveFile?: boolean | undefined;
  onSaveActiveFile?: (() => void) | undefined;
  initialExpandedIds?: string[] | undefined;
  initialFocusedId?: string | undefined;
  onExpandedIdsChange?: ((expandedIds: string[]) => void) | undefined;
  onFocusedIdChange?: ((focusedId: string | undefined) => void) | undefined;
  onOpenFile: (fileId: string) => void;
  onCreateFile: (parentId: string | null, name: string, fileType: FileType) => void;
  onCreateDirectory: (parentId: string | null, name: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onRenameNode: (nodeId: string, newName: string) => void;
  onRefresh: () => void;
  onMoveNode?: (nodeId: string, newParentId: string | null, afterNodeId: string | null) => void;
}

type DropZone = 'before' | 'after' | 'inside';

interface DragState {
  dragNodeId: string;
  targetNodeId: string | null;
  zone: DropZone;
}

interface CreatingState {
  parentId: string | null;
  type: 'file' | 'directory';
  fileType?: FileType | undefined;
}

// ─── File type definitions ───────────────────────────────────────────────────

interface FileTypeOption {
  fileType: FileType;
  labelZh: string;
  labelEn: string;
  icon: React.ElementType;
  iconColor: string;
}

const FILE_TYPE_OPTIONS: FileTypeOption[] = [
  { fileType: 'page',  labelZh: '页面',  labelEn: 'Page',   icon: FileCode,  iconColor: 'text-blue-400' },
  { fileType: 'api',   labelZh: 'API',   labelEn: 'API',    icon: FileJson,  iconColor: 'text-green-400' },
  { fileType: 'flow',  labelZh: '流程',  labelEn: 'Flow',   icon: Workflow,  iconColor: 'text-purple-400' },
  { fileType: 'db',    labelZh: '数据表', labelEn: 'DB',     icon: Database,  iconColor: 'text-yellow-400' },
  { fileType: 'dict',  labelZh: '字典',  labelEn: 'Dict',   icon: BookOpen,  iconColor: 'text-orange-400' },
];

function getFileIcon(fileType?: FileType): React.ElementType {
  switch (fileType) {
    case 'page': return FileCode;
    case 'api': return FileJson;
    case 'flow': return Workflow;
    case 'db': return Database;
    case 'dict': return BookOpen;
    default: return FileCode;
  }
}

function getFileIconColor(fileType?: FileType, isActive?: boolean): string {
  if (isActive) return 'text-blue-400';
  switch (fileType) {
    case 'page': return 'text-[#519aba]';
    case 'api': return 'text-green-400';
    case 'flow': return 'text-purple-400';
    case 'db': return 'text-yellow-400';
    case 'dict': return 'text-orange-400';
    default: return 'text-[#519aba]';
  }
}

// ─── New-file type picker dropdown ───────────────────────────────────────────

function FileTypeDropdown({
  top,
  left,
  onSelect,
  onClose,
}: {
  top: number;
  left: number;
  onSelect: (ft: FileType) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[150px] rounded-[5px] border border-[var(--border-ide)] bg-[var(--bg-panel)] py-1 shadow-xl"
      style={{ top, left }}
    >
      {FILE_TYPE_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        return (
          <button
            key={opt.fileType}
            type="button"
            className="flex w-full items-center gap-2 px-3 py-[5px] text-[12px] text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.07)] transition-colors"
            onClick={() => { onSelect(opt.fileType); onClose(); }}
          >
            <Icon size={14} className={opt.iconColor} />
            <span>{opt.labelZh}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Inline create input ──────────────────────────────────────────────────────

function InlineCreateInput({
  depth,
  type,
  fileType,
  onCommit,
  onCancel,
}: {
  depth: number;
  type: 'file' | 'directory';
  fileType?: FileType | undefined;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const committedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    if (value.trim()) {
      onCommit(value.trim());
    } else {
      onCancel();
    }
  };

  const Icon = type === 'directory' ? Folder : getFileIcon(fileType);
  const iconColor = type === 'directory' ? 'text-[#e8c17a]' : getFileIconColor(fileType);

  return (
    <div
      className="relative flex h-[22px] items-center gap-[3px] px-2 text-[13px]"
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      {Array.from({ length: depth }, (_, i) => (
        <span
          key={i}
          className="absolute top-0 bottom-0 w-px bg-[var(--border-ide)] opacity-40"
          style={{ left: `${i * 16 + 16}px` }}
        />
      ))}
      <span className="w-[16px] shrink-0" />
      <Icon size={14} className={`shrink-0 ${iconColor}`} />
      <input
        ref={inputRef}
        className="flex-1 min-w-0 h-[16px] rounded-[2px] border border-[#007acc] bg-[var(--bg-panel)] px-1 py-0 text-[12px] text-[var(--text-primary)] outline-none"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { committedRef.current = true; onCancel(); }
        }}
        onBlur={commit}
      />
    </div>
  );
}

// ─── Tree node item ───────────────────────────────────────────────────────────

interface TreeNodeItemProps {
  node: FSTreeNode;
  depth: number;
  activeFileId: string | undefined;
  focusedId: string | undefined;
  dirtyFileIds: Set<string> | undefined;
  expandedIds: Set<string>;
  renamingId: string | undefined;
  creating: CreatingState | null;
  onToggleExpand: (id: string) => void;
  onOpenFile: (fileId: string) => void;
  onStartRename: (id: string) => void;
  onCommitRename: (id: string, newName: string) => void;
  onCancelRename: () => void;
  onContextMenu: (event: React.MouseEvent, node: FSTreeNode) => void;
  onCommitCreate: (name: string) => void;
  onCancelCreate: () => void;
  onClickNode: (id: string) => void;
  dragState: DragState | null;
  onDragStart?: ((e: React.DragEvent, nodeId: string) => void) | undefined;
  onDragOver?: ((e: React.DragEvent, node: FSTreeNode, isExpanded: boolean) => void) | undefined;
  onDragLeave?: ((e: React.DragEvent) => void) | undefined;
  onDrop?: ((e: React.DragEvent, node: FSTreeNode, isExpanded: boolean) => void) | undefined;
  onDragEnd?: ((e: React.DragEvent) => void) | undefined;
}

function TreeNodeItem({
  node,
  depth,
  activeFileId,
  focusedId,
  dirtyFileIds,
  expandedIds,
  renamingId,
  creating,
  onToggleExpand,
  onOpenFile,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onContextMenu,
  onCommitCreate,
  onCancelCreate,
  onClickNode,
  dragState,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: TreeNodeItemProps) {
  const isDir = node.type === 'directory';
  const isExpanded = expandedIds.has(node.id);
  const isActive = node.id === activeFileId;
  const isFocused = node.id === focusedId;
  const isDirty = !isDir && dirtyFileIds?.has(node.id);
  const isRenaming = renamingId === node.id;
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [renameValue, setRenameValue] = useState(node.name);
  const committedRef = useRef(false);

  const showCreateInput = isDir && isExpanded && creating?.parentId === node.id;

  useEffect(() => {
    if (isActive && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isActive]);

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(node.name);
      committedRef.current = false;
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }
  }, [isRenaming, node.name]);

  const handleClick = () => {
    onClickNode(node.id);
    if (isDir) {
      onToggleExpand(node.id);
    } else {
      onOpenFile(node.id);
    }
  };

  const handleDoubleClick = () => {
    if (!isRenaming) onStartRename(node.id);
  };

  const commitOrCancel = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    if (renameValue.trim() && renameValue.trim() !== node.name) {
      onCommitRename(node.id, renameValue.trim());
    } else {
      onCancelRename();
    }
  };

  const handleRenameKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') { event.preventDefault(); commitOrCancel(); }
    else if (event.key === 'Escape') { committedRef.current = true; onCancelRename(); }
  };

  const Icon = isDir ? (isExpanded ? FolderOpen : Folder) : getFileIcon(node.fileType);
  const Chevron = isDir ? (isExpanded ? ChevronDown : ChevronRight) : null;

  const isDragSource = dragState?.dragNodeId === node.id;
  const dropZone = dragState?.targetNodeId === node.id ? dragState.zone : null;

  // VS Code row style
  const rowBg = isActive
    ? 'bg-[rgba(255,255,255,0.1)]'
    : dropZone === 'inside'
    ? 'bg-[rgba(255,255,255,0.07)]'
    : '';

  const rowHover = 'hover:bg-[rgba(255,255,255,0.07)]';

  const textColor = isActive
    ? 'text-[var(--text-primary)]'
    : isDirty
    ? 'text-[var(--text-primary)]'
    : 'text-[var(--text-secondary)]';

  return (
    <>
      <div
        ref={rowRef}
        className={`
          group relative flex h-[22px] cursor-pointer select-none items-center text-[13px]
          ${rowBg} ${!isActive && !isDragSource ? rowHover : ''}
          ${isFocused && !isActive ? 'outline outline-1 outline-[rgba(0,122,204,0.5)] -outline-offset-1' : ''}
          ${isDragSource ? 'opacity-40' : ''}
          ${textColor}
        `}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        draggable={!isRenaming && !!onDragStart}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
        onDragStart={(e) => onDragStart?.(e, node.id)}
        onDragOver={(e) => onDragOver?.(e, node, isExpanded)}
        onDragLeave={(e) => onDragLeave?.(e)}
        onDrop={(e) => onDrop?.(e, node, isExpanded)}
        onDragEnd={(e) => onDragEnd?.(e)}
      >
        {/* Drop zone indicator lines */}
        {dropZone === 'before' && (
          <div
            className="pointer-events-none absolute left-0 right-0 h-[2px] bg-[#007acc]"
            style={{ top: 0, marginLeft: `${depth * 16 + 4}px` }}
          />
        )}
        {dropZone === 'after' && (
          <div
            className="pointer-events-none absolute left-0 right-0 h-[2px] bg-[#007acc]"
            style={{ bottom: 0, marginLeft: `${depth * 16 + 4}px` }}
          />
        )}

        {/* Indent guide lines — shown on group hover */}
        {Array.from({ length: depth }, (_, i) => (
          <span
            key={i}
            className="absolute top-0 bottom-0 w-px bg-[var(--border-ide)] opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${i * 16 + 16}px` }}
          />
        ))}

        {/* Chevron */}
        {Chevron ? (
          <Chevron
            size={16}
            className="shrink-0 text-[var(--text-secondary)] opacity-60"
            style={{ marginLeft: 2 }}
          />
        ) : (
          <span className="w-[16px] shrink-0" />
        )}

        {/* Icon */}
        <Icon
          size={16}
          className={`mr-[6px] shrink-0 ${
            isDir
              ? (isExpanded ? 'text-[#dcb67a]' : 'text-[#e8c17a]')
              : getFileIconColor(node.fileType, isActive)
          }`}
        />

        {/* Name / rename input */}
        {isRenaming ? (
          <input
            ref={inputRef}
            className="flex-1 min-w-0 h-[16px] rounded-[2px] border border-[#007acc] bg-[var(--bg-panel)] px-1 py-0 text-[12px] text-[var(--text-primary)] outline-none"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={() => commitOrCancel()}
          />
        ) : (
          <span
            className="flex flex-1 items-center truncate gap-1.5"
            title={node.name}
          >
            <span className={`truncate ${isDirty ? 'italic' : ''}`}>
              {node.name}
            </span>
            {/* Dirty dot */}
            {isDirty && (
              <span
                className="inline-block h-[6px] w-[6px] shrink-0 rounded-full bg-[var(--text-secondary)] opacity-80"
                title="未保存"
              />
            )}
          </span>
        )}

        {/* Hover action buttons */}
        {!isRenaming && (
          <span className="ml-auto flex items-center gap-0.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isDir && (
              <>
                <span
                  className="flex h-[18px] w-[18px] items-center justify-center rounded hover:bg-[rgba(255,255,255,0.1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  title="新建文件"
                  onClick={(e) => { e.stopPropagation(); onContextMenu(e as unknown as React.MouseEvent, node); }}
                >
                  <FolderPlus size={13} />
                </span>
              </>
            )}
          </span>
        )}
      </div>

      {isDir && isExpanded && (
        <>
          {node.children?.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              activeFileId={activeFileId}
              focusedId={focusedId}
              dirtyFileIds={dirtyFileIds}
              expandedIds={expandedIds}
              renamingId={renamingId}
              creating={creating}
              onToggleExpand={onToggleExpand}
              onOpenFile={onOpenFile}
              onStartRename={onStartRename}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              onContextMenu={onContextMenu}
              onCommitCreate={onCommitCreate}
              onCancelCreate={onCancelCreate}
              onClickNode={onClickNode}
              dragState={dragState}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
            />
          ))}
          {showCreateInput && (
            <InlineCreateInput
              depth={depth + 1}
              type={creating.type}
              fileType={creating.fileType}
              onCommit={onCommitCreate}
              onCancel={onCancelCreate}
            />
          )}
        </>
      )}
    </>
  );
}

// ─── Context menu ─────────────────────────────────────────────────────────────

interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
  node: FSTreeNode | null;
  targetParentId: string | null;
}

// ─── Toolbar icon button ──────────────────────────────────────────────────────

function ToolbarBtn({
  icon: Icon,
  title,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  title: string;
  onClick?: (() => void) | undefined;
  disabled?: boolean | undefined;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="flex h-[22px] w-[22px] items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.07)] transition-colors disabled:cursor-not-allowed disabled:opacity-30"
    >
      <Icon size={15} />
    </button>
  );
}

// ─── Main FileExplorer ────────────────────────────────────────────────────────

export function FileExplorer({
  tree,
  activeFileId,
  dirtyFileIds,
  canSaveActiveFile,
  onSaveActiveFile,
  initialExpandedIds,
  initialFocusedId,
  onExpandedIdsChange,
  onFocusedIdChange,
  onOpenFile,
  onCreateFile,
  onCreateDirectory,
  onDeleteNode,
  onRenameNode,
  onRefresh,
  onMoveNode,
}: FileExplorerProps) {
  const { t } = useTranslation('pluginFiles');
  const { confirm, DialogPortal } = useDialog();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(initialExpandedIds ?? []));
  const [renamingId, setRenamingId] = useState<string | undefined>();
  const [creating, setCreating] = useState<CreatingState | null>(null);
  const [focusedId, setFocusedId] = useState<string | undefined>(initialFocusedId);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    open: false, x: 0, y: 0, node: null, targetParentId: null,
  });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const autoExpandTimerRef = useRef<number | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const newFileBtnRef = useRef<HTMLButtonElement>(null);

  // New-file type dropdown (from toolbar + button)
  const [typeDropdown, setTypeDropdown] = useState<{
    top: number;
    left: number;
    parentId: string | null;
  } | null>(null);

  // ── Flatten visible nodes for keyboard nav ──
  const flatVisibleNodes = useMemo(() => {
    const result: FSTreeNode[] = [];
    const walk = (nodes: FSTreeNode[]) => {
      for (const n of nodes) {
        result.push(n);
        if (n.type === 'directory' && expandedIds.has(n.id) && n.children) {
          walk(n.children);
        }
      }
    };
    walk(tree);
    return result;
  }, [tree, expandedIds]);

  const parentLookup = useMemo(() => {
    const map = new Map<string, string | null>();
    const walk = (nodes: FSTreeNode[], parentId: string | null) => {
      for (const n of nodes) {
        map.set(n.id, parentId);
        if (n.children) walk(n.children, n.id);
      }
    };
    walk(tree, null);
    return map;
  }, [tree]);

  useEffect(() => { setExpandedIds(new Set(initialExpandedIds ?? [])); }, [initialExpandedIds]);
  useEffect(() => { setFocusedId(initialFocusedId); }, [initialFocusedId]);
  useEffect(() => { onExpandedIdsChange?.([...expandedIds]); }, [expandedIds, onExpandedIdsChange]);
  useEffect(() => { onFocusedIdChange?.(focusedId); }, [focusedId, onFocusedIdChange]);

  // Auto-expand ancestors of active file
  useEffect(() => {
    if (!activeFileId) return;
    const ancestorIds: string[] = [];
    let cursor = parentLookup.get(activeFileId) ?? null;
    while (cursor) { ancestorIds.push(cursor); cursor = parentLookup.get(cursor) ?? null; }
    if (!ancestorIds.length) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of ancestorIds) { if (!next.has(id)) { next.add(id); changed = true; } }
      return changed ? next : prev;
    });
  }, [activeFileId, parentLookup]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => setExpandedIds(new Set()), []);

  const handleContextMenu = useCallback((event: React.MouseEvent, node: FSTreeNode) => {
    event.preventDefault();
    event.stopPropagation();
    const targetParentId = node.type === 'directory' ? node.id : (parentLookup.get(node.id) ?? null);
    setContextMenu({ open: true, x: event.clientX, y: event.clientY, node, targetParentId });
  }, [parentLookup]);

  const handleRootContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ open: true, x: event.clientX, y: event.clientY, node: null, targetParentId: null });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu((prev) => ({ ...prev, open: false })), []);

  // Close context menu and type dropdown on outside click
  useEffect(() => {
    if (!contextMenu.open && !typeDropdown) return;
    const handleClick = () => { closeContextMenu(); setTypeDropdown(null); };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [closeContextMenu, contextMenu.open, typeDropdown]);

  const startCreating = useCallback((parentId: string | null, type: 'file' | 'directory', fileType?: FileType | undefined) => {
    setCreating({ parentId, type, ...(fileType !== undefined ? { fileType } : {}) });
    if (parentId) {
      setExpandedIds((prev) => {
        if (prev.has(parentId)) return prev;
        const next = new Set(prev);
        next.add(parentId);
        return next;
      });
    }
  }, []);

  const commitCreate = useCallback((name: string) => {
    if (!creating) return;
    if (creating.type === 'directory') {
      onCreateDirectory(creating.parentId, name);
    } else {
      onCreateFile(creating.parentId, name, creating.fileType ?? 'page');
    }
    setCreating(null);
  }, [creating, onCreateDirectory, onCreateFile]);

  const cancelCreate = useCallback(() => setCreating(null), []);

  const handleDelete = useCallback(async (nodeId: string) => {
    const ok = await confirm(t('confirmDelete'));
    if (ok) onDeleteNode(nodeId);
  }, [confirm, onDeleteNode, t]);

  const startRename = useCallback((id: string) => setRenamingId(id), []);
  const commitRename = useCallback((id: string, newName: string) => { onRenameNode(id, newName); setRenamingId(undefined); }, [onRenameNode]);
  const cancelRename = useCallback(() => setRenamingId(undefined), []);

  // Keyboard navigation
  const handleTreeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (renamingId || creating) return;
    const nodes = flatVisibleNodes;
    if (!nodes.length) return;
    const currentIndex = focusedId ? nodes.findIndex((n) => n.id === focusedId) : -1;
    const currentNode = currentIndex >= 0 ? nodes[currentIndex] : undefined;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = nodes[Math.min(currentIndex + 1, nodes.length - 1)];
        if (next) setFocusedId(next.id);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = nodes[Math.max(currentIndex - 1, 0)];
        if (prev) setFocusedId(prev.id);
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        if (!currentNode) break;
        if (currentNode.type === 'directory') {
          if (!expandedIds.has(currentNode.id)) toggleExpand(currentNode.id);
          else { const first = currentNode.children?.[0]; if (first) setFocusedId(first.id); }
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        if (!currentNode) break;
        if (currentNode.type === 'directory' && expandedIds.has(currentNode.id)) toggleExpand(currentNode.id);
        else { const pid = parentLookup.get(currentNode.id); if (pid) setFocusedId(pid); }
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (!currentNode) break;
        if (currentNode.type === 'directory') toggleExpand(currentNode.id);
        else onOpenFile(currentNode.id);
        break;
      }
      case 'F2': { e.preventDefault(); if (currentNode) startRename(currentNode.id); break; }
      case 'Delete': { e.preventDefault(); if (currentNode) void handleDelete(currentNode.id); break; }
    }
  }, [flatVisibleNodes, focusedId, renamingId, creating, expandedIds, parentLookup, toggleExpand, onOpenFile, startRename, handleDelete]);

  // Siblings map for DnD
  const siblingsMap = useMemo(() => {
    const map = new Map<string | null, FSTreeNode[]>();
    const walk = (nodes: FSTreeNode[], parentId: string | null) => {
      map.set(parentId, nodes);
      for (const n of nodes) { if (n.children) walk(n.children, n.id); }
    };
    walk(tree, null);
    return map;
  }, [tree]);

  const isAncestor = useCallback((nodeId: string, candidateDescendantId: string): boolean => {
    let cursor: string | null = candidateDescendantId;
    while (cursor !== null) {
      if (cursor === nodeId) return true;
      cursor = parentLookup.get(cursor) ?? null;
    }
    return false;
  }, [parentLookup]);

  const clearAutoExpandTimer = useCallback(() => {
    if (autoExpandTimerRef.current !== undefined) { clearTimeout(autoExpandTimerRef.current); autoExpandTimerRef.current = undefined; }
  }, []);

  const updateDragState = useCallback((next: DragState | null) => {
    dragStateRef.current = next;
    setDragState(next);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, nodeId: string) => {
    if (renamingId || creating) { e.preventDefault(); return; }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', nodeId);
    updateDragState({ dragNodeId: nodeId, targetNodeId: null, zone: 'before' });
  }, [renamingId, creating, updateDragState]);

  const handleDragOver = useCallback((e: React.DragEvent, node: FSTreeNode, isExpanded_: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    const ds = dragStateRef.current;
    if (!ds) return;
    if (node.id === ds.dragNodeId || isAncestor(ds.dragNodeId, node.id)) {
      e.dataTransfer.dropEffect = 'none';
      if (ds.targetNodeId !== null) updateDragState({ ...ds, targetNodeId: null });
      clearAutoExpandTimer();
      return;
    }
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    const isDir_ = node.type === 'directory';
    let zone: DropZone;
    if (!isDir_) { zone = ratio < 0.5 ? 'before' : 'after'; }
    else if (isExpanded_) { zone = ratio < 0.3 ? 'before' : 'inside'; }
    else { zone = ratio < 0.3 ? 'before' : ratio > 0.7 ? 'after' : 'inside'; }
    if (zone === 'inside' && isDir_ && !isExpanded_) {
      if (ds.targetNodeId !== node.id || ds.zone !== 'inside') {
        clearAutoExpandTimer();
        autoExpandTimerRef.current = window.setTimeout(() => {
          setExpandedIds((prev) => { if (prev.has(node.id)) return prev; const next = new Set(prev); next.add(node.id); return next; });
        }, 600);
      }
    } else if (ds.targetNodeId !== node.id || ds.zone !== zone) {
      clearAutoExpandTimer();
    }
    if (ds.targetNodeId !== node.id || ds.zone !== zone) updateDragState({ ...ds, targetNodeId: node.id, zone });
  }, [isAncestor, clearAutoExpandTimer, updateDragState]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
    clearAutoExpandTimer();
  }, [clearAutoExpandTimer]);

  const handleDrop = useCallback((e: React.DragEvent, targetNode: FSTreeNode, _isExpanded: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    clearAutoExpandTimer();
    const ds = dragStateRef.current;
    if (!ds || !onMoveNode) { updateDragState(null); return; }
    const { dragNodeId, zone } = ds;
    if (targetNode.id === dragNodeId || isAncestor(dragNodeId, targetNode.id)) { updateDragState(null); return; }
    let newParentId: string | null;
    let afterNodeId: string | null;
    if (zone === 'inside') { newParentId = targetNode.id; afterNodeId = null; }
    else {
      newParentId = parentLookup.get(targetNode.id) ?? null;
      const siblings = siblingsMap.get(newParentId) ?? [];
      if (zone === 'before') {
        const idx = siblings.findIndex((n) => n.id === targetNode.id);
        const prevSibling = idx > 0 ? siblings[idx - 1] : undefined;
        afterNodeId = prevSibling ? prevSibling.id : null;
      } else { afterNodeId = targetNode.id; }
    }
    const currentParentId = parentLookup.get(dragNodeId) ?? null;
    if (currentParentId === newParentId) {
      const siblings = siblingsMap.get(newParentId) ?? [];
      const dragIdx = siblings.findIndex((n) => n.id === dragNodeId);
      if (afterNodeId === null && dragIdx === 0) { updateDragState(null); return; }
      if (afterNodeId !== null) {
        const afterIdx = siblings.findIndex((n) => n.id === afterNodeId);
        if (afterIdx === dragIdx - 1 || afterIdx === dragIdx) { updateDragState(null); return; }
      }
    }
    onMoveNode(dragNodeId, newParentId, afterNodeId);
    updateDragState(null);
  }, [onMoveNode, parentLookup, siblingsMap, isAncestor, clearAutoExpandTimer, updateDragState]);

  const handleDragEnd = useCallback((_e: React.DragEvent) => { clearAutoExpandTimer(); updateDragState(null); }, [clearAutoExpandTimer, updateDragState]);

  const handleTreeContainerDragOver = useCallback((e: React.DragEvent) => {
    if (!dragStateRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleTreeContainerDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    clearAutoExpandTimer();
    const ds = dragStateRef.current;
    if (!ds || !onMoveNode) { updateDragState(null); return; }
    const { dragNodeId } = ds;
    const rootSiblings = siblingsMap.get(null) ?? [];
    const lastRoot = rootSiblings.length > 0 ? rootSiblings[rootSiblings.length - 1] : null;
    const afterNodeId = lastRoot ? lastRoot.id : null;
    const currentParentId = parentLookup.get(dragNodeId) ?? null;
    if (currentParentId === null && lastRoot?.id === dragNodeId) { updateDragState(null); return; }
    onMoveNode(dragNodeId, null, afterNodeId);
    updateDragState(null);
  }, [onMoveNode, siblingsMap, parentLookup, clearAutoExpandTimer, updateDragState]);

  const showRootCreateInput = creating && creating.parentId === null;

  // Open type dropdown for toolbar "+" button  (handleToolbarNewFile removed – use ref directly)

  return (
    <div className="h-full flex flex-col text-[13px] text-[var(--text-primary)] bg-[var(--bg-sidebar)]" ref={containerRef}>

      {/* ── Section header + toolbar ── */}
      <div className="flex items-center px-3 pt-[10px] pb-[4px] gap-0.5 group/toolbar">
        <span className="flex-1 text-[11px] font-semibold tracking-widest uppercase text-[var(--text-secondary)] opacity-70 select-none">
          {t('title')}
        </span>
        <span className="flex items-center gap-0.5 opacity-0 group-hover/toolbar:opacity-100 transition-opacity">
          <button
            ref={newFileBtnRef}
            type="button"
            title={t('toolbar.newFile')}
            onClick={() => {
              const rect = newFileBtnRef.current?.getBoundingClientRect();
              if (rect) setTypeDropdown({ top: rect.bottom + 4, left: rect.left, parentId: null });
            }}
            className="flex h-[22px] w-[22px] items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.07)] transition-colors"
          >
            <FilePlus size={15} />
          </button>
          <ToolbarBtn icon={FolderPlus} title={t('toolbar.newFolder')} onClick={() => startCreating(null, 'directory')} />
          <ToolbarBtn icon={Save} title={t('toolbar.saveCurrentFile')} onClick={onSaveActiveFile} disabled={!canSaveActiveFile || !onSaveActiveFile} />
          <ToolbarBtn icon={RefreshCw} title={t('toolbar.refresh')} onClick={onRefresh} />
          <ToolbarBtn icon={ChevronsDownUp} title={t('toolbar.collapseAll')} onClick={collapseAll} />
        </span>
      </div>

      {/* ── Tree ── */}
      <div
        className="flex-1 overflow-auto outline-none"
        tabIndex={0}
        onKeyDown={handleTreeKeyDown}
        onContextMenu={handleRootContextMenu}
        onDragOver={handleTreeContainerDragOver}
        onDrop={handleTreeContainerDrop}
        onDragEnd={handleDragEnd}
      >
        {tree.length === 0 && !showRootCreateInput ? (
          <div className="px-4 pt-6 text-[11px] text-[var(--text-secondary)] opacity-60">
            {t('empty')}
          </div>
        ) : (
          <>
            {tree.map((node) => (
              <TreeNodeItem
                key={node.id}
                node={node}
                depth={0}
                activeFileId={activeFileId}
                focusedId={focusedId}
                dirtyFileIds={dirtyFileIds}
                expandedIds={expandedIds}
                renamingId={renamingId}
                creating={creating}
                onToggleExpand={toggleExpand}
                onOpenFile={onOpenFile}
                onStartRename={startRename}
                onCommitRename={commitRename}
                onCancelRename={cancelRename}
                onContextMenu={handleContextMenu}
                onCommitCreate={commitCreate}
                onCancelCreate={cancelCreate}
                onClickNode={setFocusedId}
                dragState={dragState}
                onDragStart={onMoveNode ? handleDragStart : undefined}
                onDragOver={onMoveNode ? handleDragOver : undefined}
                onDragLeave={onMoveNode ? handleDragLeave : undefined}
                onDrop={onMoveNode ? handleDrop : undefined}
                onDragEnd={onMoveNode ? handleDragEnd : undefined}
              />
            ))}
            {showRootCreateInput && (
              <InlineCreateInput
                depth={0}
                type={creating.type}
                fileType={creating.fileType}
                onCommit={commitCreate}
                onCancel={cancelCreate}
              />
            )}
          </>
        )}
      </div>

      {/* ── Context Menu ── */}
      {contextMenu.open && (
        <div
          className="fixed z-50 min-w-[180px] rounded-[5px] border border-[var(--border-ide)] bg-[var(--bg-panel)] py-1 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* New file sub-items */}
          {FILE_TYPE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.fileType}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-[5px] text-[12px] text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.07)] transition-colors"
                onClick={() => {
                  const parentId = contextMenu.targetParentId;
                  closeContextMenu();
                  startCreating(parentId, 'file', opt.fileType);
                }}
              >
                <Icon size={14} className={opt.iconColor} />
                <span>{t('menu.newFile')} ({opt.labelZh})</span>
              </button>
            );
          })}

          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-[5px] text-[12px] text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.07)] transition-colors"
            onClick={() => {
              const parentId = contextMenu.targetParentId;
              closeContextMenu();
              startCreating(parentId, 'directory');
            }}
          >
            <FolderPlus size={14} className="text-[var(--text-secondary)]" />
            <span>{t('menu.newFolder')}</span>
          </button>

          {contextMenu.node && (
            <>
              <div className="my-1 h-px bg-[var(--border-ide)] mx-1" />
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-[5px] text-[12px] text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.07)] transition-colors"
                onClick={() => { closeContextMenu(); startRename(contextMenu.node!.id); }}
              >
                <Pencil size={14} className="text-[var(--text-secondary)]" />
                <span>{t('menu.rename')}</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-[5px] text-[12px] text-red-400 hover:bg-[rgba(255,255,255,0.07)] transition-colors"
                onClick={() => { closeContextMenu(); void handleDelete(contextMenu.node!.id); }}
              >
                <Trash2 size={14} />
                <span>{t('menu.delete')}</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* ── File type dropdown (toolbar + button) ── */}
      {typeDropdown && (
        <FileTypeDropdown
          top={typeDropdown.top}
          left={typeDropdown.left}
          onSelect={(ft) => startCreating(typeDropdown.parentId, 'file', ft)}
          onClose={() => setTypeDropdown(null)}
        />
      )}

      {/* ── Dialog portal ── */}
      {DialogPortal}
    </div>
  );
}
