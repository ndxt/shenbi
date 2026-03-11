import type {
  FileContent,
  FileType,
  FSNodeMetadata,
  FILE_TYPE_EXTENSIONS,
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
// Migration: localStorage → IndexedDB
// ---------------------------------------------------------------------------

interface LegacyFileMetadata {
  id: string;
  name: string;
  updatedAt: number;
  size?: number;
}

interface LegacyStoredFileRecord {
  metadata: LegacyFileMetadata;
  schema: Record<string, unknown>;
}

function readLegacyFiles(): LegacyStoredFileRecord[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  const indexRaw = localStorage.getItem('shenbi-editor-files');
  if (!indexRaw) {
    return [];
  }
  try {
    const metadataList = JSON.parse(indexRaw) as LegacyFileMetadata[];
    return metadataList
      .map((metadata) => {
        const recordRaw = localStorage.getItem(`shenbi-editor-file:${metadata.id}`);
        if (!recordRaw) return undefined;
        return JSON.parse(recordRaw) as LegacyStoredFileRecord;
      })
      .filter((record): record is LegacyStoredFileRecord => Boolean(record));
  } catch {
    return [];
  }
}

function removeLegacyFiles(): void {
  if (typeof localStorage === 'undefined') return;
  const indexRaw = localStorage.getItem('shenbi-editor-files');
  if (!indexRaw) return;
  try {
    const metadataList = JSON.parse(indexRaw) as LegacyFileMetadata[];
    for (const metadata of metadataList) {
      localStorage.removeItem(`shenbi-editor-file:${metadata.id}`);
    }
    localStorage.removeItem('shenbi-editor-files');
  } catch {
    // ignore
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
      return; // already initialized
    }

    // Migrate legacy localStorage files
    const legacyFiles = readLegacyFiles();
    if (legacyFiles.length === 0) {
      return;
    }

    const transaction = db.transaction(['fs_nodes', 'fs_content'], 'readwrite');
    const nodeStore = transaction.objectStore('fs_nodes');
    const contentStore = transaction.objectStore('fs_content');
    const now = Date.now();

    for (const record of legacyFiles) {
      const nodeId = generateId();
      const fileName = record.metadata.name || record.metadata.id;
      const path = `/${fileName}${EXTENSIONS.page}`;
      const node: FSNodeMetadata = {
        id: nodeId,
        name: fileName,
        type: 'file',
        fileType: 'page',
        parentId: null,
        path,
        createdAt: record.metadata.updatedAt || now,
        updatedAt: record.metadata.updatedAt || now,
        ...(record.metadata.size !== undefined ? { size: record.metadata.size } : {}),
      };
      nodeStore.put(node);
      contentStore.put({
        fileId: nodeId,
        content: record.schema,
        updatedAt: node.updatedAt,
      });
    }

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

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
    const ext = EXTENSIONS[fileType];
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
      transaction.onerror = () => reject(transaction.error);
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

    // Update node metadata
    const existingNode = await getByKey<FSNodeMetadata>(nodeStore, fileId);
    if (existingNode) {
      existingNode.updatedAt = now;
      existingNode.size = size;
      nodeStore.put(existingNode);
    }

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
      const ext = EXTENSIONS[node.fileType];
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
      await this.updateDescendantPaths(store, allNodes, nodeId, oldPath, newPath);
    }

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

    return node;
  }

  async move(projectId: string, nodeId: string, newParentId: string | null): Promise<FSNodeMetadata> {
    const db = await this.getDB(projectId);
    const allNodes = await this.listTree(projectId);
    const node = allNodes.find((n) => n.id === nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const oldPath = node.path;
    const newParentPath = newParentId
      ? (allNodes.find((n) => n.id === newParentId)?.path ?? '')
      : '';

    const fileName = node.type === 'file' && node.fileType
      ? `${node.name}${EXTENSIONS[node.fileType]}`
      : node.name;
    const newPath = `${newParentPath}/${fileName}`;
    const now = Date.now();

    node.parentId = newParentId;
    node.path = newPath;
    node.updatedAt = now;

    const transaction = db.transaction('fs_nodes', 'readwrite');
    const store = transaction.objectStore('fs_nodes');
    store.put(node);

    // Update descendant paths if directory
    if (node.type === 'directory') {
      await this.updateDescendantPaths(store, allNodes, nodeId, oldPath, newPath);
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

  private updateDescendantPaths(
    store: IDBObjectStore,
    allNodes: FSNodeMetadata[],
    parentId: string,
    oldParentPath: string,
    newParentPath: string,
  ): Promise<void> {
    const descendants = allNodes.filter((n) => n.path.startsWith(oldParentPath + '/') && n.id !== parentId);
    for (const desc of descendants) {
      desc.path = newParentPath + desc.path.slice(oldParentPath.length);
      store.put(desc);
    }
    return Promise.resolve();
  }
}
