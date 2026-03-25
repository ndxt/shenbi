import type { IndexedDBFileSystemAdapter } from '@shenbi/editor-core';
import type {
  PreviewGitLabSyncAdapter,
  PreviewProjectState,
} from '../../preview-types';

interface CreatePreviewGitLabSyncAdapterOptions {
  activeProjectId: string;
  project: PreviewProjectState;
  refreshFileTree: () => void;
  vfs: IndexedDBFileSystemAdapter;
}

export function createPreviewGitLabSyncAdapter({
  activeProjectId,
  project,
  refreshFileTree,
  vfs,
}: CreatePreviewGitLabSyncAdapterOptions): PreviewGitLabSyncAdapter {
  return {
    activeProjectId:
      project.activeProjectConfig?.gitlabProjectId
      ?? project.lastGitLabProjectConfig?.gitlabProjectId,
    activeBranch:
      project.activeProjectConfig?.branch
      ?? project.lastGitLabProjectConfig?.branch,
    onSelectProject: project.handleSelectGitLabProject,
    onUnbindProject: project.activeProjectConfig?.gitlabProjectId
      ? project.handleUnbindProject
      : undefined,
    projectName: project.activeProjectConfig?.projectName,
    async getLocalFiles() {
      const nodes = await vfs.listTree(activeProjectId);
      const files = new Map<string, string>();
      for (const node of nodes) {
        if (node.type !== 'file') {
          continue;
        }
        try {
          const content = await vfs.readFile(activeProjectId, node.id);
          if (content && typeof content === 'object') {
            files.set(node.path, JSON.stringify(content, null, 2));
          }
        } catch {
          // Skip unreadable files.
        }
      }
      return files;
    },
    async writeLocalFile(path: string, content: string) {
      try {
        const parsed = JSON.parse(content);
        const vfsPath = `/${path.replace(/^\/+/, '')}`;
        const node = await vfs.getNodeByPath(activeProjectId, vfsPath).catch(() => null);
        if (node) {
          await vfs.writeFile(activeProjectId, node.id, parsed);
          return;
        }

        const knownExts: [string, string][] = [
          ['.page.json', 'page'],
          ['.api.json', 'api'],
          ['.flow.json', 'flow'],
          ['.db.json', 'db'],
          ['.dict.json', 'dict'],
        ];
        const cleanPath = path.replace(/^\/+/, '');
        let basePath = cleanPath;
        let fileType = 'page';
        for (const [ext, nextFileType] of knownExts) {
          if (cleanPath.endsWith(ext)) {
            basePath = cleanPath.slice(0, -ext.length);
            fileType = nextFileType;
            break;
          }
        }

        const parts = basePath.split('/');
        const fileName = parts.pop()!;
        let parentId: string | null = null;
        for (let index = 0; index < parts.length; index += 1) {
          const dirPath = `/${parts.slice(0, index + 1).join('/')}`;
          const dirNode = await vfs.getNodeByPath(activeProjectId, dirPath).catch(() => null);
          if (dirNode) {
            parentId = dirNode.id;
          } else {
            const newDir = await vfs.createDirectory(activeProjectId, parentId, parts[index]!);
            parentId = newDir.id;
          }
        }

        await vfs.createFile(activeProjectId, parentId, fileName, fileType as 'page', parsed);
      } catch {
        // Ignore invalid JSON payloads.
      }
    },
    async deleteLocalFile(path: string) {
      try {
        const vfsPath = `/${path.replace(/^\/+/, '')}`;
        const node = await vfs.getNodeByPath(activeProjectId, vfsPath).catch(() => null);
        if (node) {
          await vfs.deleteFile(activeProjectId, node.id);
        }
      } catch {
        // Ignore delete misses.
      }
    },
    refreshFileTree,
  };
}
