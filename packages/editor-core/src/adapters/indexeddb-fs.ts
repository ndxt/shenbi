import type {
  FileContent,
  FileType,
  FSNodeMetadata,
} from './file-storage';
import { FILE_TYPE_EXTENSIONS as EXTENSIONS } from './file-storage';
import type { VirtualFileSystemAdapter } from './virtual-fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function dbName(projectId: string): string {
  return `shenbi-vfs-${projectId}`;
}

function openDB(name: string, version = 1): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('fs_nodes')) {
        const nodeStore = db.createObjectStore('fs_nodes', { keyPath: 'id' });
        nodeStore.createIndex('by-parent', 'parentId', { unique: false });
        nodeStore.createIndex('by-path', 'path', { unique: true });
      }
      if (!db.objectStoreNames.contains('fs_content')) {
        db.createObjectStore('fs_content', { keyPath: 'fileId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(
  db: IDBDatabase,
  storeNames: string | string[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    let result: T;
    let resolved = false;

    const maybeResult = fn(transaction);

    if (maybeResult instanceof IDBRequest) {
      maybeResult.onsuccess = () => {
        result = maybeResult.result;
      };
      maybeResult.onerror = () => reject(maybeResult.error);
    } else {
      void (maybeResult as Promise<T>).then((value) => {
        result = value;
      }).catch(reject);
    }

    transaction.oncomplete = () => {
      resolved = true;
      resolve(result);
    };
    transaction.onerror = () => {
      if (!resolved) reject(transaction.error);
    };
    transaction.onabort = () => {
      if (!resolved) reject(transaction.error ?? new Error('Transaction aborted'));
    };
  });
}

function getAll<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

function getAllByIndex<T>(store: IDBObjectStore, indexName: string, key: IDBValidKey): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = store.index(indexName).getAll(key);
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

function getByKey<T>(store: IDBObjectStore, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

function getByIndex<T>(store: IDBObjectStore, indexName: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = store.index(indexName).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

function putRecord(store: IDBObjectStore, record: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function deleteRecord(store: IDBObjectStore, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// Legacy localStorage cleanup
// ---------------------------------------------------------------------------

function removeLegacyFiles(): void {
  if (typeof localStorage === 'undefined') return;
  const keysToRemove: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) {
      continue;
    }
    if (key === 'shenbi-editor-files' || key.startsWith('shenbi-editor-file:')) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}

// ---------------------------------------------------------------------------
// IndexedDBFileSystemAdapter
// ---------------------------------------------------------------------------

export class IndexedDBFileSystemAdapter implements VirtualFileSystemAdapter {
  private dbCache = new Map<string, IDBDatabase>();

  private async getDB(projectId: string): Promise<IDBDatabase> {
    const cached = this.dbCache.get(projectId);
    if (cached) return cached;
    const db = await openDB(dbName(projectId));
    this.dbCache.set(projectId, db);
    return db;
  }

  async initialize(projectId: string): Promise<void> {
    const db = await this.getDB(projectId);

    // Check if there are any nodes already
    const existingNodes = await tx<FSNodeMetadata[]>(
      db, 'fs_nodes', 'readonly',
      (transaction) => {
        const store = transaction.objectStore('fs_nodes');
        return getAll(store);
      },
    );

    if (existingNodes.length > 0) {
      removeLegacyFiles();
      return; // already initialized
    }
    removeLegacyFiles();
  }

  async listTree(projectId: string): Promise<FSNodeMetadata[]> {
    const db = await this.getDB(projectId);
    return tx<FSNodeMetadata[]>(db, 'fs_nodes', 'readonly', (transaction) => {
      const store = transaction.objectStore('fs_nodes');
      return getAll(store);
    });
  }

  async createFile(
    projectId: string,
    parentId: string | null,
    name: string,
    fileType: FileType,
    content: FileContent,
  ): Promise<FSNodeMetadata> {
    const db = await this.getDB(projectId);
    const now = Date.now();
    const nodeId = generateId();
    const parentPath = parentId ? await this.getNodePath(db, parentId) : '';
    const ext = EXTENSIONS[fileType] ?? EXTENSIONS.page;
    const path = `${parentPath}/${name}${ext}`;
    const size = JSON.stringify(content).length;

    const node: FSNodeMetadata = {
      id: nodeId,
      name,
      type: 'file',
      fileType,
      parentId,
      path,
      createdAt: now,
      updatedAt: now,
      size,
    };

    const transaction = db.transaction(['fs_nodes', 'fs_content'], 'readwrite');
    transaction.objectStore('fs_nodes').put(node);
    transaction.objectStore('fs_content').put({
      fileId: nodeId,
      content,
      updatedAt: now,
    });

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB createFile transaction error'));
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB createFile transaction aborted'));
    });

    return node;
  }

  async readFile(projectId: string, fileId: string): Promise<FileContent> {
    const db = await this.getDB(projectId);
    const record = await tx<{ fileId: string; content: FileContent } | undefined>(
      db, 'fs_content', 'readonly',
      (transaction) => {
        const store = transaction.objectStore('fs_content');
        return getByKey(store, fileId);
      },
    );
    if (!record) {
      throw new Error(`File content not found: ${fileId}`);
    }
    return record.content;
  }

  async writeFile(projectId: string, fileId: string, content: FileContent): Promise<void> {
    const db = await this.getDB(projectId);
    const now = Date.now();
    const size = JSON.stringify(content).length;

    const transaction = db.transaction(['fs_nodes', 'fs_content'], 'readwrite');
    const nodeStore = transaction.objectStore('fs_nodes');

    // Update node metadata -- use IDBRequest callback to stay within the transaction
    const getRequest = nodeStore.get(fileId);
    getRequest.onsuccess = () => {
      const existingNode = getRequest.result as FSNodeMetadata | undefined;
      if (existingNode) {
        existingNode.updatedAt = now;
        existingNode.size = size;
        nodeStore.put(existingNode);
      }
    };

    // Update content
    transaction.objectStore('fs_content').put({
      fileId,
      content,
      updatedAt: now,
    });

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async deleteFile(projectId: string, fileId: string): Promise<void> {
    const db = await this.getDB(projectId);
    const transaction = db.transaction(['fs_nodes', 'fs_content'], 'readwrite');
    transaction.objectStore('fs_nodes').delete(fileId);
    transaction.objectStore('fs_content').delete(fileId);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async createDirectory(
    projectId: string,
    parentId: string | null,
    name: string,
  ): Promise<FSNodeMetadata> {
    const db = await this.getDB(projectId);
    const now = Date.now();
    const nodeId = generateId();
    const parentPath = parentId ? await this.getNodePath(db, parentId) : '';
    const path = `${parentPath}/${name}`;

    const node: FSNodeMetadata = {
      id: nodeId,
      name,
      type: 'directory',
      parentId,
      path,
      createdAt: now,
      updatedAt: now,
    };

    await tx(db, 'fs_nodes', 'readwrite', (transaction) => {
      const store = transaction.objectStore('fs_nodes');
      return putRecord(store, node);
    });

    return node;
  }

  async deleteDirectory(projectId: string, dirId: string, recursive = false): Promise<void> {
    const db = await this.getDB(projectId);

    if (!recursive) {
      // Check if directory has children
      const children = await tx<FSNodeMetadata[]>(db, 'fs_nodes', 'readonly', (transaction) => {
        const store = transaction.objectStore('fs_nodes');
        return getAllByIndex(store, 'by-parent', dirId);
      });
      if (children.length > 0) {
        throw new Error('Directory is not empty. Use recursive=true to delete.');
      }
      await tx(db, 'fs_nodes', 'readwrite', (transaction) => {
        return deleteRecord(transaction.objectStore('fs_nodes'), dirId);
      });
      return;
    }

    // Recursive delete: collect all descendant IDs
    const allNodes = await this.listTree(projectId);
    const toDelete = new Set<string>();
    const collectDescendants = (parentId: string) => {
      toDelete.add(parentId);
      for (const node of allNodes) {
        if (node.parentId === parentId && !toDelete.has(node.id)) {
          collectDescendants(node.id);
        }
      }
    };
    collectDescendants(dirId);

    const transaction = db.transaction(['fs_nodes', 'fs_content'], 'readwrite');
    const nodeStore = transaction.objectStore('fs_nodes');
    const contentStore = transaction.objectStore('fs_content');

    for (const id of toDelete) {
      nodeStore.delete(id);
      contentStore.delete(id); // safe even if no content exists
    }

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async rename(projectId: string, nodeId: string, newName: string): Promise<FSNodeMetadata> {
    const db = await this.getDB(projectId);
    const allNodes = await this.listTree(projectId);
    const node = allNodes.find((n) => n.id === nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const oldName = node.name;
    const oldPath = node.path;
    let newPath: string;

    if (node.type === 'file' && node.fileType) {
      const ext = EXTENSIONS[node.fileType] ?? EXTENSIONS.page;
      const parentPath = oldPath.slice(0, oldPath.lastIndexOf('/'));
      newPath = `${parentPath}/${newName}${ext}`;
    } else {
      const parentPath = oldPath.slice(0, oldPath.lastIndexOf('/'));
      newPath = `${parentPath}/${newName}`;
    }

    const now = Date.now();
    node.name = newName;
    node.path = newPath;
    node.updatedAt = now;

    const transaction = db.transaction('fs_nodes', 'readwrite');
    const store = transaction.objectStore('fs_nodes');
    store.put(node);

    // Update descendant paths if directory
    if (node.type === 'directory') {
      this.updateDescendantPathsSync(store, allNodes, nodeId, oldPath, newPath);
    }

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

    return node;
  }

  async move(
    projectId: string,
    nodeId: string,
    newParentId: string | null,
    afterNodeId?: string | null,
  ): Promise<FSNodeMetadata> {
    const db = await this.getDB(projectId);
    const allNodes = await this.listTree(projectId);
    const node = allNodes.find((n) => n.id === nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    // Validate target parent exists
    let newParentPath = '';
    if (newParentId !== null) {
      const parentNode = allNodes.find((n) => n.id === newParentId);
      if (!parentNode) {
        throw new Error(`Target parent not found: ${newParentId}`);
      }
      if (parentNode.type !== 'directory') {
        throw new Error(`Target parent is not a directory: ${newParentId}`);
      }
      newParentPath = parentNode.path;
    }

    // Prevent circular moves (moving a directory into its own descendant)
    if (node.type === 'directory' && newParentId !== null) {
      let cursor: string | null = newParentId;
      while (cursor !== null) {
        if (cursor === nodeId) {
          throw new Error('Cannot move a directory into its own descendant');
        }
        const cursorNode = allNodes.find((n) => n.id === cursor);
        cursor = cursorNode?.parentId ?? null;
      }
    }

    // Calculate sortOrder when afterNodeId is explicitly provided
    const siblingNodes: FSNodeMetadata[] = [];
    if (afterNodeId !== undefined) {
      for (const n of allNodes) {
        if (n.parentId === newParentId && n.id !== nodeId) {
          siblingNodes.push(n);
        }
      }
      siblingNodes.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

      if (afterNodeId === null) {
        // Place first
        node.sortOrder = siblingNodes.length === 0 ? 0 : (siblingNodes[0]!.sortOrder ?? 0) - 1000;
      } else {
        const afterIdx = siblingNodes.findIndex((n) => n.id === afterNodeId);
        if (afterIdx === -1) {
          throw new Error(`afterNodeId not found among siblings: ${afterNodeId}`);
        }
        const afterNode = siblingNodes[afterIdx]!;
        const nextNode = siblingNodes[afterIdx + 1] as FSNodeMetadata | undefined;

        if (!nextNode) {
          node.sortOrder = (afterNode.sortOrder ?? 0) + 1000;
        } else {
          const afterOrder = afterNode.sortOrder ?? 0;
          const nextOrder = nextNode.sortOrder ?? 0;
          const mid = (afterOrder + nextOrder) / 2;
          if (mid === afterOrder || mid === nextOrder) {
            // Gap exhausted — renormalize all siblings
            for (let i = 0; i < siblingNodes.length; i++) {
              siblingNodes[i]!.sortOrder = i * 1000;
            }
            const newAfterIdx = siblingNodes.findIndex((n) => n.id === afterNodeId);
            const renormAfter = siblingNodes[newAfterIdx]!;
            const renormNext = siblingNodes[newAfterIdx + 1] as FSNodeMetadata | undefined;
            node.sortOrder = renormNext
              ? ((renormAfter.sortOrder ?? 0) + (renormNext.sortOrder ?? 0)) / 2
              : (renormAfter.sortOrder ?? 0) + 1000;
          } else {
            node.sortOrder = mid;
          }
        }
      }
    }

    const oldPath = node.path;
    const fileName = node.type === 'file' && node.fileType
      ? `${node.name}${EXTENSIONS[node.fileType] ?? EXTENSIONS.page}`
      : node.name;
    const newPath = `${newParentPath}/${fileName}`;
    const now = Date.now();

    node.parentId = newParentId;
    node.path = newPath;
    node.updatedAt = now;

    const transaction = db.transaction('fs_nodes', 'readwrite');
    const store = transaction.objectStore('fs_nodes');
    store.put(node);

    // Write renormalized siblings if any
    if (afterNodeId !== undefined) {
      for (const sib of siblingNodes) {
        store.put(sib);
      }
    }

    // Update descendant paths if directory
    if (node.type === 'directory') {
      this.updateDescendantPathsSync(store, allNodes, nodeId, oldPath, newPath);
    }

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

    return node;
  }

  async getNode(projectId: string, nodeId: string): Promise<FSNodeMetadata | undefined> {
    const db = await this.getDB(projectId);
    return tx<FSNodeMetadata | undefined>(db, 'fs_nodes', 'readonly', (transaction) => {
      const store = transaction.objectStore('fs_nodes');
      return getByKey(store, nodeId);
    });
  }

  async getNodeByPath(projectId: string, path: string): Promise<FSNodeMetadata | undefined> {
    const db = await this.getDB(projectId);
    return tx<FSNodeMetadata | undefined>(db, 'fs_nodes', 'readonly', (transaction) => {
      const store = transaction.objectStore('fs_nodes');
      return getByIndex(store, 'by-path', path);
    });
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private async getNodePath(db: IDBDatabase, nodeId: string): Promise<string> {
    const node = await tx<FSNodeMetadata | undefined>(db, 'fs_nodes', 'readonly', (transaction) => {
      return getByKey(transaction.objectStore('fs_nodes'), nodeId);
    });
    return node?.path ?? '';
  }

  private updateDescendantPathsSync(
    store: IDBObjectStore,
    allNodes: FSNodeMetadata[],
    parentId: string,
    oldParentPath: string,
    newParentPath: string,
  ): void {
    const descendants = allNodes.filter((n) => n.path.startsWith(oldParentPath + '/') && n.id !== parentId);
    for (const desc of descendants) {
      desc.path = newParentPath + desc.path.slice(oldParentPath.length);
      store.put(desc);
    }
  }

  // ── Project-level utilities ──

  /**
   * Check whether a project VFS has any files/directories.
   */
  async hasFiles(projectId: string): Promise<boolean> {
    const db = await this.getDB(projectId);
    return tx<boolean>(db, 'fs_nodes', 'readonly', (transaction) => {
      const store = transaction.objectStore('fs_nodes');
      const countReq = store.count();
      return new Promise<boolean>((resolve, reject) => {
        countReq.onsuccess = () => resolve(countReq.result > 0);
        countReq.onerror = () => reject(countReq.error);
      });
    });
  }

  /**
   * Copy all nodes and file contents from one project VFS to another.
   * Generates new IDs for all nodes and remaps parent references.
   * Skips if the target project already has files.
   */
  async copyProject(sourceProjectId: string, targetProjectId: string): Promise<void> {
    // Read all nodes and content from source
    const sourceDb = await this.getDB(sourceProjectId);

    const allNodes = await tx<FSNodeMetadata[]>(sourceDb, 'fs_nodes', 'readonly', (transaction) => {
      return getAll<FSNodeMetadata>(transaction.objectStore('fs_nodes'));
    });

    if (allNodes.length === 0) return;

    const allContent = await tx<{ fileId: string; content: FileContent }[]>(
      sourceDb, 'fs_content', 'readonly', (transaction) => {
        return getAll<{ fileId: string; content: FileContent }>(transaction.objectStore('fs_content'));
      },
    );

    // Build old-ID → new-ID mapping
    const idMap = new Map<string, string>();
    for (const node of allNodes) {
      idMap.set(node.id, generateId());
    }

    // Build content lookup
    const contentMap = new Map<string, FileContent>();
    for (const c of allContent) {
      contentMap.set(c.fileId, c.content);
    }

    // Write to target
    const targetDb = await this.getDB(targetProjectId);

    await tx<void>(targetDb, ['fs_nodes', 'fs_content'], 'readwrite', (transaction) => {
      const nodeStore = transaction.objectStore('fs_nodes');
      const contentStore = transaction.objectStore('fs_content');

      for (const node of allNodes) {
        const newId = idMap.get(node.id)!;
        const newParentId = node.parentId ? (idMap.get(node.parentId) ?? null) : null;
        const newNode: FSNodeMetadata = {
          ...node,
          id: newId,
          parentId: newParentId,
        };
        nodeStore.put(newNode);

        // Copy file content if exists
        const content = contentMap.get(node.id);
        if (content) {
          contentStore.put({ fileId: newId, content });
        }
      }

      return new Promise<void>((resolve) => {
        transaction.oncomplete = () => resolve();
      });
    });
  }
}
