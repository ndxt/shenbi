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
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          <div
            style={{ position: 'relative', zIndex: 10, width: 340, borderRadius: 8, border: '1px solid #454545', background: '#252526', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', overflow: 'hidden' }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleOk(); else if (e.key === 'Escape') handleCancel(); }}
          >
            <div style={{ padding: '20px 24px 16px' }}>
              <p style={{ fontSize: 13, color: '#cccccc', lineHeight: 1.6, margin: 0 }}>{dlg.message}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '12px 24px', background: '#1e1e1e' }}>
              <DialogButton label="取消" onClick={handleCancel} />
              <DialogButton label="确认" onClick={handleOk} primary autoFocus />
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return { confirm, DialogPortal };
}

// Dialog button with inline hover
function DialogButton({ label, onClick, primary, autoFocus }: { label: string; onClick: () => void; primary?: boolean; autoFocus?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      autoFocus={autoFocus}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 28, borderRadius: 4, padding: '0 16px', fontSize: 13, border: 'none', cursor: 'pointer',
        transition: 'background 0.15s, color 0.15s',
        ...(primary
          ? { background: hover ? '#1a8cd8' : '#007acc', color: '#fff' }
          : { background: hover ? 'rgba(255,255,255,0.1)' : 'transparent', color: hover ? '#fff' : '#cccccc' }),
      }}
    >
      {label}
    </button>
  );
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

// Returns CSS color string for inline style (not a Tailwind class)
function getFileIconColorValue(fileType?: FileType, isActive?: boolean): string {
  if (isActive) return '#60a5fa';
  switch (fileType) {
    case 'page': return '#519aba';
    case 'api': return '#4ade80';
    case 'flow': return '#c084fc';
    case 'db': return '#facc15';
    case 'dict': return '#fb923c';
    default: return '#519aba';
  }
}

// Helper: returns inline color for file type icons
function getFileTypeColor(fileType: FileType): string {
  switch (fileType) {
    case 'page': return '#519aba';
    case 'api': return '#4ade80';
    case 'flow': return '#c084fc';
    case 'db': return '#facc15';
    case 'dict': return '#fb923c';
    default: return '#519aba';
  }
}

