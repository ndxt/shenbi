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
  Database,
  Workflow,
  BookOpen,
} from 'lucide-react';
import type { FSTreeNode, FileType } from '@shenbi/editor-core';

export interface FileExplorerProps {
  tree: FSTreeNode[];
  activeFileId: string | undefined;
  onOpenFile: (fileId: string) => void;
  onCreateFile: (parentId: string | null, name: string, fileType: FileType) => void;
  onCreateDirectory: (parentId: string | null, name: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onRenameNode: (nodeId: string, newName: string) => void;
  onRefresh: () => void;
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

interface TreeNodeItemProps {
  node: FSTreeNode;
  depth: number;
  activeFileId: string | undefined;
  expandedIds: Set<string>;
  renamingId: string | undefined;
  onToggleExpand: (id: string) => void;
  onOpenFile: (fileId: string) => void;
  onStartRename: (id: string) => void;
  onCommitRename: (id: string, newName: string) => void;
  onCancelRename: () => void;
  onContextMenu: (event: React.MouseEvent, node: FSTreeNode) => void;
}

function TreeNodeItem({
  node,
  depth,
  activeFileId,
  expandedIds,
  renamingId,
  onToggleExpand,
  onOpenFile,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onContextMenu,
}: TreeNodeItemProps) {
  const isDir = node.type === 'directory';
  const isExpanded = expandedIds.has(node.id);
  const isActive = node.id === activeFileId;
  const isRenaming = renamingId === node.id;
  const inputRef = useRef<HTMLInputElement>(null);
  const [renameValue, setRenameValue] = useState(node.name);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleClick = () => {
    if (isDir) {
      onToggleExpand(node.id);
    } else {
      onOpenFile(node.id);
    }
  };

  const handleDoubleClick = () => {
    if (!isRenaming) {
      onStartRename(node.id);
      setRenameValue(node.name);
    }
  };

  const handleRenameKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (renameValue.trim() && renameValue.trim() !== node.name) {
        onCommitRename(node.id, renameValue.trim());
      } else {
        onCancelRename();
      }
    } else if (event.key === 'Escape') {
      onCancelRename();
    }
  };

  const handleRenameBlur = () => {
    if (renameValue.trim() && renameValue.trim() !== node.name) {
      onCommitRename(node.id, renameValue.trim());
    } else {
      onCancelRename();
    }
  };

  const Icon = isDir
    ? (isExpanded ? FolderOpen : Folder)
    : getFileIcon(node.fileType);

  const Chevron = isDir
    ? (isExpanded ? ChevronDown : ChevronRight)
    : null;

  return (
    <>
      <div
        className={`
          flex items-center gap-1 px-2 py-[3px] cursor-pointer text-[12px] select-none
          ${isActive ? 'bg-blue-500/20 text-text-primary' : 'text-text-secondary hover:bg-bg-sidebar/70 hover:text-text-primary'}
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
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
          <span className="truncate flex-1">{node.name}</span>
        )}
      </div>
      {isDir && isExpanded && node.children?.map((child) => (
        <TreeNodeItem
          key={child.id}
          node={child}
          depth={depth + 1}
          activeFileId={activeFileId}
          expandedIds={expandedIds}
          renamingId={renamingId}
          onToggleExpand={onToggleExpand}
          onOpenFile={onOpenFile}
          onStartRename={onStartRename}
          onCommitRename={onCommitRename}
          onCancelRename={onCancelRename}
          onContextMenu={onContextMenu}
        />
      ))}
    </>
  );
}

interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
  node: FSTreeNode | null;
}

export function FileExplorer({
  tree,
  activeFileId,
  onOpenFile,
  onCreateFile,
  onCreateDirectory,
  onDeleteNode,
  onRenameNode,
  onRefresh,
}: FileExplorerProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | undefined>();
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    open: false, x: 0, y: 0, node: null,
  });
  const containerRef = useRef<HTMLDivElement>(null);

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
    setContextMenu({ open: true, x: event.clientX, y: event.clientY, node });
  }, []);

  const handleRootContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ open: true, x: event.clientX, y: event.clientY, node: null });
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

  const handleNewFile = useCallback((parentId: string | null) => {
    const name = window.prompt('文件名：');
    if (!name?.trim()) return;
    onCreateFile(parentId, name.trim(), 'page');
  }, [onCreateFile]);

  const handleNewDirectory = useCallback((parentId: string | null) => {
    const name = window.prompt('文件夹名：');
    if (!name?.trim()) return;
    onCreateDirectory(parentId, name.trim());
  }, [onCreateDirectory]);

  const handleDelete = useCallback((nodeId: string) => {
    if (window.confirm('确定删除？')) {
      onDeleteNode(nodeId);
    }
  }, [onDeleteNode]);

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

  return (
    <div className="h-full flex flex-col text-xs text-text-primary" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border-ide">
        <span className="text-[11px] text-text-secondary font-medium uppercase tracking-wide flex-1">文件</span>
        <button
          type="button"
          className="p-1 rounded hover:bg-bg-activity-bar text-text-secondary hover:text-text-primary transition-colors"
          title="新建文件"
          onClick={() => handleNewFile(null)}
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          className="p-1 rounded hover:bg-bg-activity-bar text-text-secondary hover:text-text-primary transition-colors"
          title="新建文件夹"
          onClick={() => handleNewDirectory(null)}
        >
          <FolderPlus size={14} />
        </button>
        <button
          type="button"
          className="p-1 rounded hover:bg-bg-activity-bar text-text-secondary hover:text-text-primary transition-colors"
          title="刷新"
          onClick={onRefresh}
        >
          <RefreshCw size={14} />
        </button>
        <button
          type="button"
          className="p-1 rounded hover:bg-bg-activity-bar text-text-secondary hover:text-text-primary transition-colors"
          title="全部折叠"
          onClick={collapseAll}
        >
          <ChevronsDownUp size={14} />
        </button>
      </div>

      {/* Tree */}
      <div
        className="flex-1 overflow-auto py-1"
        onContextMenu={handleRootContextMenu}
      >
        {tree.length === 0 ? (
          <div className="px-3 py-4 text-center text-[11px] text-text-secondary">
            暂无文件，点击上方按钮创建
          </div>
        ) : (
          tree.map((node) => (
            <TreeNodeItem
              key={node.id}
              node={node}
              depth={0}
              activeFileId={activeFileId}
              expandedIds={expandedIds}
              renamingId={renamingId}
              onToggleExpand={toggleExpand}
              onOpenFile={onOpenFile}
              onStartRename={startRename}
              onCommitRename={commitRename}
              onCancelRename={cancelRename}
              onContextMenu={handleContextMenu}
            />
          ))
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
              closeContextMenu();
              const parentId = contextMenu.node?.type === 'directory' ? contextMenu.node.id : null;
              handleNewFile(parentId);
            }}
          >
            <Plus size={13} /> 新建文件
          </button>
          <button
            type="button"
            className="w-full px-3 py-1.5 text-left text-[12px] text-text-primary hover:bg-bg-activity-bar flex items-center gap-2"
            onClick={() => {
              closeContextMenu();
              const parentId = contextMenu.node?.type === 'directory' ? contextMenu.node.id : null;
              handleNewDirectory(parentId);
            }}
          >
            <FolderPlus size={13} /> 新建文件夹
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
                <Pencil size={13} /> 重命名
              </button>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-[12px] text-red-400 hover:bg-bg-activity-bar flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  handleDelete(contextMenu.node!.id);
                }}
              >
                <Trash2 size={13} /> 删除
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
