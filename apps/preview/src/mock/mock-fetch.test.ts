import { afterEach, describe, expect, it } from 'vitest';
import { installMockFetch, type MockFetchController } from './mock-fetch';

async function readJson(response: Response) {
  return response.json() as Promise<{ code: number; data?: any; message?: string }>;
}

describe('preview/mock/mock-fetch', () => {
  let controller: MockFetchController | null = null;

  afterEach(() => {
    controller?.restore();
    controller = null;
  });

  it('支持 GET /api/users 分页查询', async () => {
    controller = installMockFetch({
      minDelayMs: 0,
      maxDelayMs: 0,
      seedCount: 5,
    });

    const response = await fetch('/api/users?page=1&pageSize=2');
    const payload = await readJson(response);

    expect(response.ok).toBe(true);
    expect(payload.code).toBe(0);
    expect(payload.data?.total).toBe(5);
    expect(payload.data?.list).toHaveLength(2);
  });

  it('支持 POST /api/users 与 PUT /api/users/:id', async () => {
    controller = installMockFetch({
      minDelayMs: 0,
      maxDelayMs: 0,
      seedCount: 1,
    });

    const createRes = await fetch('/api/users', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Bob',
        email: 'bob@shenbi.dev',
        status: 'enabled',
        role: 'operator',
      }),
    });
    const createPayload = await readJson(createRes);
    const createdId = Number(createPayload.data?.id);

    const updateRes = await fetch(`/api/users/${createdId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Bob Updated',
        status: 'disabled',
      }),
    });
    const updatePayload = await readJson(updateRes);

    expect(createRes.ok).toBe(true);
    expect(updateRes.ok).toBe(true);
    expect(updatePayload.data?.name).toBe('Bob Updated');
    expect(updatePayload.data?.status).toBe('disabled');
  });

  it('支持 DELETE /api/users/:id', async () => {
    controller = installMockFetch({
      minDelayMs: 0,
      maxDelayMs: 0,
      seedCount: 2,
    });

    const removeRes = await fetch('/api/users/1', { method: 'DELETE' });
    const removePayload = await readJson(removeRes);

    const listRes = await fetch('/api/users?page=1&pageSize=10');
    const listPayload = await readJson(listRes);

    expect(removeRes.ok).toBe(true);
    expect(removePayload.code).toBe(0);
    expect(listPayload.data?.total).toBe(1);
  });

  it('fallbackToOriginal=false 时，未知路由返回 404', async () => {
    controller = installMockFetch({
      minDelayMs: 0,
      maxDelayMs: 0,
      fallbackToOriginal: false,
    });

    const response = await fetch('/api/unknown');
    const payload = await readJson(response);

    expect(response.status).toBe(404);
    expect(payload.code).toBe(404);
  });
});
