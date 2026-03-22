import { describe, expect, it, vi } from 'vitest';
import { createPreviewGitLabSyncAdapter } from './createPreviewGitLabSyncAdapter';
import type { PreviewProjectState } from '../../preview-types';

function createProjectState(): PreviewProjectState {
  return {
    activeProjectConfig: {
      id: 'gitlab-42',
      gitlabProjectId: 42,
      vfsProjectId: 'gitlab-42',
      projectName: 'preview-demo',
      branch: 'main',
      lastOpenedAt: Date.now(),
      gitlabUrl: 'https://gitlab.example.com/group/preview-demo',
    },
    lastGitLabProjectConfig: null,
    activeProjectId: 'gitlab-42',
    gitlabUser: null,
    gitlabBranches: [],
    consumePendingMigration: () => null,
    handleBranchChange: vi.fn(),
    handleLogout: vi.fn(),
    handleSelectProject: vi.fn(),
    handleSelectGitLabProject: vi.fn(),
    handleDeleteProject: vi.fn(),
    handleUnbindProject: vi.fn(),
  };
}

describe('createPreviewGitLabSyncAdapter', () => {
  it('会把 VFS 文件映射为 GitLab Sync 所需的读写接口', async () => {
    const vfs = {
      listTree: vi.fn(async () => [
        { id: 'file-1', type: 'file', path: '/待办/看板.page.json' },
      ]),
      readFile: vi.fn(async () => ({ id: 'page-1', body: [] })),
      getNodeByPath: vi.fn(async () => null),
      writeFile: vi.fn(async () => undefined),
      createDirectory: vi.fn(async (_projectId, _parentId, name: string) => ({
        id: `dir-${name}`,
      })),
      createFile: vi.fn(async () => ({ id: 'created-file' })),
      deleteFile: vi.fn(async () => undefined),
    } as any;

    const refreshFileTree = vi.fn();
    const project = createProjectState();
    const adapter = createPreviewGitLabSyncAdapter({
      activeProjectId: 'gitlab-42',
      project,
      refreshFileTree,
      vfs,
    });

    await expect(adapter.getLocalFiles()).resolves.toEqual(
      new Map([['/待办/看板.page.json', JSON.stringify({ id: 'page-1', body: [] }, null, 2)]]),
    );

    await adapter.writeLocalFile('/待办/新页面.page.json', JSON.stringify({ id: 'page-2', body: [] }));
    expect(vfs.createDirectory).toHaveBeenCalled();
    expect(vfs.createFile).toHaveBeenCalled();

    vfs.getNodeByPath.mockResolvedValueOnce({ id: 'file-1' });
    await adapter.deleteLocalFile('/待办/看板.page.json');
    expect(vfs.deleteFile).toHaveBeenCalledWith('gitlab-42', 'file-1');

    adapter.refreshFileTree();
    expect(refreshFileTree).toHaveBeenCalled();
    expect(adapter.activeProjectId).toBe(42);
    expect(adapter.activeBranch).toBe('main');
  });
});
