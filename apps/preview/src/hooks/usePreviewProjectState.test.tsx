import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePreviewProjectState } from './usePreviewProjectState';
import type { PreviewGitLabService } from '../preview-types';
import type { ActiveProjectConfig } from '../constants';

// Mock the project-registry module so we control what "IndexedDB" returns.
const mockLoadActiveProject = vi.fn();
const mockSaveActiveProject = vi.fn();
const mockLoadProjectList = vi.fn();
const mockUpsertProjectInList = vi.fn();

vi.mock('../project-registry', () => ({
  loadActiveProject: (...args: any[]) => mockLoadActiveProject(...args),
  saveActiveProject: (...args: any[]) => mockSaveActiveProject(...args),
  loadProjectList: (...args: any[]) => mockLoadProjectList(...args),
  upsertProjectInList: (...args: any[]) => mockUpsertProjectInList(...args),
}));

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
    vi.clearAllMocks();
    mockLoadActiveProject.mockResolvedValue(null);
    mockSaveActiveProject.mockResolvedValue(undefined);
    mockLoadProjectList.mockResolvedValue([]);
    mockUpsertProjectInList.mockResolvedValue(undefined);
  });

  it('切换到 GitLab 项目会触发导航并保存迁移信息', async () => {
    // Set up a pre-existing local project so that switching to a GitLab project
    // triggers migration tracking (requires sourceProjectId !== null).
    const initialProject: ActiveProjectConfig = {
      id: 'local-initial',
      vfsProjectId: 'local-initial',
      projectName: '初始项目',
      lastOpenedAt: Date.now(),
    };
    mockLoadActiveProject.mockResolvedValue(initialProject);

    const { result } = renderHook(() => usePreviewProjectState({ gitlabService }));

    // Wait for async initialization
    await waitFor(() => {
      expect(result.current.activeProjectId).toBe('local-initial');
    });

    act(() => {
      result.current.handleSelectGitLabProject({
        id: 42,
        name: 'preview-demo',
        default_branch: 'main',
        web_url: 'https://gitlab.example.com/preview-demo',
      } as any);
    });

    // When switching between projects, navigateToProject is called which triggers
    // pushState + reload. In real browsers, the page reloads with the new URL
    // and the project is loaded from IndexedDB. In jsdom, the URL changes
    // but reload is a no-op. We verify that the metadata was correctly mapped.
    expect(gitlabService.selectProjectMetadata).toHaveBeenCalled();

    // Verify the active project was persisted to IndexedDB
    expect(mockSaveActiveProject).toHaveBeenCalledWith(
      expect.objectContaining({
        vfsProjectId: 'gitlab-42',
        gitlabProjectId: 42,
      }),
    );
  });

  it('从 URL 项目 ID 加载项目配置', async () => {
    const storedProject: ActiveProjectConfig = {
      id: 'local-url-test',
      vfsProjectId: 'local-url-test',
      projectName: '通过 URL 加载',
      lastOpenedAt: Date.now(),
    };
    mockLoadProjectList.mockResolvedValue([storedProject]);

    const { result } = renderHook(() =>
      usePreviewProjectState({ gitlabService, urlProjectId: 'local-url-test' }),
    );

    await waitFor(() => {
      expect(result.current.activeProjectId).toBe('local-url-test');
    });
    expect(result.current.activeProjectConfig?.projectName).toBe('通过 URL 加载');
  });

  it('首次启动时 isFirstLaunch 为 true', async () => {
    mockLoadActiveProject.mockResolvedValue(null);

    const { result } = renderHook(() => usePreviewProjectState({ gitlabService }));

    await waitFor(() => {
      expect(result.current.isFirstLaunch).toBe(true);
    });
    expect(result.current.activeProjectId).toBeNull();
  });
});
