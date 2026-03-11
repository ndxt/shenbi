import type { FSNodeMetadata, FSTreeNode } from './file-storage';

interface InternalTreeNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  fileType?: string | undefined;
  path: string;
  children: InternalTreeNode[] | undefined;
  _sortOrder: number;
}

/**
 * Build a nested FSTreeNode tree from a flat list of FSNodeMetadata.
 * Directories come first, sorted by sortOrder then name.
 */
export function buildFSTree(nodes: FSNodeMetadata[]): FSTreeNode[] {
  const nodeMap = new Map<string, InternalTreeNode>();
  const childrenMap = new Map<string | null, InternalTreeNode[]>();

  for (const meta of nodes) {
    const treeNode: InternalTreeNode = {
      id: meta.id,
      name: meta.name,
      type: meta.type,
      path: meta.path,
      fileType: meta.fileType,
      children: meta.type === 'directory' ? [] : undefined,
      _sortOrder: meta.sortOrder ?? 0,
    };
    nodeMap.set(meta.id, treeNode);

    const parentKey = meta.parentId;
    if (!childrenMap.has(parentKey)) {
      childrenMap.set(parentKey, []);
    }
    childrenMap.get(parentKey)!.push(treeNode);
  }

  const sortChildren = (children: InternalTreeNode[]) => {
    children.sort((a, b) => {
      // directories first
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      if (a._sortOrder !== b._sortOrder) {
        return a._sortOrder - b._sortOrder;
      }
      return a.name.localeCompare(b.name);
    });
  };

  // Wire children
  for (const [parentId, children] of childrenMap) {
    sortChildren(children);
    if (parentId !== null) {
      const parent = nodeMap.get(parentId);
      if (parent && parent.children) {
        parent.children = children;
      }
    }
  }

  const roots = childrenMap.get(null) ?? [];
  sortChildren(roots);

  // Convert to FSTreeNode (strip _sortOrder)
  const toFSTreeNode = (node: InternalTreeNode): FSTreeNode => {
    const result: FSTreeNode = {
      id: node.id,
      name: node.name,
      type: node.type,
      path: node.path,
    };
    if (node.fileType) {
      result.fileType = node.fileType as FSTreeNode['fileType'];
    }
    if (node.children) {
      result.children = node.children.map(toFSTreeNode);
    }
    return result;
  };

  return roots.map(toFSTreeNode);
}
