import type { PageSchema } from '@shenbi/schema';

// ---------------------------------------------------------------------------
// File type definitions (extensible)
// ---------------------------------------------------------------------------

export type FileType = 'page' | 'api' | 'flow' | 'db' | 'dict';

export const FILE_TYPE_EXTENSIONS: Record<FileType, string> = {
  page: '.page.json',
  api: '.api.json',
  flow: '.flow.json',
  db: '.db.json',
  dict: '.dict.json',
};

// ---------------------------------------------------------------------------
// Virtual file system node metadata
// ---------------------------------------------------------------------------

export interface FSNodeMetadata {
  id: string;
  name: string;
  type: 'file' | 'directory';
  fileType?: FileType | undefined;
  parentId: string | null;
  path: string;
  createdAt: number;
  updatedAt: number;
  size?: number | undefined;
  sortOrder?: number | undefined;
}

export type FileContent = PageSchema | Record<string, unknown>;

export interface FSTreeNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  fileType?: FileType | undefined;
  path: string;
  children?: FSTreeNode[] | undefined;
}

// ---------------------------------------------------------------------------
// Legacy flat file metadata (kept for backward compatibility)
// ---------------------------------------------------------------------------

export interface FileMetadata {
  id: string;
  name: string;
  updatedAt: number;
  size?: number;
}

export interface FileStorageAdapter {
  list(): Promise<FileMetadata[]>;
  read(fileId: string): Promise<PageSchema>;
  write(fileId: string, schema: PageSchema): Promise<void>;
  saveAs?(name: string, schema: PageSchema): Promise<string>;
  delete?(fileId: string): Promise<void>;
}

interface StoredFileRecord {
  metadata: FileMetadata;
  schema: PageSchema;
}

function cloneSchema<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function createFileId(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9\-_.]+/g, '-').replace(/^-+|-+$/g, '');
  const base = normalized.length > 0 ? normalized : 'page';
  return `${base}-${Date.now()}`;
}

export class LocalFileStorageAdapter implements FileStorageAdapter {
  private readonly indexKey = 'shenbi-editor-files';
  private readonly prefixKey = 'shenbi-editor-file';

  async list(): Promise<FileMetadata[]> {
    const records = this.readIndex();
    return records.map((record) => record.metadata);
  }

  async read(fileId: string): Promise<PageSchema> {
    const record = this.readRecord(fileId);
    if (!record) {
      throw new Error(`File not found: ${fileId}`);
    }
    return cloneSchema(record.schema);
  }

  async write(fileId: string, schema: PageSchema): Promise<void> {
    const nextSchema = cloneSchema(schema);
    const records = this.readIndex();
    const now = Date.now();
    const size = JSON.stringify(nextSchema).length;
    const index = records.findIndex((record) => record.metadata.id === fileId);
    const metadata: FileMetadata = {
      id: fileId,
      name: nextSchema.name ?? fileId,
      updatedAt: now,
      size,
    };
    const nextRecord: StoredFileRecord = { metadata, schema: nextSchema };
    if (index >= 0) {
      records[index] = nextRecord;
    } else {
      records.push(nextRecord);
    }
    this.writeIndex(records);
    this.writeRecord(fileId, nextRecord);
  }

  async saveAs(name: string, schema: PageSchema): Promise<string> {
    const fileId = createFileId(name);
    const nextSchema: PageSchema = {
      ...cloneSchema(schema),
      name,
    };
    await this.write(fileId, nextSchema);
    return fileId;
  }

  async delete(fileId: string): Promise<void> {
    const records = this.readIndex().filter((record) => record.metadata.id !== fileId);
    this.writeIndex(records);
    this.storage().removeItem(this.recordKey(fileId));
  }

  private storage(): Storage {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage is not available in current runtime');
    }
    return localStorage;
  }

  private recordKey(fileId: string): string {
    return `${this.prefixKey}:${fileId}`;
  }

  private readIndex(): StoredFileRecord[] {
    const raw = this.storage().getItem(this.indexKey);
    if (!raw) {
      return [];
    }
    try {
      const entries = JSON.parse(raw) as FileMetadata[];
      return entries
        .map((metadata) => {
          const recordRaw = this.storage().getItem(this.recordKey(metadata.id));
          if (!recordRaw) {
            return undefined;
          }
          const parsed = JSON.parse(recordRaw) as StoredFileRecord;
          return parsed;
        })
        .filter((record): record is StoredFileRecord => Boolean(record));
    } catch {
      return [];
    }
  }

  private writeIndex(records: StoredFileRecord[]): void {
    const metadataList = records.map((record) => record.metadata);
    this.storage().setItem(this.indexKey, JSON.stringify(metadataList));
  }

  private readRecord(fileId: string): StoredFileRecord | undefined {
    const raw = this.storage().getItem(this.recordKey(fileId));
    if (!raw) {
      return undefined;
    }
    try {
      return JSON.parse(raw) as StoredFileRecord;
    } catch {
      return undefined;
    }
  }

  private writeRecord(fileId: string, record: StoredFileRecord): void {
    this.storage().setItem(this.recordKey(fileId), JSON.stringify(record));
  }
}
