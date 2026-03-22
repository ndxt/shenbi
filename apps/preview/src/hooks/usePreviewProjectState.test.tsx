import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePreviewProjectState } from './usePreviewProjectState';
import type { PreviewGitLabService } from '../preview-types';

describe('usePreviewProjectState', () => {
  const gitlabService: PreviewGitLabService = {
    getAuthStatus: vi.fn(async () => ({ authenticated: false })),
    logout: vi.fn(async () => undefined),
    listBranches: vi.fn(async () => ['main', 'feature/x']),
    listGroupProjects: vi.fn(async () => []),
    selectProjectMetadata: vi.fn((project) => ({
      id: `gitlab-${project.id}`,
      gitlabProjectId: project.id,
      vfsProjectId: `gitlab-${project.id}`,
      projectName: project.name,
      branch: project.default_branch || 'main',
      createdAt: Date.now(),
      lastOpenedAt: Date.now(),
      gitlabUrl: project.web_url,
    })),
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('切换到 GitLab 项目时会记录迁移信息并更新分支列表', async () => {
    const { result } = renderHook(() => usePreviewProjectState({ gitlabService }));
    const previousProjectId = result.current.activeProjectId;

    await act(async () => {
      result.current.handleSelectGitLabProject({
        id: 42,
        name: 'preview-demo',
        default_branch: 'main',
        web_url: 'https://gitlab.example.com/preview-demo',
      } as any);
    });

    await waitFor(() => {
      expect(result.current.activeProjectId).toBe('gitlab-42');
      expect(result.current.gitlabBranches).toEqual(['main', 'feature/x']);
    });

    expect(result.current.consumePendingMigration()).toEqual({
      sourceProjectId: previousProjectId,
      targetProjectId: 'gitlab-42',
    });
    expect(result.current.consumePendingMigration()).toBeNull();
    expect(gitlabService.selectProjectMetadata).toHaveBeenCalled();
    expect(gitlabService.listBranches).toHaveBeenCalledWith(42);
  });
});
