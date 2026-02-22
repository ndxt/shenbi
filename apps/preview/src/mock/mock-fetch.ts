import type { UserListQuery, UserRecord } from '../features/crud/public-api';
import { createUsersRepo, type UsersRepo } from './users-repo';

interface ApiSuccess<T> {
  code: 0;
  data: T;
}

interface ApiError {
  code: number;
  message: string;
}

interface InstallMockFetchOptions {
  minDelayMs?: number;
  maxDelayMs?: number;
  seedCount?: number;
  repo?: UsersRepo;
  fallbackToOriginal?: boolean;
}

export interface MockFetchController {
  repo: UsersRepo;
  restore: () => void;
}

const DEFAULT_MIN_DELAY = 200;
const DEFAULT_MAX_DELAY = 500;

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readDelay(minDelayMs: number, maxDelayMs: number): number {
  if (maxDelayMs <= minDelayMs) {
    return Math.max(0, minDelayMs);
  }
  const delta = maxDelayMs - minDelayMs;
  return Math.max(0, minDelayMs + Math.floor(Math.random() * (delta + 1)));
}

function jsonResponse(payload: ApiSuccess<unknown> | ApiError, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function buildListQuery(searchParams: URLSearchParams): UserListQuery {
  const page = Number(searchParams.get('page') ?? 1);
  const pageSize = Number(searchParams.get('pageSize') ?? 10);
  const sortOrderRaw = searchParams.get('sortOrder');
  const sortOrder = sortOrderRaw === 'ascend' || sortOrderRaw === 'descend'
    ? sortOrderRaw
    : null;
  const sortField = searchParams.get('sortField');
  const keyword = searchParams.get('keyword');
  const status = searchParams.get('status');

  const query: UserListQuery = {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 10,
    sortField: sortField || null,
    sortOrder,
  };

  if (keyword != null) {
    query.keyword = keyword;
  }
  if (status != null) {
    query.status = status;
  }

  return query;
}

async function readRequestBody(init?: RequestInit): Promise<Record<string, any>> {
  const raw = init?.body;
  if (!raw) {
    return {};
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, any>;
    } catch (_error) {
      return {};
    }
  }
  if (raw instanceof URLSearchParams) {
    return Object.fromEntries(raw.entries());
  }
  if (typeof FormData !== 'undefined' && raw instanceof FormData) {
    return Object.fromEntries(raw.entries());
  }
  return {};
}

function parseRequestUrl(input: RequestInfo | URL): URL | null {
  try {
    if (typeof input === 'string') {
      return new URL(input, 'http://localhost');
    }
    if (input instanceof URL) {
      return new URL(input.toString(), 'http://localhost');
    }
    return new URL(input.url, 'http://localhost');
  } catch (_error) {
    return null;
  }
}

export function installMockFetch(options: InstallMockFetchOptions = {}): MockFetchController {
  const minDelayMs = options.minDelayMs ?? DEFAULT_MIN_DELAY;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY;
  const repo = options.repo ?? createUsersRepo(options.seedCount ?? 50);
  const fallbackToOriginal = options.fallbackToOriginal ?? true;
  const originalFetch = globalThis.fetch;

  const mockedFetch: typeof fetch = async (input, init) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const requestUrl = parseRequestUrl(input);
    if (!requestUrl) {
      return fallbackToOriginal && originalFetch
        ? originalFetch(input, init)
        : jsonResponse({ code: 400, message: 'Invalid URL' }, 400);
    }

    const path = requestUrl.pathname;
    const delay = readDelay(minDelayMs, maxDelayMs);

    const shouldHandleUsersList = path === '/api/users';
    const shouldHandleUsersById = path.startsWith('/api/users/');
    if (!shouldHandleUsersList && !shouldHandleUsersById) {
      return fallbackToOriginal && originalFetch
        ? originalFetch(input, init)
        : jsonResponse({ code: 404, message: 'Not Found' }, 404);
    }

    await sleep(delay);

    if (shouldHandleUsersList && method === 'GET') {
      const result = repo.list(buildListQuery(requestUrl.searchParams));
      return jsonResponse({ code: 0, data: result });
    }

    if (shouldHandleUsersList && method === 'POST') {
      const body = await readRequestBody(init);
      const created = repo.create({
        name: String(body.name ?? ''),
        email: String(body.email ?? ''),
        status: (body.status as UserRecord['status']) ?? 'enabled',
        role: (body.role as UserRecord['role']) ?? 'viewer',
      });
      return jsonResponse({ code: 0, data: created });
    }

    if (shouldHandleUsersById && method === 'PUT') {
      const id = Number(path.slice('/api/users/'.length));
      const body = await readRequestBody(init);
      const updated = repo.update(id, body);
      if (!updated) {
        return jsonResponse({ code: 404, message: 'User not found' }, 404);
      }
      return jsonResponse({ code: 0, data: updated });
    }

    if (shouldHandleUsersById && method === 'DELETE') {
      const id = Number(path.slice('/api/users/'.length));
      const removed = repo.remove(id);
      if (!removed) {
        return jsonResponse({ code: 404, message: 'User not found' }, 404);
      }
      return jsonResponse({ code: 0, data: null });
    }

    return jsonResponse({ code: 405, message: `Method ${method} is not allowed` }, 405);
  };

  globalThis.fetch = mockedFetch;

  return {
    repo,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}
