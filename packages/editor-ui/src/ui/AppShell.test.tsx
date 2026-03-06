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
          auxiliaryPanels: [
            {
              id: 'plugin-ai',
              label: 'PluginAI',
              order: 99,
              render: () => <div>Plugin AI Panel</div>,
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
    fireEvent.click(screen.getByTitle('Toggle AI Assistant'));
    expect(screen.getByText('Plugin AI Panel')).toBeInTheDocument();
  });

  it('会在挂载时激活插件并在卸载时清理', () => {
    const cleanup = vi.fn();
    const activate = vi.fn(() => cleanup);

    const { unmount } = render(
      <AppShell
        pluginContext={{
          notifications: {
            info: vi.fn(),
          },
        }}
        plugins={[
          defineEditorPlugin({
            id: 'plugin.activate',
            name: 'Activate Plugin',
            activate,
          }),
        ]}
      >
        <div>Content</div>
      </AppShell>,
    );

    expect(activate).toHaveBeenCalledTimes(1);
    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('插件上下文命令总线优先执行插件命令并回退宿主命令', () => {
    const pluginExecute = vi.fn();
    const hostExecute = vi.fn();

    render(
      <AppShell
        pluginContext={{
          commands: {
            execute: hostExecute,
          },
        }}
        plugins={[
          defineEditorPlugin({
            id: 'plugin.commands',
            name: 'Commands Plugin',
            contributes: {
              commands: [
                {
                  id: 'plugin.run',
                  title: 'Plugin Run',
                  execute: pluginExecute,
                },
              ],
              sidebarTabs: [
                {
                  id: 'command-tab',
                  label: 'CommandTab',
                  order: 99,
                  render: ({ pluginContext }) => (
                    <div>
                      <button type="button" onClick={() => void pluginContext?.commands?.execute('plugin.run')}>
                        Run Plugin Command
                      </button>
                      <button type="button" onClick={() => void pluginContext?.commands?.execute('host.run')}>
                        Run Host Command
                      </button>
                    </div>
                  ),
                },
              ],
            },
          }),
        ]}
      >
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByText('CommandTab'));
    fireEvent.click(screen.getByRole('button', { name: 'Run Plugin Command' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run Host Command' }));

    expect(pluginExecute).toHaveBeenCalledTimes(1);
    expect(hostExecute).toHaveBeenCalledTimes(1);
    expect(hostExecute).toHaveBeenCalledWith('host.run', undefined);
  });
});
