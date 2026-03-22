import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPreviewGitLabService } from './previewGitLabService';

describe('createPreviewGitLabService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('会通过 GitLab proxy 获取 auth、分支、项目列表并生成项目配置', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/oauth/status')) {
        return {
          ok: true,
          json: async () => ({
            authenticated: true,
            user: {
              id: 1,
              username: 'alice',
              avatarUrl: 'https://avatar',
              instanceUrl: 'https://gitlab.example.com',
            },
            defaultGroupId: 7,
          }),
        };
      }
      if (url.includes('/branches')) {
        return {
          ok: true,
          json: async () => [{ name: 'main' }, { name: 'feature/demo' }],
        };
      }
      if (url.includes('/groups/7/projects')) {
        return {
          ok: true,
          json: async () => [{
            id: 42,
            name: 'preview-demo',
            name_with_namespace: 'group/preview-demo',
            path_with_namespace: 'group/preview-demo',
            description: null,
            web_url: 'https://gitlab.example.com/group/preview-demo',
            default_branch: 'main',
            last_activity_at: '2026-03-22T08:00:00Z',
          }],
        };
      }
      if (url.includes('/oauth/logout')) {
        expect(init?.method).toBe('POST');
        return {
          ok: true,
          json: async () => ({ ok: true }),
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const service = createPreviewGitLabService();

    await expect(service.getAuthStatus()).resolves.toMatchObject({
      authenticated: true,
      defaultGroupId: 7,
      user: { username: 'alice' },
    });
    await expect(service.listBranches(42)).resolves.toEqual(['main', 'feature/demo']);
    await expect(service.listGroupProjects(7, 'demo')).resolves.toMatchObject([
      { id: 42, name: 'preview-demo' },
    ]);
    await expect(service.logout()).resolves.toBeUndefined();

    const metadata = service.selectProjectMetadata({
      id: 42,
      name: 'preview-demo',
      name_with_namespace: 'group/preview-demo',
      path_with_namespace: 'group/preview-demo',
      description: null,
      web_url: 'https://gitlab.example.com/group/preview-demo',
      default_branch: 'main',
      last_activity_at: '2026-03-22T08:00:00Z',
    });
    expect(metadata).toMatchObject({
      id: 'gitlab-42',
      gitlabProjectId: 42,
      vfsProjectId: 'gitlab-42',
      projectName: 'preview-demo',
      branch: 'main',
      gitlabUrl: 'https://gitlab.example.com/group/preview-demo',
    });
  });
});