// Reusable context menu item with inline hover
function MenuItemBtn({ children, onClick, danger }: { children: React.ReactNode; onClick?: () => void; danger?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '5px 12px',
        fontSize: 12, border: 'none', cursor: 'pointer', textAlign: 'left',
        color: hover ? '#fff' : (danger ? '#f87171' : '#cccccc'),
        background: hover ? '#04395e' : 'transparent',
        transition: 'background 0.1s, color 0.1s',
      }}
    >
      {children}
    </button>
  );
}


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
      style={{ position: 'fixed', zIndex: 50, minWidth: 160, borderRadius: 5, border: '1px solid #454545', background: '#252526', padding: '4px 0', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', top, left }}
    >
      {FILE_TYPE_OPTIONS.map((opt) => (
        <MenuItemBtn key={opt.fileType} onClick={() => { onSelect(opt.fileType); onClose(); }}>
          <opt.icon size={14} style={{ color: getFileTypeColor(opt.fileType) }} />
          <span>{opt.labelZh}</span>
        </MenuItemBtn>
      ))}
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
  const iconColorValue = type === 'directory' ? '#e8c17a' : getFileIconColorValue(fileType);

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
      <Icon size={14} style={{ flexShrink: 0, color: iconColorValue }} />
      <input
        ref={inputRef}
        className="flex-1 min-w-0 outline-none"
        style={{ height: 20, borderRadius: 2, border: '1px solid #007acc', background: 'var(--bg-panel)', padding: '0 4px', fontSize: 12, color: 'var(--text-primary)' }}
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

  // Row hover state
  const [rowHover, setRowHover] = useState(false);

  // VS Code row style
  const rowBgColor = isActive
    ? '#37373d'
    : dropZone === 'inside'
    ? '#2a2d2e'
    : (rowHover && !isDragSource)
    ? '#2a2d2e'
    : 'transparent';

  const textColor = isActive
    ? 'var(--text-primary)'
    : isDirty
    ? 'var(--text-primary)'
    : 'var(--text-secondary)';

  return (
    <>
      <div
        ref={rowRef}
        className="relative flex cursor-pointer select-none items-center"
        style={{
          height: 22, fontSize: 13,
          paddingLeft: depth * 16 + 4,
          background: rowBgColor,
          color: textColor,
          opacity: isDragSource ? 0.4 : 1,
          outline: isFocused && !isActive ? '1px solid rgba(0,122,204,0.5)' : 'none',
          outlineOffset: -1,
          transition: 'background 0.1s',
        }}
        draggable={!isRenaming && !!onDragStart}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
        onMouseEnter={() => setRowHover(true)}
        onMouseLeave={() => setRowHover(false)}
        onDragStart={(e) => onDragStart?.(e, node.id)}
        onDragOver={(e) => onDragOver?.(e, node, isExpanded)}
        onDragLeave={(e) => onDragLeave?.(e)}
        onDrop={(e) => onDrop?.(e, node, isExpanded)}
        onDragEnd={(e) => onDragEnd?.(e)}
      >
        {dropZone === 'before' && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, background: '#007acc', marginLeft: depth * 16 + 4, pointerEvents: 'none' }} />
        )}
        {dropZone === 'after' && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: '#007acc', marginLeft: depth * 16 + 4, pointerEvents: 'none' }} />
        )}

        {/* Indent guide lines */}
        {Array.from({ length: depth }, (_, i) => (
          <span
            key={i}
            style={{ position: 'absolute', top: 0, bottom: 0, width: 1, left: i * 16 + 16, background: 'var(--border-ide)', opacity: rowHover ? 0.6 : 0, transition: 'opacity 0.15s' }}
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

        <Icon
          size={16}
          style={{
            marginRight: 6, flexShrink: 0,
            color: isDir
              ? (isExpanded ? '#dcb67a' : '#e8c17a')
              : getFileIconColorValue(node.fileType, isActive),
          }}
        />

        {/* Name / rename input */}
        {isRenaming ? (
          <input
            ref={inputRef}
            className="flex-1 min-w-0 outline-none"
            style={{ height: 16, borderRadius: 2, border: '1px solid #007acc', background: 'var(--bg-panel)', padding: '0 4px', fontSize: 12, color: 'var(--text-primary)' }}
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
        {!isRenaming && isDir && rowHover && (
          <span className="ml-auto flex items-center gap-0.5 px-1">
            <span
              style={{ display: 'flex', height: 18, width: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 4, cursor: 'pointer', color: 'var(--text-secondary)' }}
              title="新建文件"
              onClick={(e) => { e.stopPropagation(); onContextMenu(e as unknown as React.MouseEvent, node); }}
            >
              <FolderPlus size={13} />
            </span>
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
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', height: 22, width: 22, alignItems: 'center', justifyContent: 'center',
        borderRadius: 4, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        color: hover && !disabled ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: hover && !disabled ? 'rgba(255,255,255,0.1)' : 'transparent',
        opacity: disabled ? 0.3 : 1,
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      <Icon size={15} />
    </button>
  );
}

// ─── Context Menu Panel with state-based submenu ────────────────────────────

function ContextMenuPanel({
  contextMenu,
  closeContextMenu,
  startCreating,
  startRename,
  handleDelete,
  t,
}: {
  contextMenu: ContextMenuState;
  closeContextMenu: () => void;
  startCreating: (parentId: string | null, type: 'file' | 'directory', fileType?: FileType | undefined) => void;
  startRename: (id: string) => void;
  handleDelete: (id: string) => void;
  t: (key: string) => string;
}) {
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const submenuTimer = useRef<number | undefined>(undefined);

  const openSubmenu = () => { clearTimeout(submenuTimer.current); setSubmenuOpen(true); };
  const closeSubmenu = () => { submenuTimer.current = window.setTimeout(() => setSubmenuOpen(false), 150); };
  const keepSubmenu = () => { clearTimeout(submenuTimer.current); };

  const panelStyle: React.CSSProperties = {
    position: 'fixed', zIndex: 50, minWidth: 200, borderRadius: 5,
    border: '1px solid #454545', background: '#252526',
    padding: '4px 0', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    left: contextMenu.x, top: contextMenu.y,
  };

  const subStyle: React.CSSProperties = {
    position: 'absolute', left: 'calc(100% - 2px)', top: 0, minWidth: 200, borderRadius: 5,
    border: '1px solid #454545', background: '#252526',
    padding: '4px 0', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  };

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
      {/* New File -> submenu */}
      <div style={{ position: 'relative' }} onMouseEnter={openSubmenu} onMouseLeave={closeSubmenu}>
        <MenuItemBtn>
          <FilePlus size={14} style={{ color: '#999' }} />
          <span style={{ flex: 1 }}>{t('menu.newFile')}</span>
          <ChevronRight size={14} style={{ color: '#999' }} />
        </MenuItemBtn>
        {submenuOpen && (
          <div style={subStyle} onMouseEnter={keepSubmenu} onMouseLeave={closeSubmenu}>
            {FILE_TYPE_OPTIONS.map((opt) => (
              <MenuItemBtn key={opt.fileType} onClick={() => { closeContextMenu(); startCreating(contextMenu.targetParentId, 'file', opt.fileType); }}>
                <opt.icon size={14} style={{ color: getFileTypeColor(opt.fileType) }} />
                <span>{opt.labelZh}</span>
              </MenuItemBtn>
            ))}
          </div>
        )}
      </div>

      <MenuItemBtn onClick={() => { closeContextMenu(); startCreating(contextMenu.targetParentId, 'directory'); }}>
        <FolderPlus size={14} style={{ color: '#999' }} />
        <span>{t('menu.newFolder')}</span>
      </MenuItemBtn>

      {contextMenu.node && (
        <>
          <div style={{ margin: '4px 4px', height: 1, background: '#454545' }} />
          <MenuItemBtn onClick={() => { closeContextMenu(); startRename(contextMenu.node!.id); }}>
            <Pencil size={14} style={{ color: '#999' }} />
            <span>{t('menu.rename')}</span>
          </MenuItemBtn>
          <MenuItemBtn danger onClick={() => { closeContextMenu(); void handleDelete(contextMenu.node!.id); }}>
            <Trash2 size={14} />
            <span>{t('menu.delete')}</span>
          </MenuItemBtn>
        </>
      )}
    </div>
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
  const [toolbarHover, setToolbarHover] = useState(false);

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
      <div
        className="flex items-center px-3 gap-0.5"
        style={{ paddingTop: 10, paddingBottom: 4 }}
      >
        <span className="flex-1 select-none" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', opacity: 0.7 }}>
          {t('title')}
        </span>
        <span className="flex items-center gap-0.5">
          <button
            ref={newFileBtnRef}
            type="button"
            title={t('toolbar.newFile')}
            onClick={() => {
              const rect = newFileBtnRef.current?.getBoundingClientRect();
              if (rect) setTypeDropdown({ top: rect.bottom + 4, left: rect.left, parentId: null });
            }}
            style={{
              display: 'flex', height: 22, width: 22, alignItems: 'center', justifyContent: 'center',
              borderRadius: 4, border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', background: 'transparent', transition: 'background 0.15s, color 0.15s',
            }}
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
        <ContextMenuPanel
          contextMenu={contextMenu}
          closeContextMenu={closeContextMenu}
          startCreating={startCreating}
          startRename={startRename}
          handleDelete={handleDelete}
          t={t}
        />
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
