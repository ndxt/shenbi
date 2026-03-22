import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectManagerDialog } from './ProjectManagerDialog';
import type { PreviewGitLabService } from './preview-types';

describe('ProjectManagerDialog', () => {
  const gitlabService: PreviewGitLabService = {
    getAuthStatus: vi.fn(async () => ({
      authenticated: true,
      defaultGroupId: 7,
    })),
    logout: vi.fn(async () => undefined),
    listBranches: vi.fn(async () => []),
    listGroupProjects: vi.fn(async () => [{
      id: 42,
      name: 'preview-demo',
      name_with_namespace: 'group/preview-demo',
      path_with_namespace: 'group/preview-demo',
      description: null,
      web_url: 'https://gitlab.example.com/group/preview-demo',
      default_branch: 'main',
      last_activity_at: '2026-03-22T08:00:00Z',
    }]),
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

  it('clone 页会通过 gitlab service 拉取项目并在选择时复用 service 元数据', async () => {
    const onSelectProject = vi.fn();

    render(
      <ProjectManagerDialog
        open
        activeProjectId="local-1"
        gitlabUser={{ username: 'alice' }}
        gitlabService={gitlabService}
        onClose={vi.fn()}
        onSelectProject={onSelectProject}
        onDeleteProject={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clone' }));

    await waitFor(() => {
      expect(gitlabService.getAuthStatus).toHaveBeenCalled();
      expect(gitlabService.listGroupProjects).toHaveBeenCalledWith(7, undefined);
    });

    fireEvent.click(screen.getByText('preview-demo'));

    await waitFor(() => {
      expect(gitlabService.selectProjectMetadata).toHaveBeenCalled();
      expect(onSelectProject).toHaveBeenCalledWith(expect.objectContaining({
        id: 'gitlab-42',
        gitlabProjectId: 42,
      }));
    });
  });
});
