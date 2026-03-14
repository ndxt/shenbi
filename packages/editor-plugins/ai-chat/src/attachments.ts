import type { RunAttachmentInput } from '@shenbi/ai-contracts';

export interface ChatAttachmentRef {
  attachmentId: string;
  kind: RunAttachmentInput['kind'];
  name: string;
  mimeType: string;
  sizeBytes: number;
  previewable: boolean;
}

export interface PendingAttachment {
  id: string;
  file: File;
  kind: RunAttachmentInput['kind'];
  name: string;
  mimeType: string;
  sizeBytes: number;
  previewable: boolean;
}

interface StoredAttachmentRecord {
  id: string;
  kind: RunAttachmentInput['kind'];
  name: string;
  mimeType: string;
  sizeBytes: number;
  blob: Blob;
  createdAt: number;
}

const DB_NAME = 'shenbi-ai-chat';
const DB_VERSION = 1;
const STORE_NAME = 'attachments';
const memoryFallback = new Map<string, StoredAttachmentRecord>();

export const CHAT_ATTACHMENT_ACCEPT = 'image/*,.pdf,.doc,.docx';

function createAttachmentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getExtension(name: string): string {
  const index = name.lastIndexOf('.');
  return index >= 0 ? name.slice(index).toLowerCase() : '';
}

function isDocumentExtension(extension: string): boolean {
  return extension === '.pdf' || extension === '.doc' || extension === '.docx';
}

function supportsIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putStoredAttachment(record: StoredAttachmentRecord): Promise<void> {
  if (!supportsIndexedDb()) {
    memoryFallback.set(record.id, record);
    return;
  }

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    db.close();
  } catch {
    memoryFallback.set(record.id, record);
  }
}

export async function getStoredAttachment(attachmentId: string): Promise<StoredAttachmentRecord | undefined> {
  if (!supportsIndexedDb()) {
    return memoryFallback.get(attachmentId);
  }

  try {
    const db = await openDb();
    const result = await new Promise<StoredAttachmentRecord | undefined>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(attachmentId);
      request.onsuccess = () => resolve(request.result as StoredAttachmentRecord | undefined);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  } catch {
    return memoryFallback.get(attachmentId);
  }
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read attachment'));
    reader.readAsDataURL(blob);
  });
}

export function getAttachmentKind(file: Pick<File, 'name' | 'type'>): RunAttachmentInput['kind'] | undefined {
  if (typeof file.type === 'string' && file.type.startsWith('image/')) {
    return 'image';
  }
  if (
    file.type === 'application/pdf'
    || file.type === 'application/msword'
    || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || isDocumentExtension(getExtension(file.name))
  ) {
    return 'document';
  }
  return undefined;
}

export function createPendingAttachment(file: File): PendingAttachment | undefined {
  const kind = getAttachmentKind(file);
  if (!kind) {
    return undefined;
  }
  const mimeType = file.type || (
    getExtension(file.name) === '.pdf'
      ? 'application/pdf'
      : getExtension(file.name) === '.doc'
        ? 'application/msword'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  return {
    id: createAttachmentId(),
    file,
    kind,
    name: file.name,
    mimeType,
    sizeBytes: file.size,
    previewable: kind === 'image',
  };
}

export async function materializePendingAttachments(
  attachments: PendingAttachment[],
): Promise<{ runAttachments: RunAttachmentInput[]; refs: ChatAttachmentRef[] }> {
  const runAttachments = await Promise.all(attachments.map(async (attachment) => {
    const dataUrl = await readBlobAsDataUrl(attachment.file);
    await putStoredAttachment({
      id: attachment.id,
      kind: attachment.kind,
      name: attachment.name,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      blob: attachment.file,
      createdAt: Date.now(),
    });
    return {
      id: attachment.id,
      kind: attachment.kind,
      name: attachment.name,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      dataUrl,
    };
  }));

  return {
    runAttachments,
    refs: attachments.map((attachment) => ({
      attachmentId: attachment.id,
      kind: attachment.kind,
      name: attachment.name,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      previewable: attachment.previewable,
    })),
  };
}
