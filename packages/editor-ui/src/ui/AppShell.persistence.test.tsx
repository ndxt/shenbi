import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineEditorPlugin } from '@shenbi/editor-plugin-api';
import { changeLanguage } from '@shenbi/i18n';
import { AppShell } from './AppShell';
import {
  WORKSPACE_PREFERENCES_NAMESPACE,
  WORKSPACE_WORKBENCH_KEY,
  type WorkspacePersistenceAdapter,
} from '../persistence/workspace-persistence';

const TEST_WORKSPACE_ID = 'test-workspace';

function getScopedStorageKey(workspaceId: string, namespace: string, key: string) {
  return `shenbi:workspace:${workspaceId}:${namespace}:${key}`;
}

function createAuxiliaryPanelPlugin() {
  return defineEditorPlugin({
    id: 'plugin.ai-width',
    name: 'AI Width Plugin',
    contributes: {
      auxiliaryPanels: [
        {
          id: 'plugin-ai-width',
          label: 'PluginAIWidth',
          order: 99,
          defaultOpen: true,
          defaultWidth: 300,
          render: () => <div>Plugin AI Width Panel</div>,
        },
      ],
    },
  });
}

describe('AppShell persistence', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    document.documentElement.className = '';
    await changeLanguage('en-US');
  });

  afterEach(async () => {
    await changeLanguage('en-US');
  });

  it('会恢复面板显示状态和辅助面板宽度', async () => {
    const plugins = [createAuxiliaryPanelPlugin()];

    const firstRender = render(
      <AppShell workspaceId={TEST_WORKSPACE_ID} plugins={plugins}>
        <div>Content</div>
      </AppShell>,
    );

    const firstPanel = screen.getByText('Plugin AI Width Panel').closest('div[style]');
    expect(firstPanel).not.toBeNull();

    const resizeHandles = firstRender.container.querySelectorAll('.cursor-col-resize');
    fireEvent.mouseDown(resizeHandles[1] as Element, { clientX: 1000 });
    fireEvent.mouseMove(document, { clientX: 900 });
    fireEvent.mouseUp(document);

    await waitFor(() => {
      expect(firstPanel).toHaveStyle({ width: '400px' });
    });

    fireEvent.click(screen.getByTitle('Toggle Sidebar'));
    await waitFor(() => {
      expect(screen.queryByText('Components')).toBeNull();
    });

    firstRender.unmount();

    render(
      <AppShell workspaceId={TEST_WORKSPACE_ID} plugins={plugins}>
        <div>Content</div>
      </AppShell>,
    );

    await waitFor(() => {
      expect(screen.queryByText('Components')).toBeNull();
    });
    const secondPanel = (await screen.findByText('Plugin AI Width Panel')).closest('div[style]');
    expect(secondPanel).not.toBeNull();
    await waitFor(() => {
      expect(secondPanel).toHaveStyle({ width: '400px' });
    });
  });

  it('不同 workspaceId 的布局状态互不污染', async () => {
    const firstRender = render(
      <AppShell workspaceId="workspace-a">
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByTitle('Toggle Sidebar'));
    await waitFor(() => {
      expect(screen.queryByText('Components')).toBeNull();
    });
    firstRender.unmount();

    render(
      <AppShell workspaceId="workspace-b">
        <div>Content</div>
      </AppShell>,
    );

    await waitFor(() => {
      expect(screen.getByText('Components')).toBeInTheDocument();
    });
  });

  it('会恢复主题和语言偏好', async () => {
    window.localStorage.setItem(
      getScopedStorageKey(TEST_WORKSPACE_ID, WORKSPACE_PREFERENCES_NAMESPACE, WORKSPACE_WORKBENCH_KEY),
      JSON.stringify({
        theme: 'light',
        locale: 'zh-CN',
      }),
    );

    render(
      <AppShell workspaceId={TEST_WORKSPACE_ID}>
        <div>Content</div>
      </AppShell>,
    );

    await waitFor(() => {
      expect(document.documentElement.classList.contains('theme-light')).toBe(true);
      expect(screen.getByTitle('切换主题')).toBeInTheDocument();
    });
  });

  it('不同 workspaceId 的偏好互不污染', async () => {
    window.localStorage.setItem(
      getScopedStorageKey('workspace-a', WORKSPACE_PREFERENCES_NAMESPACE, WORKSPACE_WORKBENCH_KEY),
      JSON.stringify({
        theme: 'light',
        locale: 'zh-CN',
      }),
    );

    const firstRender = render(
      <AppShell workspaceId="workspace-a">
        <div>Content</div>
      </AppShell>,
    );

    await waitFor(() => {
      expect(document.documentElement.classList.contains('theme-light')).toBe(true);
      expect(screen.getByTitle('切换主题')).toBeInTheDocument();
    });

    firstRender.unmount();

    render(
      <AppShell workspaceId="workspace-b">
        <div>Content</div>
      </AppShell>,
    );

    await waitFor(() => {
      expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
      expect(screen.getByTitle('Change Theme')).toBeInTheDocument();
    });
  });

  it('会通过自定义 persistenceAdapter 读写布局状态', async () => {
    const adapter: WorkspacePersistenceAdapter = {
      getJSON: vi.fn().mockImplementation(async (_workspaceId, namespace) => {
        if (namespace === 'layout') {
          return { showSidebar: false };
        }
        return { theme: 'light', locale: 'en-US' };
      }),
      setJSON: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    render(
      <AppShell workspaceId={TEST_WORKSPACE_ID} persistenceAdapter={adapter}>
        <div>Content</div>
      </AppShell>,
    );

    await waitFor(() => {
      expect(adapter.getJSON).toHaveBeenCalledWith(TEST_WORKSPACE_ID, 'layout', 'workbench');
      expect(adapter.getJSON).toHaveBeenCalledWith(TEST_WORKSPACE_ID, 'preferences', 'workbench');
      expect(screen.queryByText('Components')).toBeNull();
      expect(document.documentElement.classList.contains('theme-light')).toBe(true);
    });

    fireEvent.click(screen.getByTitle('Toggle Sidebar'));

    await waitFor(() => {
      expect(adapter.setJSON).toHaveBeenCalledWith(
        TEST_WORKSPACE_ID,
        'layout',
        'workbench',
        expect.objectContaining({
          showSidebar: true,
        }),
      );
    });

    fireEvent.click(screen.getByTitle('Change Theme'));
    fireEvent.click(screen.getByRole('button', { name: 'Shenbi Dark' }));

    await waitFor(() => {
      expect(adapter.setJSON).toHaveBeenCalledWith(
        TEST_WORKSPACE_ID,
        'preferences',
        'workbench',
        expect.objectContaining({
          theme: 'dark',
          locale: 'en-US',
        }),
      );
    });

    fireEvent.click(screen.getByTitle('Change Language'));
    fireEvent.click(screen.getByRole('button', { name: '简体中文' }));

    await waitFor(() => {
      expect(adapter.setJSON).toHaveBeenCalledWith(
        TEST_WORKSPACE_ID,
        'preferences',
        'workbench',
        expect.objectContaining({
          locale: 'zh-CN',
        }),
      );
      expect(screen.getByTitle('切换主题')).toBeInTheDocument();
    });
  });
});
