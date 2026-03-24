import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useWorkspacePersistence } from './useWorkspacePersistence';

import type { FileContent } from '@shenbi/editor-core';

const createSessionsMock = () => {
  const store = new Map<string, { content: FileContent; dirty: boolean }>();
  return {
    ensureSession: vi.fn(({ fileId, content, dirty }: { fileId: string; content: FileContent; dirty?: boolean }) => {
      store.set(fileId, { content, dirty: dirty ?? false });
      return { workingContent: content, dirty: dirty ?? false };
    }),
    getSession: vi.fn((fileId: string) => {
      const s = store.get(fileId);
      return s ? { workingContent: s.content, dirty: s.dirty } : undefined;
    }),
  };
};

describe('useWorkspacePersistence', () => {
  it('会恢复场景和 render mode，并继续持久化后续变更', async () => {
    const setJSON = vi.fn(async () => undefined);
    const workspacePersistence = {
      getJSON: vi.fn(async <T,>(_: string, key: string) => {
        if (key === 'active-scenario') {
          return 'tree-management' as T;
        }
        if (key === 'canvas-render-mode') {
          return 'direct' as T;
        }
        return null;
      }),
      setJSON,
    } as const;

    const { result } = renderHook(() => {
      const [activeScenario, setActiveScenario] = useState<'user-management' | 'tree-management'>('user-management');
      const [renderMode, setRenderMode] = useState<'direct' | 'iframe'>('iframe');

      useWorkspacePersistence({
        appMode: 'shell',
        activeProjectId: 'local-1',
        activeScenario,
        setActiveScenario,
        renderMode,
        setRenderMode,
        fileEditor: {
          commands: {
            execute: vi.fn(async () => undefined),
          },
        },
        fileExplorerExpandedIds: [],
        fileExplorerFocusedId: undefined,
        setFileExplorerExpandedIds: vi.fn(),
        setFileExplorerFocusedId: vi.fn(),
        scenarioValues: ['user-management', 'tree-management'],
        renderModeValues: ['direct', 'iframe'],
        tabManager: {
          restoreSnapshot: vi.fn(),
        },
        tabSnapshot: {
          tabs: [],
          activeTabId: undefined,
        },
        vfs: {
          listTree: vi.fn(async () => []),
          readFile: vi.fn(async () => ({})),
        },
        vfsInitialized: false,
        vfsInitializationFailed: true,
        workspacePersistence,
        persistenceKeys: {
          namespace: 'preview-debug',
          activeScenarioKey: 'active-scenario',
          renderModeKey: 'canvas-render-mode',
          shellSessionKey: 'shell-session',
        },
        createEmptySchema: () => ({ id: 'shell-page', body: [] }),
      });

      return {
        activeScenario,
        setActiveScenario,
        renderMode,
        setRenderMode,
      };
    });

    await waitFor(() => {
      expect(result.current.activeScenario).toBe('tree-management');
      expect(result.current.renderMode).toBe('direct');
    });

    await act(async () => {
      result.current.setActiveScenario('user-management');
      result.current.setRenderMode('iframe');
    });

    await waitFor(() => {
      expect(setJSON).toHaveBeenCalledWith('preview-debug', 'active-scenario', 'user-management');
      expect(setJSON).toHaveBeenCalledWith('preview-debug', 'canvas-render-mode', 'iframe');
    });
  });

  it('在 StrictMode 下仍然会恢复 shell tabs', async () => {
    const restoreSnapshot = vi.fn();
    const execute = vi.fn(async () => undefined);
    const storedSession = {
      tabs: {
        tabs: [
          {
            fileId: 'file-1',
            fileName: 'home',
            filePath: '/pages/home.page.json',
            fileType: 'page',
            schema: { id: 'page-home', name: 'home', body: [] },
            isDirty: false,
          },
        ],
        activeTabId: 'file-1',
      },
      expandedIds: ['dir-1'],
      focusedId: 'file-1',
    };
    const workspacePersistence = {
      getJSON: vi.fn(async <T,>(_: string, key: string) => {
        if (key === 'shell-session') {
          return storedSession as T;
        }
        return null;
      }),
      setJSON: vi.fn(async () => undefined),
    } as const;

    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: {},
    });

    renderHook(() => {
      const [activeScenario, setActiveScenario] = useState<'user-management' | 'tree-management'>('user-management');
      const [renderMode, setRenderMode] = useState<'direct' | 'iframe'>('iframe');

      useWorkspacePersistence({
        appMode: 'shell',
        activeProjectId: 'local-1',
        activeScenario,
        setActiveScenario,
        renderMode,
        setRenderMode,
        fileEditor: {
          commands: {
            execute,
          },
        },
        fileExplorerExpandedIds: [],
        fileExplorerFocusedId: undefined,
        setFileExplorerExpandedIds: vi.fn(),
        setFileExplorerFocusedId: vi.fn(),
        scenarioValues: ['user-management', 'tree-management'],
        renderModeValues: ['direct', 'iframe'],
        tabManager: {
          restoreSnapshot,
        },
        tabSnapshot: {
          tabs: [],
          activeTabId: undefined,
        },
        vfs: {
          listTree: vi.fn(async () => [
            { id: 'dir-1', type: 'directory', name: 'pages', path: '/pages' },
            { id: 'file-1', type: 'file', name: 'home', path: '/pages/home.page.json', fileType: 'page' },
          ]),
          readFile: vi.fn(async () => ({ id: 'page-home', name: 'home', body: [] })),
        },
        vfsInitialized: true,
        vfsInitializationFailed: false,
        workspacePersistence,
        persistenceKeys: {
          namespace: 'preview-debug',
          activeScenarioKey: 'active-scenario',
          renderModeKey: 'canvas-render-mode',
          shellSessionKey: 'shell-session',
        },
        createEmptySchema: () => ({ id: 'shell-page', body: [] }),
        sessions: createSessionsMock(),
      });
    }, {
      wrapper: StrictMode,
    });

    await waitFor(() => {
      expect(restoreSnapshot).toHaveBeenCalledWith({
        tabs: [
          expect.objectContaining({
            fileId: 'file-1',
            fileName: 'home',
            filePath: '/pages/home.page.json',
          }),
        ],
        activeTabId: 'file-1',
      });
      expect(execute).toHaveBeenCalledWith('editor.restoreSnapshot', {
        snapshot: {
          schema: { id: 'page-home', name: 'home', body: [] },
          currentFileId: 'file-1',
          isDirty: false,
        },
      });
    });
  });

  it('在 hydration 进行中 rerender 不会重复恢复 shell session', async () => {
    let resolveShellSession: ((value: unknown) => void) | undefined;
    const restoreSnapshot = vi.fn();
    const execute = vi.fn(async () => undefined);
    const setActiveScenario = vi.fn();
    const setRenderMode = vi.fn();
    const listTree = vi.fn(async () => [
      { id: 'dir-1', type: 'directory', name: 'pages', path: '/pages' },
      { id: 'file-1', type: 'file', name: 'home', path: '/pages/home.page.json', fileType: 'page' },
    ]);
    const readFile = vi.fn(async () => ({ id: 'page-home', name: 'home', body: [] }));
    const workspacePersistence = {
      getJSON: vi.fn((_: string, key: string) => {
        if (key === 'shell-session') {
          return new Promise((resolve) => {
            resolveShellSession = resolve;
          });
        }
        return Promise.resolve(null);
      }),
      setJSON: vi.fn(async () => undefined),
    } as const;
    const stableFileEditor = {
      commands: {
        execute,
      },
    };
    const stableTabManager = {
      restoreSnapshot,
    };
    const stableVfs = {
      listTree,
      readFile,
    };
    const createEmptySchema = () => ({ id: 'shell-page', body: [] });

    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: {},
    });

    const { rerender } = renderHook(({
      expandedSetter,
      focusedSetter,
    }: {
      expandedSetter: (value: string[]) => void;
      focusedSetter: (value: string | undefined) => void;
    }) => {
      useWorkspacePersistence({
        appMode: 'shell',
        activeProjectId: 'local-1',
        activeScenario: 'user-management',
        setActiveScenario,
        renderMode: 'iframe',
        setRenderMode,
        fileEditor: stableFileEditor,
        fileExplorerExpandedIds: [],
        fileExplorerFocusedId: undefined,
        setFileExplorerExpandedIds: expandedSetter,
        setFileExplorerFocusedId: focusedSetter,
        scenarioValues: ['user-management', 'tree-management'],
        renderModeValues: ['direct', 'iframe'],
        tabManager: stableTabManager,
        tabSnapshot: {
          tabs: [],
          activeTabId: undefined,
        },
        vfs: stableVfs,
        vfsInitialized: true,
        vfsInitializationFailed: false,
        workspacePersistence,
        persistenceKeys: {
          namespace: 'preview-debug',
          activeScenarioKey: 'active-scenario',
          renderModeKey: 'canvas-render-mode',
          shellSessionKey: 'shell-session',
        },
        createEmptySchema,
        sessions: createSessionsMock(),
      });
    }, {
      initialProps: {
        expandedSetter: vi.fn(),
        focusedSetter: vi.fn(),
      },
    });

    rerender({
      expandedSetter: vi.fn(),
      focusedSetter: vi.fn(),
    });

    act(() => {
      resolveShellSession?.({
        tabs: {
          tabs: [
            {
              fileId: 'file-1',
              fileName: 'home',
              filePath: '/pages/home.page.json',
              fileType: 'page',
              schema: { id: 'page-home', name: 'home', body: [] },
              isDirty: false,
            },
          ],
          activeTabId: 'file-1',
        },
        expandedIds: ['dir-1'],
        focusedId: 'file-1',
      });
    });

    await waitFor(() => {
      const shellSessionReads = workspacePersistence.getJSON.mock.calls.filter(([, key]) => key === 'shell-session');
      expect(shellSessionReads).toHaveLength(1);
      expect(restoreSnapshot).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledTimes(1);
    });
  });

  it('恢复 api tab 时优先使用磁盘内容而不是旧 session 中的脏 schema', async () => {
    const restoreSnapshot = vi.fn();
    const execute = vi.fn(async () => undefined);
    const workspacePersistence = {
      getJSON: vi.fn(async <T,>(_: string, key: string) => {
        if (key === 'shell-session') {
          return {
            tabs: {
              tabs: [
                {
                  fileId: 'api-1',
                  fileName: 'gateway',
                  filePath: '/gateway.api.json',
                  fileType: 'api',
                  schema: { id: 'stale', type: 'api-gateway', nodes: [], edges: [] },
                  isDirty: true,
                },
              ],
              activeTabId: 'api-1',
            },
            expandedIds: [],
          } as T;
        }
        return null;
      }),
      setJSON: vi.fn(async () => undefined),
    } as const;

    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: {},
    });

    renderHook(() => {
      const [activeScenario, setActiveScenario] = useState<'user-management' | 'tree-management'>('user-management');
      const [renderMode, setRenderMode] = useState<'direct' | 'iframe'>('iframe');

      useWorkspacePersistence({
        appMode: 'shell',
        activeProjectId: 'local-1',
        activeScenario,
        setActiveScenario,
        renderMode,
        setRenderMode,
        fileEditor: {
          commands: {
            execute,
          },
        },
        fileExplorerExpandedIds: [],
        fileExplorerFocusedId: undefined,
        setFileExplorerExpandedIds: vi.fn(),
        setFileExplorerFocusedId: vi.fn(),
        scenarioValues: ['user-management', 'tree-management'],
        renderModeValues: ['direct', 'iframe'],
        tabManager: {
          restoreSnapshot,
        },
        tabSnapshot: {
          tabs: [],
          activeTabId: undefined,
        },
        vfs: {
          listTree: vi.fn(async () => [
            { id: 'api-1', type: 'file', name: 'gateway', path: '/gateway.api.json', fileType: 'api' },
          ]),
          readFile: vi.fn(async () => ({ id: 'live', name: 'gateway-live', type: 'api-gateway', nodes: [{ id: 'start-1' }], edges: [] })),
        },
        vfsInitialized: true,
        vfsInitializationFailed: false,
        workspacePersistence,
        persistenceKeys: {
          namespace: 'preview-debug',
          activeScenarioKey: 'active-scenario',
          renderModeKey: 'canvas-render-mode',
          shellSessionKey: 'shell-session',
        },
        createEmptySchema: () => ({ id: 'shell-page', body: [] }),
        sessions: createSessionsMock(),
      });
    });

    await waitFor(() => {
      expect(restoreSnapshot).toHaveBeenCalledWith({
        tabs: [
          expect.objectContaining({
            fileId: 'api-1',
            fileType: 'api',
            isDirty: false,
          }),
        ],
        activeTabId: 'api-1',
      });
      expect(execute).toHaveBeenCalledWith('editor.restoreSnapshot', {
        snapshot: {
          schema: { id: 'shell-page', body: [] },
          currentFileId: 'api-1',
          isDirty: false,
        },
      });
    });
  });
});
