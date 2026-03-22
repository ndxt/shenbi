import { useMemo, useRef } from 'react';
import {
  createWorkspaceFilesHostAdapter,
  type FilesHostAdapter,
} from '@shenbi/editor-ui';
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

/**
 * Create a proxy that delegates all property access to `ref.current`,
 * so closures capturing the proxy always see the latest value.
 */
function createRefProxy<T extends object>(ref: { current: T }): T {
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const value = Reflect.get(ref.current, prop, receiver);
      return typeof value === 'function' ? value.bind(ref.current) : value;
    },
    has(_target, prop) {
      return prop in ref.current;
    },
    ownKeys() {
      return Reflect.ownKeys(ref.current);
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Object.getOwnPropertyDescriptor(ref.current, prop);
    },
  });
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
  // Store rapidly-changing objects in refs so plugin manifests stay stable.
  // Plugin render / execute closures use proxies over these refs to always
  // read the latest values without forcing manifest recreation.
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  const canvasRef = useRef(canvas);
  canvasRef.current = canvas;

  const projectRef = useRef(project);
  projectRef.current = project;

  // Stable proxies — same object identity across renders, but always
  // delegate to the latest ref.current.
  const workspaceProxy = useMemo(() => createRefProxy(workspaceRef), []);
  const canvasProxy = useMemo(() => createRefProxy(canvasRef), []);
  const projectProxy = useMemo(() => createRefProxy(projectRef), []);

  // Stable ref for the files host adapter — updated each render.
  const filesHostAdapterRef = useRef<FilesHostAdapter>(
    createWorkspaceFilesHostAdapter(workspace),
  );
  filesHostAdapterRef.current = createWorkspaceFilesHostAdapter(workspace);

  // Only recreate plugins when truly structural properties change:
  // - appMode (shell vs scenarios)
  // - vfsInitialized (file system becomes available)
  // - filesPrimaryPanelOptions identity (panel config changes)
  // All other state (tabs, schemas, dirty flags) flows through proxies/refs.
  const vfsInitialized = workspace.vfsInitialized;
  const filesPrimaryPanelOptions = workspace.filesPrimaryPanelOptions;

  return useMemo(() => {
    const context = {
      appMode,
      project: projectProxy,
      workspace: workspaceProxy,
      canvas: canvasProxy,
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
        vfsInitialized,
        hasFilesPrimaryPanel: Boolean(filesPrimaryPanelOptions),
      },
      adapters: {
        files: {
          ...filesHostAdapterRef.current,
          ref: filesHostAdapterRef,
        },
        gitlabSync: createPreviewGitLabSyncAdapter({
          activeProjectId: projectProxy.activeProjectId,
          project: projectProxy,
          refreshFileTree: workspaceProxy.refreshFsTree,
          vfs,
        }),
      },
    };

    return resolvePreviewPlugins(context as any);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    appMode,
    vfsInitialized,
    filesPrimaryPanelOptions,
    executeAppCommand,
    filesT,
    previewT,
    services,
    vfs,
    workspaceProxy,
    canvasProxy,
    projectProxy,
  ]);
}
