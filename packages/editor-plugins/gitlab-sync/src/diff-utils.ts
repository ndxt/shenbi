/**
 * Diff utilities: compare local VFS files against remote GitLab repository.
 *
 * Optimizations:
 * 1. SHA comparison — compute git blob SHA locally, compare with remote tree SHA
 * 2. Parallel requests — concurrency pool for batch file fetches
 * 3. Local SHA cache — store remote tree snapshot in localStorage
 * 4. Incremental pull — only download changed files
 */

import type { CommitAction, GitLabTreeItem } from './gitlab-client';

export type DiffStatus = 'added' | 'modified' | 'deleted';

export interface FileDiffItem {
  path: string;
  status: DiffStatus;
  /** Remote blob SHA (for caching) */
  remoteSha?: string | undefined;
}

// ---------------------------------------------------------------------------
// 1. Git Blob SHA Computation
// ---------------------------------------------------------------------------

/**
 * Compute the git blob SHA-1 for a string content.
 * Git blob format: "blob <byteLength>\0<content>"
 *
 * Uses Web Crypto API (available in all modern browsers).
 */
export async function computeGitBlobSha(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(content);
  const header = encoder.encode(`blob ${contentBytes.length}\0`);

  // Concatenate header + content
  const fullBytes = new Uint8Array(header.length + contentBytes.length);
  fullBytes.set(header, 0);
  fullBytes.set(contentBytes, header.length);

  const hashBuffer = await crypto.subtle.digest('SHA-1', fullBytes);
  const hashArray = new Uint8Array(hashBuffer);

  // Convert to hex string
  let hex = '';
  for (let i = 0; i < hashArray.length; i++) {
    hex += (hashArray[i] as number).toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Compute git blob SHAs for all local files.
 * Returns Map<normalizedPath, sha>
 */
export async function computeLocalShas(
  localFiles: Map<string, string>,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const entries = [...localFiles.entries()];

  // Compute SHAs in parallel (CPU-bound, no network)
  const promises = entries.map(async ([path, content]) => {
    const normalizedPath = path.replace(/^\/+/, '');
    const sha = await computeGitBlobSha(content);
    return { path: normalizedPath, sha };
  });

  const results = await Promise.all(promises);
  for (const { path, sha } of results) {
    result.set(path, sha);
  }
  return result;
}

// ---------------------------------------------------------------------------
// 2. SHA-based Diff (no content fetch needed!)
// ---------------------------------------------------------------------------

/**
 * Compute diff using SHA comparison — O(1) per file, no network calls.
 *
 * @param localShas Map of normalizedPath → git blob SHA
 * @param remoteTree Remote tree items (blob items have .id = SHA)
 * @param localPaths Set of normalized local paths (for detecting added files)
 */
export function computeDiffBySha(
  localShas: Map<string, string>,
  remoteTree: GitLabTreeItem[],
): FileDiffItem[] {
  const remoteBlobs = new Map<string, string>();
  for (const item of remoteTree) {
    if (item.type === 'blob') {
      remoteBlobs.set(item.path, item.id); // id = git blob SHA
    }
  }

  const diffs: FileDiffItem[] = [];

  // Local files: check if added or modified
  for (const [path, localSha] of localShas) {
    const remoteSha = remoteBlobs.get(path);
    if (!remoteSha) {
      diffs.push({ path, status: 'added' });
    } else if (localSha !== remoteSha) {
      diffs.push({ path, status: 'modified', remoteSha });
    }
    // else: SHA matches → file is identical, skip
  }

  // Remote files: check if deleted (exists remote but not local)
  for (const [remotePath] of remoteBlobs) {
    if (!localShas.has(remotePath)) {
      diffs.push({ path: remotePath, status: 'deleted', remoteSha: remoteBlobs.get(remotePath) });
    }
  }

  // Sort: added first, then modified, then deleted
  const statusOrder: Record<DiffStatus, number> = { added: 0, modified: 1, deleted: 2 };
  diffs.sort((a, b) => {
    const orderDiff = statusOrder[a.status] - statusOrder[b.status];
    return orderDiff !== 0 ? orderDiff : a.path.localeCompare(b.path);
  });

  return diffs;
}

// ---------------------------------------------------------------------------
// 3. Remote SHA Cache
// ---------------------------------------------------------------------------

const CACHE_KEY = 'gitlab_sync_sha_cache';

export interface ShaCache {
  projectId: number;
  branch: string;
  timestamp: number;
  /** Map serialized as [path, sha][] */
  entries: [string, string][];
}

export function loadShaCache(projectId: number, branch: string): Map<string, string> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as ShaCache;
    if (cache.projectId !== projectId || cache.branch !== branch) return null;
    // Cache expires after 5 minutes
    if (Date.now() - cache.timestamp > 5 * 60 * 1000) return null;
    return new Map(cache.entries);
  } catch {
    return null;
  }
}

export function saveShaCache(projectId: number, branch: string, tree: GitLabTreeItem[]): void {
  const entries: [string, string][] = tree
    .filter((item) => item.type === 'blob')
    .map((item) => [item.path, item.id]);
  const cache: ShaCache = { projectId, branch, timestamp: Date.now(), entries };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* localStorage full, ignore */ }
}

export function clearShaCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

// ---------------------------------------------------------------------------
// 4. Concurrency Pool
// ---------------------------------------------------------------------------

/**
 * Run async tasks with limited concurrency.
 *
 * @param tasks Array of functions that return promises
 * @param concurrency Max parallel tasks (default 5)
 * @param onProgress Called after each task completes with (completed, total)
 */
export async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number = 5,
  onProgress?: (completed: number, total: number) => void,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;
  let completed = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      const task = tasks[index];
      if (task) {
        results[index] = await task();
        completed++;
        onProgress?.(completed, tasks.length);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Commit Actions (unchanged logic)
// ---------------------------------------------------------------------------

export function diffToCommitActions(
  diffs: FileDiffItem[],
  localFiles: Map<string, string>,
  includeDeletes: boolean = false,
): CommitAction[] {
  const actions: CommitAction[] = [];

  for (const diff of diffs) {
    const filePath = diff.path.replace(/^\/+/, '');
    if (!filePath) continue;

    switch (diff.status) {
      case 'added': {
        const content = localFiles.get(diff.path) ?? localFiles.get(`/${diff.path}`) ?? localFiles.get(filePath);
        if (content !== undefined) {
          actions.push({
            action: 'create',
            file_path: filePath,
            content: encodeBase64(content),
            encoding: 'base64',
          });
        }
        break;
      }
      case 'modified': {
        const content = localFiles.get(diff.path) ?? localFiles.get(`/${diff.path}`) ?? localFiles.get(filePath);
        if (content !== undefined) {
          actions.push({
            action: 'update',
            file_path: filePath,
            content: encodeBase64(content),
            encoding: 'base64',
          });
        }
        break;
      }
      case 'deleted': {
        if (includeDeletes) {
          actions.push({ action: 'delete', file_path: filePath });
        }
        break;
      }
    }
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Base64 Helpers
// ---------------------------------------------------------------------------

export function decodeBase64(base64: string): string {
  try {
    const cleaned = base64.replace(/\s/g, '');
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary);
}
