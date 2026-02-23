import type { UserListQuery, UserListResult, UserRecord } from '../features/crud/public-api';

export interface CreateUserInput {
  name: string;
  email: string;
  status: UserRecord['status'];
  role: UserRecord['role'];
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  status?: UserRecord['status'];
  role?: UserRecord['role'];
}

export interface UsersRepo {
  list(query: UserListQuery): UserListResult;
  create(input: CreateUserInput): UserRecord;
  update(id: number, input: UpdateUserInput): UserRecord | null;
  remove(id: number): boolean;
  snapshot(): UserRecord[];
}

const USER_STATUSES: UserRecord['status'][] = ['enabled', 'disabled'];
const USER_ROLES: UserRecord['role'][] = ['admin', 'operator', 'viewer'];

function normalizeText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function compareValue(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  const a = String(left ?? '');
  const b = String(right ?? '');
  const result = a.localeCompare(b, 'en', {
    numeric: true,
    sensitivity: 'base',
  });
  if (result === 0) {
    return 0;
  }
  return result > 0 ? 1 : -1;
}

function createSeedUser(index: number): UserRecord {
  const status = USER_STATUSES[index % USER_STATUSES.length] ?? 'enabled';
  const role = USER_ROLES[index % USER_ROLES.length] ?? 'viewer';
  const month = (index % 12) + 1;
  const day = (index % 28) + 1;
  const createdAt = `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T10:00:00.000Z`;

  return {
    id: index + 1,
    name: `User ${index + 1}`,
    email: `user${index + 1}@shenbi.dev`,
    status,
    role,
    createdAt,
  };
}

export function createUsersRepo(seedCount = 50): UsersRepo {
  const totalSeedCount = Math.max(0, Math.floor(seedCount));
  let users: UserRecord[] = Array.from({ length: totalSeedCount }, (_unused, index) =>
    createSeedUser(index),
  );

  return {
    list(query: UserListQuery): UserListResult {
      const keyword = normalizeText(query.keyword);
      const status = normalizeText(query.status);
      const page = Number.isFinite(query.page) && query.page > 0 ? Math.floor(query.page) : 1;
      const pageSize = Number.isFinite(query.pageSize) && query.pageSize > 0
        ? Math.floor(query.pageSize)
        : 10;

      let filtered = users.filter((user) => {
        if (status && normalizeText(user.status) !== status) {
          return false;
        }
        if (!keyword) {
          return true;
        }
        return (
          normalizeText(user.name).includes(keyword) ||
          normalizeText(user.email).includes(keyword)
        );
      });

      const sortField = query.sortField ?? null;
      const sortOrder = query.sortOrder ?? null;
      if (sortField && (sortOrder === 'ascend' || sortOrder === 'descend')) {
        filtered = [...filtered].sort((left, right) => {
          const value = compareValue(
            left[sortField as keyof UserRecord],
            right[sortField as keyof UserRecord],
          );
          return sortOrder === 'ascend' ? value : -value;
        });
      }

      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      return {
        list: filtered.slice(start, end),
        total,
      };
    },

    create(input: CreateUserInput): UserRecord {
      const nextId = users.reduce((max, user) => Math.max(max, user.id), 0) + 1;
      const record: UserRecord = {
        id: nextId,
        name: input.name,
        email: input.email,
        status: input.status,
        role: input.role,
        createdAt: new Date().toISOString(),
      };
      users = [record, ...users];
      return record;
    },

    update(id: number, input: UpdateUserInput): UserRecord | null {
      let nextRecord: UserRecord | null = null;
      users = users.map((user) => {
        if (user.id !== id) {
          return user;
        }
        nextRecord = {
          ...user,
          ...input,
        };
        return nextRecord;
      });
      return nextRecord;
    },

    remove(id: number): boolean {
      const before = users.length;
      users = users.filter((user) => user.id !== id);
      return users.length < before;
    },

    snapshot(): UserRecord[] {
      return [...users];
    },
  };
}
