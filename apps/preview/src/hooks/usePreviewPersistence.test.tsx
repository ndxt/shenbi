import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { usePreviewPersistence } from './usePreviewPersistence';
import type { RenderMode, ScenarioKey } from '../preview-types';

describe('usePreviewPersistence', () => {
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
      const [activeScenario, setActiveScenario] = useState<ScenarioKey>('user-management');
      const [renderMode, setRenderMode] = useState<RenderMode>('iframe');

      usePreviewPersistence({
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
        workspacePersistence: workspacePersistence as any,
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
});
