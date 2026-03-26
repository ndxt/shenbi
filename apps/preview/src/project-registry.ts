/**
 * Project registry backed by IndexedDB.
 *
 * Stores the project list and active-project pointer in a dedicated
 * `shenbi-project-registry` database so that clearing localStorage
 * does NOT destroy the user's project index.
 */

import type { ActiveProjectConfig } from './constants';

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

const DB_NAME = 'shenbi-project-registry';
const DB_VERSION = 1;

const PROJECTS_STORE = 'projects';
const META_STORE = 'meta';

const ACTIVE_PROJECT_META_KEY = 'active_project';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

function tx<T>(
  db: IDBDatabase,
  storeNames: string | string[],
  mode: IDBTransactionMode,
  fn: (transaction: IDBTransaction) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    let result: T;

    const maybeResult = fn(transaction);

    if (maybeResult instanceof IDBRequest) {
      maybeResult.onsuccess = () => {
        result = maybeResult.result;
      };
      maybeResult.onerror = () => reject(maybeResult.error);
    } else {
      void (maybeResult as Promise<T>)
        .then((value) => {
          result = value;
        })
        .catch(reject);
    }

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Transaction aborted'));
  });
}

// ---------------------------------------------------------------------------
// Project list
// ---------------------------------------------------------------------------

/** Get the canonical ID used as the IndexedDB key. */
function projectKey(p: ActiveProjectConfig): string {
  return p.id ?? p.vfsProjectId;
}

/** Ensure every project has an `id` field matching its canonical key. */
function normalizeProject(p: ActiveProjectConfig): ActiveProjectConfig {
  return { ...p, id: projectKey(p) };
}

export async function loadProjectList(): Promise<ActiveProjectConfig[]> {
  try {
    const db = await openDB();
    return await tx<ActiveProjectConfig[]>(
      db,
      PROJECTS_STORE,
      'readonly',
      (transaction) => {
        const store = transaction.objectStore(PROJECTS_STORE);
        return store.getAll();
      },
    );
  } catch {
    return [];
  }
}

export async function saveProjectList(
  projects: ActiveProjectConfig[],
): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction(PROJECTS_STORE, 'readwrite');
  const store = transaction.objectStore(PROJECTS_STORE);

  // Clear existing and write new list
  store.clear();
  for (const p of projects) {
    store.put(normalizeProject(p));
  }

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function upsertProjectInList(
  project: ActiveProjectConfig,
): Promise<void> {
  const db = await openDB();
  const normalized = normalizeProject({
    ...project,
    lastOpenedAt: Date.now(),
  });

  await tx<void>(db, PROJECTS_STORE, 'readwrite', (transaction) => {
    const store = transaction.objectStore(PROJECTS_STORE);
    store.put(normalized);
    return new Promise<void>((resolve) => {
      transaction.oncomplete = () => resolve();
    });
  });
}

export async function removeProjectFromList(
  projectId: string,
): Promise<void> {
  const db = await openDB();
  await tx<void>(db, PROJECTS_STORE, 'readwrite', (transaction) => {
    const store = transaction.objectStore(PROJECTS_STORE);
    store.delete(projectId);
    return new Promise<void>((resolve) => {
      transaction.oncomplete = () => resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Active project (currently open)
// ---------------------------------------------------------------------------

export async function loadActiveProject(): Promise<ActiveProjectConfig | null> {
  try {
    const db = await openDB();
    const record = await tx<{ key: string; value: ActiveProjectConfig } | undefined>(
      db,
      META_STORE,
      'readonly',
      (transaction) => {
        const store = transaction.objectStore(META_STORE);
        return store.get(ACTIVE_PROJECT_META_KEY);
      },
    );
    return record?.value ?? null;
  } catch {
    return null;
  }
}

export async function saveActiveProject(
  config: ActiveProjectConfig,
): Promise<void> {
  const db = await openDB();
  await tx<void>(db, META_STORE, 'readwrite', (transaction) => {
    const store = transaction.objectStore(META_STORE);
    store.put({ key: ACTIVE_PROJECT_META_KEY, value: config });
    return new Promise<void>((resolve) => {
      transaction.oncomplete = () => resolve();
    });
  });
}

export async function clearActiveProject(): Promise<void> {
  const db = await openDB();
  await tx<void>(db, META_STORE, 'readwrite', (transaction) => {
    const store = transaction.objectStore(META_STORE);
    store.delete(ACTIVE_PROJECT_META_KEY);
    return new Promise<void>((resolve) => {
      transaction.oncomplete = () => resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Test utilities
// ---------------------------------------------------------------------------

/** Reset the cached DB connection (useful in tests). */
export function _resetDBCache(): void {
  dbPromise = null;
}
