import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  FileCode,
  FileJson,
  Folder,
  FolderOpen,
  Plus,
  FolderPlus,
  RefreshCw,
  ChevronsDownUp,
  Trash2,
  Pencil,
  Save,
  Database,
  Workflow,
  BookOpen,
} from 'lucide-react';
import type { FSTreeNode, FileType } from '@shenbi/editor-core';
import { useTranslation } from '@shenbi/i18n';
import './i18n';

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
}

function getFileIcon(fileType?: FileType) {
  switch (fileType) {
    case 'page': return FileCode;
    case 'api': return FileJson;
    case 'flow': return Workflow;
    case 'db': return Database;
    case 'dict': return BookOpen;
    default: return FileCode;
  }
}

/** Inline input row for creating new file/directory */
function InlineCreateInput({
  depth,
  type,
  onCommit,
  onCancel,
}: {
  depth: number;
  type: 'file' | 'directory';
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

  const Icon = type === 'directory' ? Folder : FileCode;

  return (
    <div
      className="relative flex items-center gap-1 px-2 py-[3px] text-[12px]"
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      {Array.from({ length: depth }, (_, i) => (
        <span
          key={i}
          className="absolute top-0 bottom-0 border-l border-border-ide"
          style={{ left: `${i * 16 + 16}px` }}
        />
      ))}
      <span className="w-[14px] shrink-0" />
      <Icon size={14} className={`shrink-0 ${type === 'directory' ? 'text-yellow-500/80' : 'text-text-secondary'}`} />
      <input
        ref={inputRef}
        className="flex-1 min-w-0 bg-bg-panel border border-blue-500 rounded px-1 py-0 text-[12px] text-text-primary outline-none"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            committedRef.current = true;
            onCancel();
          }
        }}
        onBlur={commit}
      />
    </div>
  );
}

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
  const { t } = useTranslation('pluginFiles');
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

  // Show inline create input inside this directory?
  const showCreateInput = isDir && isExpanded && creating?.parentId === node.id;

  // Scroll active item into view
  useEffect(() => {
    if (isActive && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isActive]);

  // Sync renameValue when rename starts (handles context-menu-initiated renames)
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
    if (!isRenaming) {
      onStartRename(node.id);
    }
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
    if (event.key === 'Enter') {
      event.preventDefault();
      commitOrCancel();
    } else if (event.key === 'Escape') {
      committedRef.current = true;
      onCancelRename();
    }
  };

  const handleRenameBlur = () => {
    commitOrCancel();
  };

  const Icon = isDir
    ? (isExpanded ? FolderOpen : Folder)
    : getFileIcon(node.fileType);

  const Chevron = isDir
    ? (isExpanded ? ChevronDown : ChevronRight)
    : null;

  const isDragSource = dragState?.dragNodeId === node.id;
  const dropZone = dragState?.targetNodeId === node.id ? dragState.zone : null;

  return (
    <>
      <div
        ref={rowRef}
        className={`
          relative flex items-center gap-1 px-2 py-[3px] cursor-pointer text-[12px] select-none
          ${isActive ? 'bg-blue-500/20 text-text-primary' : isDirty ? 'text-text-primary hover:bg-bg-sidebar/70' : 'text-text-secondary hover:bg-bg-sidebar/70 hover:text-text-primary'}
          ${isFocused && !isActive ? 'outline outline-1 outline-blue-500/50 -outline-offset-1' : ''}
          ${isDragSource ? 'opacity-50' : ''}
          ${dropZone === 'inside' ? 'bg-blue-500/20' : ''}
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
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
            className="absolute left-0 right-0 h-[2px] bg-blue-500 pointer-events-none"
            style={{ top: 0, marginLeft: `${depth * 16 + 8}px` }}
          />
        )}
        {dropZone === 'after' && (
          <div
            className="absolute left-0 right-0 h-[2px] bg-blue-500 pointer-events-none"
            style={{ bottom: 0, marginLeft: `${depth * 16 + 8}px` }}
          />
        )}
        {/* Indent guide lines */}
        {Array.from({ length: depth }, (_, i) => (
          <span
            key={i}
            className="absolute top-0 bottom-0 border-l border-border-ide"
            style={{ left: `${i * 16 + 16}px` }}
          />
        ))}
        {Chevron ? (
          <Chevron size={14} className="shrink-0 text-text-secondary" />
        ) : (
          <span className="w-[14px] shrink-0" />
        )}
        <Icon
          size={14}
          className={`shrink-0 ${isDir ? 'text-yellow-500/80' : (isActive ? 'text-blue-400' : 'text-text-secondary')}`}
        />
        {isRenaming ? (
          <input
            ref={inputRef}
            className="flex-1 min-w-0 bg-bg-panel border border-blue-500 rounded px-1 py-0 text-[12px] text-text-primary outline-none"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameBlur}
          />
        ) : (
          <span
            className="truncate flex-1"
            title={isDirty ? `${node.name} - ${t('unsaved', { ns: 'common' })}` : node.name}
          >
            {node.name}
            {isDirty && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-text-secondary ml-1.5 align-middle" />
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
              onCommit={onCommitCreate}
              onCancel={onCancelCreate}
            />
          )}
        </>
      )}
    </>
  );
}

interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
  node: FSTreeNode | null;
  /** The directory ID where new files should be created. null = root. */
  targetParentId: string | null;
}

export function FileExplorer({
  tree,
  activeFileId,
  dirtyFileIds,
  statusText,
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

  // Flatten visible nodes for keyboard navigation
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

  // Build parentId lookup from tree so context menu can determine the parent directory
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

  useEffect(() => {
    setExpandedIds(new Set(initialExpandedIds ?? []));
  }, [initialExpandedIds]);

  useEffect(() => {
    setFocusedId(initialFocusedId);
  }, [initialFocusedId]);

  useEffect(() => {
    onExpandedIdsChange?.([...expandedIds]);
  }, [expandedIds, onExpandedIdsChange]);

  useEffect(() => {
    onFocusedIdChange?.(focusedId);
  }, [focusedId, onFocusedIdChange]);

  useEffect(() => {
    if (!activeFileId) {
      return;
    }
    const ancestorIds: string[] = [];
    let cursor = parentLookup.get(activeFileId) ?? null;
    while (cursor) {
      ancestorIds.push(cursor);
      cursor = parentLookup.get(cursor) ?? null;
    }
    if (ancestorIds.length === 0) {
      return;
    }
    setExpandedIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of ancestorIds) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activeFileId, parentLookup]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

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

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, open: false }));
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu.open) return;
    const handleClick = () => closeContextMenu();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [closeContextMenu, contextMenu.open]);

  // Start inline creation and auto-expand target directory
  const startCreating = useCallback((parentId: string | null, type: 'file' | 'directory') => {
    setCreating({ parentId, type });
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
      onCreateFile(creating.parentId, name, 'page');
    }
    setCreating(null);
  }, [creating, onCreateDirectory, onCreateFile]);

  const cancelCreate = useCallback(() => {
    setCreating(null);
  }, []);

  const handleDelete = useCallback((nodeId: string) => {
    if (window.confirm(t('confirmDelete'))) {
      onDeleteNode(nodeId);
    }
  }, [onDeleteNode, t]);

  const startRename = useCallback((id: string) => {
    setRenamingId(id);
  }, []);

  const commitRename = useCallback((id: string, newName: string) => {
    onRenameNode(id, newName);
    setRenamingId(undefined);
  }, [onRenameNode]);

  const cancelRename = useCallback(() => {
    setRenamingId(undefined);
  }, []);

  // Keyboard navigation
  const handleTreeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (renamingId || creating) return; // don't interfere with inline inputs
    const nodes = flatVisibleNodes;
    if (nodes.length === 0) return;

    const currentIndex = focusedId ? nodes.findIndex((n) => n.id === focusedId) : -1;
    const currentNode = currentIndex >= 0 ? nodes[currentIndex] : undefined;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const nextIdx = Math.min(currentIndex + 1, nodes.length - 1);
        const next = nodes[nextIdx];
        if (next) setFocusedId(next.id);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prevIdx = currentIndex <= 0 ? 0 : currentIndex - 1;
        const prev = nodes[prevIdx];
        if (prev) setFocusedId(prev.id);
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        if (!currentNode) break;
        if (currentNode.type === 'directory') {
          if (!expandedIds.has(currentNode.id)) {
            toggleExpand(currentNode.id);
          } else {
            const firstChild = currentNode.children?.[0];
            if (firstChild) setFocusedId(firstChild.id);
          }
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        if (!currentNode) break;
        if (currentNode.type === 'directory' && expandedIds.has(currentNode.id)) {
          toggleExpand(currentNode.id);
        } else {
          const pid = parentLookup.get(currentNode.id);
          if (pid) setFocusedId(pid);
        }
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (!currentNode) break;
        if (currentNode.type === 'directory') {
          toggleExpand(currentNode.id);
        } else {
          onOpenFile(currentNode.id);
        }
        break;
      }
      case 'F2': {
        e.preventDefault();
        if (currentNode) startRename(currentNode.id);
        break;
      }
      case 'Delete': {
        e.preventDefault();
        if (currentNode) handleDelete(currentNode.id);
        break;
      }
    }
  }, [flatVisibleNodes, focusedId, renamingId, creating, expandedIds, parentLookup, toggleExpand, onOpenFile, startRename, handleDelete]);

  // Build siblingsMap: parentId -> ordered children list
  const siblingsMap = useMemo(() => {
    const map = new Map<string | null, FSTreeNode[]>();
    const walk = (nodes: FSTreeNode[], parentId: string | null) => {
      map.set(parentId, nodes);
      for (const n of nodes) {
        if (n.children) walk(n.children, n.id);
      }
    };
    walk(tree, null);
    return map;
  }, [tree]);

  // Check if nodeId is an ancestor of candidateDescendantId
  const isAncestor = useCallback((nodeId: string, candidateDescendantId: string): boolean => {
    let cursor: string | null = candidateDescendantId;
    while (cursor !== null) {
      if (cursor === nodeId) return true;
      cursor = parentLookup.get(cursor) ?? null;
    }
    return false;
  }, [parentLookup]);

  const clearAutoExpandTimer = useCallback(() => {
    if (autoExpandTimerRef.current !== undefined) {
      clearTimeout(autoExpandTimerRef.current);
      autoExpandTimerRef.current = undefined;
    }
  }, []);

  const updateDragState = useCallback((next: DragState | null) => {
    dragStateRef.current = next;
    setDragState(next);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, nodeId: string) => {
    if (renamingId || creating) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', nodeId);
    updateDragState({ dragNodeId: nodeId, targetNodeId: null, zone: 'before' });
  }, [renamingId, creating, updateDragState]);

  const handleDragOver = useCallback((e: React.DragEvent, node: FSTreeNode, isExpanded: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    const ds = dragStateRef.current;
    if (!ds) return;

    // Cannot drop on self or own descendant
    if (node.id === ds.dragNodeId || isAncestor(ds.dragNodeId, node.id)) {
      e.dataTransfer.dropEffect = 'none';
      if (ds.targetNodeId !== null) {
        updateDragState({ ...ds, targetNodeId: null });
      }
      clearAutoExpandTimer();
      return;
    }

    e.dataTransfer.dropEffect = 'move';

    // Calculate drop zone
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;
    const ratio = y / h;

    let zone: DropZone;
    const isDir = node.type === 'directory';
    if (!isDir) {
      zone = ratio < 0.5 ? 'before' : 'after';
    } else if (isExpanded) {
      zone = ratio < 0.3 ? 'before' : 'inside';
    } else {
      zone = ratio < 0.3 ? 'before' : ratio > 0.7 ? 'after' : 'inside';
    }

    // Auto-expand collapsed directory on hover
    if (zone === 'inside' && isDir && !isExpanded) {
      if (ds.targetNodeId !== node.id || ds.zone !== 'inside') {
        clearAutoExpandTimer();
        autoExpandTimerRef.current = window.setTimeout(() => {
          setExpandedIds((prev) => {
            if (prev.has(node.id)) return prev;
            const next = new Set(prev);
            next.add(node.id);
            return next;
          });
        }, 600);
      }
    } else if (ds.targetNodeId !== node.id || ds.zone !== zone) {
      clearAutoExpandTimer();
    }

    // Only update state if something changed
    if (ds.targetNodeId !== node.id || ds.zone !== zone) {
      updateDragState({ ...ds, targetNodeId: node.id, zone });
    }
  }, [isAncestor, clearAutoExpandTimer, updateDragState]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Ignore if moving to a child element
    if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
    clearAutoExpandTimer();
  }, [clearAutoExpandTimer]);

  const handleDrop = useCallback((e: React.DragEvent, targetNode: FSTreeNode, _isExpanded: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    clearAutoExpandTimer();
    const ds = dragStateRef.current;
    if (!ds || !onMoveNode) {
      updateDragState(null);
      return;
    }

    const { dragNodeId, zone } = ds;
    if (targetNode.id === dragNodeId || isAncestor(dragNodeId, targetNode.id)) {
      updateDragState(null);
      return;
    }

    let newParentId: string | null;
    let afterNodeId: string | null;

    if (zone === 'inside') {
      newParentId = targetNode.id;
      afterNodeId = null; // place first
    } else {
      // before or after: same parent as target
      newParentId = parentLookup.get(targetNode.id) ?? null;
      const siblings = siblingsMap.get(newParentId) ?? [];

      if (zone === 'before') {
        const idx = siblings.findIndex((n) => n.id === targetNode.id);
        const prevSibling = idx > 0 ? siblings[idx - 1] : undefined;
        afterNodeId = prevSibling ? prevSibling.id : null;
      } else {
        // after
        afterNodeId = targetNode.id;
      }
    }

    // No-op check: same parent and same position
    const currentParentId = parentLookup.get(dragNodeId) ?? null;
    if (currentParentId === newParentId) {
      const siblings = siblingsMap.get(newParentId) ?? [];
      const dragIdx = siblings.findIndex((n) => n.id === dragNodeId);
      if (afterNodeId === null && dragIdx === 0) {
        updateDragState(null);
        return;
      }
      if (afterNodeId !== null) {
        const afterIdx = siblings.findIndex((n) => n.id === afterNodeId);
        if (afterIdx === dragIdx - 1 || afterIdx === dragIdx) {
          updateDragState(null);
          return;
        }
      }
    }

    onMoveNode(dragNodeId, newParentId, afterNodeId);
    updateDragState(null);
  }, [onMoveNode, parentLookup, siblingsMap, isAncestor, clearAutoExpandTimer, updateDragState]);

  const handleDragEnd = useCallback((_e: React.DragEvent) => {
    clearAutoExpandTimer();
    updateDragState(null);
  }, [clearAutoExpandTimer, updateDragState]);

  // Handle drop on empty area = move to root end
  const handleTreeContainerDragOver = useCallback((e: React.DragEvent) => {
    if (!dragStateRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleTreeContainerDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    clearAutoExpandTimer();
    const ds = dragStateRef.current;
    if (!ds || !onMoveNode) {
      updateDragState(null);
      return;
    }
    const { dragNodeId } = ds;
    const rootSiblings = siblingsMap.get(null) ?? [];
    const lastRoot = rootSiblings.length > 0 ? rootSiblings[rootSiblings.length - 1] : null;
    const afterNodeId = lastRoot ? lastRoot.id : null;

    // No-op: already last root node
    const currentParentId = parentLookup.get(dragNodeId) ?? null;
    if (currentParentId === null && lastRoot?.id === dragNodeId) {
      updateDragState(null);
      return;
    }

    onMoveNode(dragNodeId, null, afterNodeId);
    updateDragState(null);
  }, [onMoveNode, siblingsMap, parentLookup, clearAutoExpandTimer, updateDragState]);

  // Show root-level inline create input?
  const showRootCreateInput = creating && creating.parentId === null;

  return (
    <div className="h-full flex flex-col text-xs text-text-primary" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border-ide">
        <span className="text-[11px] text-text-secondary font-medium uppercase tracking-wide flex-1">{t('title')}</span>
        <button
          type="button"
          className="p-1 rounded hover:bg-bg-activity-bar text-text-secondary hover:text-text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          title={t('toolbar.saveCurrentFile')}
          onClick={onSaveActiveFile}
          disabled={!canSaveActiveFile || !onSaveActiveFile}
        >
          <Save size={14} />
        </button>
        <button
          type="button"
          className="p-1 rounded hover:bg-bg-activity-bar text-text-secondary hover:text-text-primary transition-colors"
          title={t('toolbar.newFile')}
          onClick={() => startCreating(null, 'file')}
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          className="p-1 rounded hover:bg-bg-activity-bar text-text-secondary hover:text-text-primary transition-colors"
          title={t('toolbar.newFolder')}
          onClick={() => startCreating(null, 'directory')}
        >
          <FolderPlus size={14} />
        </button>
        <button
          type="button"
          className="p-1 rounded hover:bg-bg-activity-bar text-text-secondary hover:text-text-primary transition-colors"
          title={t('toolbar.refresh')}
          onClick={onRefresh}
        >
          <RefreshCw size={14} />
        </button>
        <button
          type="button"
          className="p-1 rounded hover:bg-bg-activity-bar text-text-secondary hover:text-text-primary transition-colors"
          title={t('toolbar.collapseAll')}
          onClick={collapseAll}
        >
          <ChevronsDownUp size={14} />
        </button>
      </div>
      <div className="px-2 py-1 border-b border-border-ide text-[11px] text-text-secondary">
        {statusText ?? t('status.noActiveFile')}
      </div>

      {/* Tree */}
      <div
        className="flex-1 overflow-auto py-1 outline-none"
        tabIndex={0}
        onKeyDown={handleTreeKeyDown}
        onContextMenu={handleRootContextMenu}
        onDragOver={handleTreeContainerDragOver}
        onDrop={handleTreeContainerDrop}
        onDragEnd={handleDragEnd}
      >
        {tree.length === 0 && !showRootCreateInput ? (
          <div className="px-3 py-4 text-center text-[11px] text-text-secondary">
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
                onCommit={commitCreate}
                onCancel={cancelCreate}
              />
            )}
          </>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.open && (
        <div
          className="fixed z-50 min-w-[160px] rounded border border-border-ide bg-bg-panel shadow-lg py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            className="w-full px-3 py-1.5 text-left text-[12px] text-text-primary hover:bg-bg-activity-bar flex items-center gap-2"
            onClick={() => {
              const parentId = contextMenu.targetParentId;
              closeContextMenu();
              startCreating(parentId, 'file');
            }}
          >
            <Plus size={13} /> {t('menu.newFile')}
          </button>
          <button
            type="button"
            className="w-full px-3 py-1.5 text-left text-[12px] text-text-primary hover:bg-bg-activity-bar flex items-center gap-2"
            onClick={() => {
              const parentId = contextMenu.targetParentId;
              closeContextMenu();
              startCreating(parentId, 'directory');
            }}
          >
            <FolderPlus size={13} /> {t('menu.newFolder')}
          </button>
          {contextMenu.node && (
            <>
              <div className="border-t border-border-ide my-1" />
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-[12px] text-text-primary hover:bg-bg-activity-bar flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  startRename(contextMenu.node!.id);
                }}
              >
                <Pencil size={13} /> {t('menu.rename')}
              </button>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-[12px] text-red-400 hover:bg-bg-activity-bar flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  handleDelete(contextMenu.node!.id);
                }}
              >
                <Trash2 size={13} /> {t('menu.delete')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
