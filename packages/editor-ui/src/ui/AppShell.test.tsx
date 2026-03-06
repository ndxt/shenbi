import { fireEvent, render, screen } from '@testing-library/react';
import { AppShell } from './AppShell';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { defineEditorPlugin, type ActivityBarItemIconProps } from '@shenbi/editor-plugin-api';

function MockIcon(_props: ActivityBarItemIconProps) {
  return <span aria-hidden>Icon</span>;
}

describe('AppShell', () => {
  it('renders all main shell regions', () => {
    render(
      <AppShell>
        <div data-testid="test-content">Content</div>
      </AppShell>
    );

    // Verify regions by presence of characteristic text or roles
    expect(screen.getByText('Components')).toBeInTheDocument();
    expect(screen.getByText('Props')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Run')).toBeInTheDocument();
    expect(screen.getByText('Editor UI Package')).toBeInTheDocument();
    expect(screen.getByTestId('test-content')).toBeInTheDocument();
  });

  it('卸载时会清理挂载的主题 class', () => {
    const { unmount } = render(
      <AppShell>
        <div>Theme Content</div>
      </AppShell>,
    );

    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    unmount();
    expect(document.documentElement.classList.contains('theme-dark')).toBe(false);
  });

  it('点击画布节点会触发 onCanvasSelectNode', () => {
    const onCanvasSelectNode = vi.fn();
    render(
      <AppShell onCanvasSelectNode={onCanvasSelectNode}>
        <div data-shenbi-node-id="node-1">Canvas Node</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByText('Canvas Node'));
    expect(onCanvasSelectNode).toHaveBeenCalledWith('node-1');
  });

  it('支持通过 plugins 注入侧栏和检查器 tab', () => {
    const plugins = [
      defineEditorPlugin({
        id: 'plugin.empty',
        name: 'Empty Plugin',
      }),
      defineEditorPlugin({
        id: 'plugin.demo',
        name: 'Demo Plugin',
        contributes: {
          activityBarItems: [
            {
              id: 'demo',
              label: 'Demo',
              icon: MockIcon,
              order: 99,
            },
          ],
          sidebarTabs: [
            {
              id: 'plugin-assets',
              label: 'PluginAssets',
              order: 99,
              render: () => <div>Plugin Assets Panel</div>,
            },
          ],
          inspectorTabs: [
            {
              id: 'plugin-debug',
              label: 'PluginDebug',
              order: 99,
              render: () => <div>Plugin Debug Panel</div>,
            },
          ],
        },
      }),
    ];

    render(
      <AppShell plugins={plugins}>
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByText('PluginAssets'));
    expect(screen.getByText('Plugin Assets Panel')).toBeInTheDocument();

    fireEvent.click(screen.getByText('PluginDebug'));
    expect(screen.getByText('Plugin Debug Panel')).toBeInTheDocument();

    expect(screen.getByLabelText('Demo')).toBeInTheDocument();
  });
});
