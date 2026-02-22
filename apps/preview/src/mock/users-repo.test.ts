import { describe, expect, it } from 'vitest';
import { createUsersRepo } from './users-repo';

describe('preview/mock/users-repo', () => {
  it('默认返回分页结果与总数', () => {
    const repo = createUsersRepo(50);
    const result = repo.list({ page: 1, pageSize: 10 });

    expect(result.total).toBe(50);
    expect(result.list).toHaveLength(10);
    expect(result.list[0]?.id).toBe(1);
  });

  it('支持 keyword + status 过滤', () => {
    const repo = createUsersRepo(20);
    const result = repo.list({
      page: 1,
      pageSize: 20,
      keyword: 'user1',
      status: 'enabled',
    });

    expect(result.total).toBeGreaterThan(0);
    expect(result.list.every((user) => user.status === 'enabled')).toBe(true);
    expect(
      result.list.every((user) =>
        user.name.toLowerCase().includes('user1') ||
        user.email.toLowerCase().includes('user1'),
      ),
    ).toBe(true);
  });

  it('支持排序', () => {
    const repo = createUsersRepo(10);
    const asc = repo.list({
      page: 1,
      pageSize: 10,
      sortField: 'email',
      sortOrder: 'ascend',
    });
    const desc = repo.list({
      page: 1,
      pageSize: 10,
      sortField: 'email',
      sortOrder: 'descend',
    });

    const ascFirst = asc.list[0];
    const ascSecond = asc.list[1];
    const descFirst = desc.list[0];
    const descSecond = desc.list[1];

    expect(ascFirst).toBeDefined();
    expect(ascSecond).toBeDefined();
    expect(descFirst).toBeDefined();
    expect(descSecond).toBeDefined();

    expect((ascFirst as { email: string }).email <= (ascSecond as { email: string }).email).toBe(true);
    expect((descFirst as { email: string }).email >= (descSecond as { email: string }).email).toBe(true);
  });

  it('支持 create / update / remove', () => {
    const repo = createUsersRepo(1);
    const created = repo.create({
      name: 'Alice',
      email: 'alice@shenbi.dev',
      role: 'admin',
      status: 'enabled',
    });

    expect(created.id).toBe(2);
    expect(repo.snapshot()).toHaveLength(2);

    const updated = repo.update(created.id, {
      status: 'disabled',
      name: 'Alice Updated',
    });
    expect(updated?.status).toBe('disabled');
    expect(updated?.name).toBe('Alice Updated');

    const removed = repo.remove(created.id);
    expect(removed).toBe(true);
    expect(repo.snapshot()).toHaveLength(1);
  });
});
