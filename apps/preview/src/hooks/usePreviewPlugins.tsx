import { useMemo } from 'react';
import { createWorkspaceFilesHostAdapter } from '@shenbi/editor-ui';
import { createPreviewGitLabSyncAdapter } from '../features/gitlab-sync/createPreviewGitLabSyncAdapter';
import { resolvePreviewPlugins } from '../preview-plugin-registry';
import type {
  PreviewCanvasState,
  PreviewProjectState,
  PreviewServiceContainer,
  PreviewWorkspaceState,
} from '../preview-types';

interface UsePreviewPluginsOptions {
  appMode: import('../preview-types').AppMode;
  previewT: (...args: any[]) => string;
  filesT: (...args: any[]) => string;
  executeAppCommand: (commandId: string, payload?: unknown) => Promise<unknown>;
  vfs: import('@shenbi/editor-core').IndexedDBFileSystemAdapter;
  services: PreviewServiceContainer;
  project: PreviewProjectState;
  workspace: PreviewWorkspaceState;
  canvas: PreviewCanvasState;
}

export function usePreviewPlugins({
  appMode,
  previewT,
  filesT,
  executeAppCommand,
  vfs,
  services,
  project,
  workspace,
  canvas,
}: UsePreviewPluginsOptions) {
  return useMemo(() => {
    const context = {
      appMode,
      project,
      workspace,
      canvas,
      services,
      commands: {
        executeAppCommand,
      },
      translations: {
        previewT,
        filesT,
      },
      featureFlags: {
        shellMode: appMode === 'shell',
        vfsInitialized: workspace.vfsInitialized,
        hasFilesPrimaryPanel: Boolean(workspace.filesPrimaryPanelOptions),
      },
      adapters: {
        files: createWorkspaceFilesHostAdapter(workspace),
        gitlabSync: createPreviewGitLabSyncAdapter({
          activeProjectId: project.activeProjectId,
          project,
          refreshFileTree: workspace.refreshFsTree,
          vfs,
        }),
      },
    } as const;

    return resolvePreviewPlugins(context);
  }, [
    appMode,
    canvas,
    executeAppCommand,
    filesT,
    previewT,
    project,
    services,
    vfs,
    workspace,
  ]);
}
