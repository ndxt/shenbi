import { useCallback, useMemo } from 'react';

/**
 * Parse the project ID from the current URL query string.
 *
 * Examples:
 *   `/?id=local-123`             → `local-123`
 *   `/locode/shenbi/?id=gitlab-42` → `gitlab-42`
 *   `/`                          → `null`
 */

function getBasePath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base = (import.meta as any).env?.BASE_URL as string | undefined;
    return base ?? '/';
  } catch {
    return '/';
  }
}

export function parseProjectIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const search = new URLSearchParams(window.location.search);
  return search.get('id');
}

export function buildProjectUrl(projectId: string): string {
  const base = getBasePath().replace(/\/+$/, '');
  // Use ?id= instead of pathname for better compatibility with Nginx/SPAs
  return `${base}/?id=${encodeURIComponent(projectId)}`;
}

export function navigateToProject(projectId: string): void {
  const url = buildProjectUrl(projectId);
  // Use pushState + reload rather than setting location.href directly.
  // This avoids jsdom "Not implemented: navigation" errors in tests
  // while achieving the same full-page-reload effect in real browsers.
  window.history.pushState(null, '', url);
  try {
    window.location.reload();
  } catch {
    // jsdom throws "Not implemented: navigation" — safe to ignore in tests.
  }
}

export function useProjectIdFromUrl(): {
  urlProjectId: string | null;
  navigateToProject: (projectId: string) => void;
} {
  const urlProjectId = useMemo(() => parseProjectIdFromUrl(), []);

  const navigate = useCallback((projectId: string) => {
    navigateToProject(projectId);
  }, []);

  return { urlProjectId, navigateToProject: navigate };
}
