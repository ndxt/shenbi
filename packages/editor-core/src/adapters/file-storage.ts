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

export class MemoryFileStorageAdapter implements FileStorageAdapter {
  private readonly files = new Map<string, StoredFileRecord>();

  async list(): Promise<FileMetadata[]> {
    return Array.from(this.files.values()).map((record) => record.metadata);
  }

  async read(fileId: string): Promise<PageSchema> {
    const record = this.files.get(fileId);
    if (!record) {
      throw new Error(`File not found: ${fileId}`);
    }
    return cloneSchema(record.schema);
  }

  async write(fileId: string, schema: PageSchema): Promise<void> {
    const nextSchema = cloneSchema(schema);
    const now = Date.now();
    const size = JSON.stringify(nextSchema).length;
    const metadata: FileMetadata = {
      id: fileId,
      name: nextSchema.name ?? fileId,
      updatedAt: now,
      size,
    };
    const nextRecord: StoredFileRecord = { metadata, schema: nextSchema };
    this.files.set(fileId, nextRecord);
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
    this.files.delete(fileId);
  }
}
