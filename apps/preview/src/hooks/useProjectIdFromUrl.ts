import { useCallback, useMemo } from 'react';

/**
 * Parse the project ID from the current URL pathname.
 *
 * In dev mode the base is `/`, in production it is `/locode/shenbi/`.
 * The project ID is the first path segment after the base.
 *
 * Examples:
 *   `/local-123`                 → `local-123`
 *   `/locode/shenbi/gitlab-42`    → `gitlab-42`
 *   `/`                           → `null`
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

export function parseProjectIdFromUrl(
  pathname: string = typeof window !== 'undefined' ? window.location.pathname : '/',
): string | null {
  const base = getBasePath().replace(/\/+$/, '');
  let rest = pathname;

  if (base && rest.startsWith(base)) {
    rest = rest.slice(base.length);
  }

  // Strip leading slash and take first segment
  const segment = rest.replace(/^\/+/, '').split('/')[0] ?? '';
  return segment || null;
}

export function buildProjectUrl(projectId: string): string {
  const base = getBasePath().replace(/\/+$/, '');
  return `${base}/${encodeURIComponent(projectId)}`;
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
