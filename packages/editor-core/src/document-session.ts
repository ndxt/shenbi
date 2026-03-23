import type { FileContent, FileType } from './adapters/file-storage';

export type DocumentOwner = 'page-editor' | 'renderer';

export interface DocumentSession {
  fileId: string;
  fileType: FileType;
  owner: DocumentOwner;
  persistedContent: FileContent;
  workingContent: FileContent;
  dirty: boolean;
  revision: number;
  savedRevision: number;
}

function cloneContent<T extends FileContent>(content: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(content);
  }
  return JSON.parse(JSON.stringify(content)) as T;
}

function defaultOwnerForFileType(fileType: FileType): DocumentOwner {
  return fileType === 'page' ? 'page-editor' : 'renderer';
}

export class DocumentSessionManager {
  private sessions = new Map<string, DocumentSession>();

  ensureSession(args: {
    fileId: string;
    fileType: FileType;
    content: FileContent;
    dirty?: boolean;
    owner?: DocumentOwner;
  }): DocumentSession {
    const existing = this.sessions.get(args.fileId);
    if (existing) {
      return existing;
    }
    const session: DocumentSession = {
      fileId: args.fileId,
      fileType: args.fileType,
      owner: args.owner ?? defaultOwnerForFileType(args.fileType),
      persistedContent: cloneContent(args.content),
      workingContent: cloneContent(args.content),
      dirty: args.dirty ?? false,
      revision: 0,
      savedRevision: 0,
    };
    this.sessions.set(args.fileId, session);
    return session;
  }

  getSession(fileId: string): DocumentSession | undefined {
    const session = this.sessions.get(fileId);
    return session ? {
      ...session,
      persistedContent: cloneContent(session.persistedContent),
      workingContent: cloneContent(session.workingContent),
    } : undefined;
  }

  updateWorkingContent(fileId: string, content: FileContent, dirty?: boolean): DocumentSession | undefined {
    const session = this.sessions.get(fileId);
    if (!session) {
      return undefined;
    }
    session.workingContent = cloneContent(content);
    session.revision += 1;
    if (typeof dirty === 'boolean') {
      session.dirty = dirty;
    }
    return this.getSession(fileId);
  }

  replacePersistedContent(fileId: string, content: FileContent): DocumentSession | undefined {
    const session = this.sessions.get(fileId);
    if (!session) {
      return undefined;
    }
    const next = cloneContent(content);
    session.persistedContent = next;
    session.workingContent = cloneContent(next);
    session.revision += 1;
    session.savedRevision = session.revision;
    session.dirty = false;
    return this.getSession(fileId);
  }

  markDirty(fileId: string, dirty: boolean): DocumentSession | undefined {
    const session = this.sessions.get(fileId);
    if (!session) {
      return undefined;
    }
    session.dirty = dirty;
    return this.getSession(fileId);
  }

  removeSession(fileId: string): void {
    this.sessions.delete(fileId);
  }
}
