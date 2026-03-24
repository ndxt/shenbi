import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AppShell as RawAppShell } from './AppShell';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { defineEditorPlugin, type ActivityBarItemIconProps } from '@shenbi/editor-plugin-api';
import type { WorkspacePersistenceAdapter } from '../persistence/workspace-persistence';
import { createPageCanvasPlugin } from '@shenbi/editor-plugin-page-canvas';

const pageCanvasPlugin = createPageCanvasPlugin();

function MockIcon(_props: ActivityBarItemIconProps) {
  return <span aria-hidden>Icon</span>;
}

type AppShellProps = Omit<React.ComponentProps<typeof RawAppShell>, 'workspaceId'> & {
  workspaceId?: string;
};

function AppShell(props: AppShellProps) {
  const mergedPlugins = React.useMemo(() => {
    const base = props.plugins ?? [];
    return [pageCanvasPlugin, ...base];
  }, [props.plugins]);
  return <RawAppShell {...props} plugins={mergedPlugins} workspaceId={props.workspaceId ?? 'test-workspace'} />;
}

function createPageTab() {
  return {
    fileId: 'page-1',
    filePath: '/page-1.json',
    fileType: 'page' as const,
    fileName: 'Page 1',
    schema: { id: 'page', name: 'Page 1', body: [] },
    isDirty: false,
  };
}

describe('AppShell', () => {
  it('辅助面板宽度拖拽后会持久化并在重新挂载后恢复', async () => {
    window.localStorage.clear();
    const plugins = [
      defineEditorPlugin({
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
      }),
    ];

    const firstRender = render(
      <AppShell plugins={plugins}>
        <div>Content</div>
      </AppShell>,
    );

    const firstPanel = screen.getByText('Plugin AI Width Panel').closest('div[style]');
    expect(firstPanel).not.toBeNull();
    expect(firstPanel).toHaveStyle({ width: '300px' });

    const resizeHandle = firstPanel?.querySelector('.cursor-col-resize');
    expect(resizeHandle).not.toBeNull();
    fireEvent.mouseDown(resizeHandle as Element, { clientX: 1000 });
    fireEvent.mouseMove(document, { clientX: 900 });
    fireEvent.mouseUp(document);

    await waitFor(() => {
      expect(firstPanel).toHaveStyle({ width: '400px' });
    });

    firstRender.unmount();

    render(
      <AppShell tabs={[createPageTab()]} activeTabId="page-1" plugins={plugins}>
        <div>Content</div>
      </AppShell>,
    );

    const secondPanel = screen.getByText('Plugin AI Width Panel').closest('div[style]');
    expect(secondPanel).not.toBeNull();
    await waitFor(() => {
      expect(secondPanel).toHaveStyle({ width: '400px' });
    });
  });

  it('不同 workspaceId 的布局状态互不污染', async () => {
    window.localStorage.clear();

    const firstRender = render(
      <AppShell workspaceId="workspace-a">
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByTitle('Toggle Sidebar'));
    firstRender.unmount();

    render(
      <AppShell workspaceId="workspace-b">
        <div>Content</div>
      </AppShell>,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-shenbi-shortcut-area="sidebar"]')).not.toBeNull();
    });
  });

  it('会通过自定义 persistenceAdapter 读写布局状态', async () => {
    const adapter: WorkspacePersistenceAdapter = {
      getJSON: vi.fn().mockResolvedValue({
        showSidebar: false,
      }),
      setJSON: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    render(
      <AppShell persistenceAdapter={adapter}>
        <div>Content</div>
      </AppShell>,
    );

    await waitFor(() => {
      expect(adapter.getJSON).toHaveBeenCalledWith('test-workspace', 'layout', 'workbench');
    });
    await waitFor(() => {
      expect(document.querySelector('[data-shenbi-shortcut-area="sidebar"]')).toBeNull();
    });

    fireEvent.click(screen.getByTitle('Toggle Sidebar'));

    await waitFor(() => {
      expect(adapter.setJSON).toHaveBeenCalled();
    });
  });

  it('renders all main shell regions', () => {
    render(
      <AppShell tabs={[createPageTab()]} activeTabId="page-1">
        <div data-testid="test-content">Content</div>
      </AppShell>
    );

    // Verify regions by presence of characteristic text or roles
    expect(document.querySelector('[data-shenbi-shortcut-area="activity-bar"]')).not.toBeNull();
    expect(document.querySelector('[data-shenbi-shortcut-area="sidebar"]')).not.toBeNull();
    expect(document.querySelector('[data-shenbi-shortcut-area="inspector"]')).not.toBeNull();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Run')).toBeInTheDocument();
    expect(screen.getByText('Editor UI Package')).toBeInTheDocument();
    expect(screen.getByTestId('test-content')).toBeInTheDocument();
  });

  it('shows an empty state instead of canvas chrome when the tab workspace has no open tabs', () => {
    render(
      <AppShell tabs={[]} activeTabId={undefined}>
        <div data-testid="test-content">Content</div>
      </AppShell>,
    );

    expect(screen.getByText('No file open')).toBeInTheDocument();
    expect(screen.getByText('Open Command Palette')).toBeInTheDocument();
    expect(screen.queryByText('Run')).not.toBeInTheDocument();
    expect(screen.queryByRole('toolbar', { name: 'Canvas Tools' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Canvas Zoom Controls')).not.toBeInTheDocument();
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

  it('switching tabs remounts the canvas renderer for the next file', async () => {
    const mountSpy = vi.fn();
    const unmountSpy = vi.fn();
    const plugins = [
      defineEditorPlugin({
        id: 'plugin.gateway-renderer-test',
        name: 'Gateway Renderer Test',
        contributes: {
          canvasRenderers: [
            {
              id: 'gateway-renderer-test',
              fileTypes: ['api'],
              render: (context) => {
                const fileId = context.file.id ?? 'unknown';
                return (
                  <TestCanvasRenderer
                    fileId={fileId}
                    onMount={mountSpy}
                    onUnmount={unmountSpy}
                  />
                );
              },
            },
          ],
        },
      }),
    ];
    const tabs = [
      {
        fileId: 'api-1',
        filePath: '/api-1.json',
        fileType: 'api' as const,
        fileName: 'API 1',
        schema: { id: 'api-1', name: 'API 1', body: [] },
        isDirty: false,
      },
      {
        fileId: 'api-2',
        filePath: '/api-2.json',
        fileType: 'api' as const,
        fileName: 'API 2',
        schema: { id: 'api-2', name: 'API 2', body: [] },
        isDirty: false,
      },
    ];

    const { rerender } = render(
      <AppShell tabs={tabs} activeTabId="api-1" plugins={plugins}>
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.getByTestId('test-canvas-renderer')).toHaveTextContent('api-1');
    expect(mountSpy).toHaveBeenCalledTimes(1);
    expect(unmountSpy).not.toHaveBeenCalled();

    rerender(
      <AppShell tabs={tabs} activeTabId="api-2" plugins={plugins}>
        <div>Content</div>
      </AppShell>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('test-canvas-renderer')).toHaveTextContent('api-2');
    });
    expect(mountSpy).toHaveBeenCalledTimes(2);
    expect(unmountSpy).toHaveBeenCalledTimes(1);
  });

  it('switching renderer tabs reseeds document content for the next file', async () => {
    const plugins = [
      defineEditorPlugin({
        id: 'plugin.gateway-renderer-content-test',
        name: 'Gateway Renderer Content Test',
        contributes: {
          canvasRenderers: [
            {
              id: 'gateway-renderer-content-test',
              fileTypes: ['api'],
              render: (context) => (
                <div data-testid="test-canvas-renderer-content">
                  {String(context.file.id)}:{String((context.content as { id?: string } | undefined)?.id ?? 'none')}
                </div>
              ),
            },
          ],
        },
      }),
    ];
    const tabs = [
      {
        fileId: 'api-1',
        filePath: '/api-1.json',
        fileType: 'api' as const,
        fileName: 'API 1',
        schema: { id: 'api-1', name: 'API 1', body: [] },
        isDirty: false,
      },
      {
        fileId: 'api-2',
        filePath: '/api-2.json',
        fileType: 'api' as const,
        fileName: 'API 2',
        schema: { id: 'api-2', name: 'API 2', body: [] },
        isDirty: false,
      },
    ];
    const rendererContentByFileId: Record<string, Record<string, unknown>> = {
      'api-1': { id: 'doc-api-1', type: 'api-gateway' },
      'api-2': { id: 'doc-api-2', type: 'api-gateway' },
    };

    const { rerender } = render(
      <AppShell
        tabs={tabs}
        activeTabId="api-1"
        plugins={plugins}
        getRendererContent={(fileId) => rendererContentByFileId[fileId]}
      >
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.getByTestId('test-canvas-renderer-content')).toHaveTextContent('api-1:doc-api-1');

    rerender(
      <AppShell
        tabs={tabs}
        activeTabId="api-2"
        plugins={plugins}
        getRendererContent={(fileId) => rendererContentByFileId[fileId]}
      >
        <div>Content</div>
      </AppShell>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('test-canvas-renderer-content')).toHaveTextContent('api-2:doc-api-2');
    });
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

  it('点击画布空白会触发 onCanvasDeselectNode', () => {
    const onCanvasDeselectNode = vi.fn();
    render(
      <AppShell onCanvasDeselectNode={onCanvasDeselectNode}>
        <div data-shenbi-node-id="node-1">Canvas Node</div>
      </AppShell>,
    );

    const surfaceRoot = screen.getByText('Canvas Node').parentElement;
    expect(surfaceRoot).not.toBeNull();
    fireEvent.click(surfaceRoot as Element);
    expect(onCanvasDeselectNode).toHaveBeenCalledTimes(1);
  });

  it('支持通过 plugins 注入侧栏和检查器 tab', async () => {
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
      <AppShell tabs={[createPageTab()]} activeTabId="page-1" plugins={plugins}>
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.click(await screen.findByText('PluginAssets'));
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

  it('插件激活抛错时会通知错误且不影响其他插件', () => {
    const error = vi.fn();
    const healthyActivate = vi.fn();

    render(
      <AppShell
        pluginContext={{
          notifications: {
            error,
          },
        }}
        plugins={[
          defineEditorPlugin({
            id: 'plugin.broken',
            name: 'Broken Plugin',
            activate: () => {
              throw new Error('boom');
            },
          }),
          defineEditorPlugin({
            id: 'plugin.healthy',
            name: 'Healthy Plugin',
            activate: healthyActivate,
          }),
        ]}
      >
        <div>Content</div>
      </AppShell>,
    );

    expect(error).toHaveBeenCalledWith('Plugin "Broken Plugin" activate failed: boom');
    expect(healthyActivate).toHaveBeenCalledTimes(1);
  });

  it('插件异步激活失败时会通知错误', async () => {
    const error = vi.fn();

    render(
      <AppShell
        pluginContext={{
          notifications: {
            error,
          },
        }}
        plugins={[
          defineEditorPlugin({
            id: 'plugin.async-broken',
            name: 'Async Broken Plugin',
            activate: async () => {
              throw new Error('async boom');
            },
          }),
        ]}
      >
        <div>Content</div>
      </AppShell>,
    );

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith('Plugin "Async Broken Plugin" activate failed: async boom');
    });
  });

  it('异步激活插件在卸载后 resolve cleanup 也会立即清理', async () => {
    let resolveCleanup!: (value: (() => void) | undefined) => void;
    const cleanup = vi.fn();

    const { unmount } = render(
      <AppShell
        plugins={[
          defineEditorPlugin({
            id: 'plugin.async-cleanup',
            name: 'Async Cleanup Plugin',
            activate: () => new Promise<(() => void) | undefined>((resolve) => {
              resolveCleanup = resolve;
            }),
          }),
        ]}
      >
        <div>Content</div>
      </AppShell>,
    );

    unmount();
    resolveCleanup(cleanup);

    await waitFor(() => {
      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });

  it('插件上下文命令总线优先执行插件命令并回退宿主命令', () => {
    const pluginExecute = vi.fn();
    const hostExecute = vi.fn();

    render(
      <AppShell
        tabs={[createPageTab()]}
        activeTabId="page-1"
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
                  render: ({ environment }) => (
                    <div>
                      <button type="button" onClick={() => void environment.pluginContext?.commands?.execute('plugin.run')}>
                        Run Plugin Command
                      </button>
                      <button type="button" onClick={() => void environment.pluginContext?.commands?.execute('host.run')}>
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

  it('插件声明的快捷键可以触发命令', () => {
    const pluginExecute = vi.fn();

    render(
      <AppShell
        plugins={[
          defineEditorPlugin({
            id: 'plugin.shortcuts',
            name: 'Shortcuts Plugin',
            contributes: {
              commands: [
                {
                  id: 'plugin.shortcuts.run',
                  title: 'Shortcut Run',
                  execute: pluginExecute,
                },
              ],
              shortcuts: [
                {
                  id: 'plugin.shortcuts.run.binding',
                  commandId: 'plugin.shortcuts.run',
                  keybinding: 'Mod+S',
                  when: 'editorFocused',
                },
              ],
            },
          }),
        ]}
      >
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.keyDown(screen.getByText('Content'), { key: 's', ctrlKey: true });

    expect(pluginExecute).toHaveBeenCalledTimes(1);
  });

  it('输入框聚焦时默认屏蔽快捷键', () => {
    const pluginExecute = vi.fn();

    render(
      <AppShell
        plugins={[
          defineEditorPlugin({
            id: 'plugin.shortcuts.blocked',
            name: 'Blocked Shortcuts Plugin',
            contributes: {
              commands: [
                {
                  id: 'plugin.shortcuts.blocked.run',
                  title: 'Blocked Shortcut Run',
                  execute: pluginExecute,
                },
              ],
              shortcuts: [
                {
                  id: 'plugin.shortcuts.blocked.run.binding',
                  commandId: 'plugin.shortcuts.blocked.run',
                  keybinding: 'Mod+S',
                },
              ],
            },
          }),
        ]}
      >
        <input aria-label="editor-input" />
      </AppShell>,
    );

    const input = screen.getByLabelText('editor-input');
    act(() => {
      input.focus();
    });
    fireEvent.keyDown(input, { key: 's', ctrlKey: true });

    expect(pluginExecute).not.toHaveBeenCalled();
  });

  it('快捷键不会绕过命令禁用态', () => {
    const pluginExecute = vi.fn();

    render(
      <AppShell
        pluginContext={{
          selection: {
            getSelectedNodeId: () => undefined,
          },
        }}
        plugins={[
          defineEditorPlugin({
            id: 'plugin.shortcuts.disabled',
            name: 'Disabled Shortcut Plugin',
            contributes: {
              commands: [
                {
                  id: 'plugin.shortcuts.disabled.run',
                  title: 'Disabled Shortcut Run',
                  enabledWhen: 'hasSelection',
                  execute: pluginExecute,
                },
              ],
              shortcuts: [
                {
                  id: 'plugin.shortcuts.disabled.run.binding',
                  commandId: 'plugin.shortcuts.disabled.run',
                  keybinding: 'Mod+Shift+K',
                  when: 'editorFocused',
                },
              ],
            },
          }),
        ]}
      >
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.keyDown(screen.getByText('Content'), { key: 'k', ctrlKey: true, shiftKey: true });

    expect(pluginExecute).not.toHaveBeenCalled();
  });

  it('区域焦点快捷键会按目标区域生效', () => {
    const pluginExecute = vi.fn();

    render(
      <AppShell
        plugins={[
          defineEditorPlugin({
            id: 'plugin.shortcuts.sidebar-focus',
            name: 'Sidebar Focus Shortcut Plugin',
            contributes: {
              commands: [
                {
                  id: 'plugin.shortcuts.sidebar-focus.run',
                  title: 'Sidebar Focus Run',
                  execute: pluginExecute,
                },
              ],
              shortcuts: [
                {
                  id: 'plugin.shortcuts.sidebar-focus.run.binding',
                  commandId: 'plugin.shortcuts.sidebar-focus.run',
                  keybinding: 'Mod+Shift+L',
                  when: 'sidebarFocused',
                },
              ],
            },
          }),
        ]}
      >
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.keyDown(screen.getByText('Content'), { key: 'l', ctrlKey: true, shiftKey: true });
    expect(pluginExecute).not.toHaveBeenCalled();

    const sidebarArea = document.querySelector('[data-shenbi-shortcut-area="sidebar"]');
    expect(sidebarArea).not.toBeNull();
    fireEvent.keyDown(sidebarArea as Element, { key: 'l', ctrlKey: true, shiftKey: true });
    expect(pluginExecute).toHaveBeenCalledTimes(1);
  });

  it('可以打开命令面板并展示命令与快捷键', () => {
    render(
      <AppShell
        plugins={[
          defineEditorPlugin({
            id: 'plugin.palette',
            name: 'Palette Plugin',
            contributes: {
              commands: [
                {
                  id: 'plugin.palette.run',
                  title: 'Palette Run',
                  execute: vi.fn(),
                },
              ],
              shortcuts: [
                {
                  id: 'plugin.palette.run.binding',
                  commandId: 'plugin.palette.run',
                  keybinding: 'Mod+R',
                },
              ],
            },
          }),
        ]}
      >
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByTitle('Open Command Palette'));

    const searchInput = screen.getByLabelText('Command Palette Search');
    const palette = searchInput.closest('.w-\\[560px\\]');

    expect(searchInput).toBeInTheDocument();
    expect(palette).not.toBeNull();
    expect(within(palette as HTMLElement).getByRole('option', { name: /Open Command Palette/ })).toBeInTheDocument();
    expect(within(palette as HTMLElement).getByRole('option', { name: /Palette Run/ })).toBeInTheDocument();
    expect(within(palette as HTMLElement).getByText('Mod+R')).toBeInTheDocument();
  });

  it('命令面板可以执行插件命令', () => {
    const pluginExecute = vi.fn();

    render(
      <AppShell
        plugins={[
          defineEditorPlugin({
            id: 'plugin.palette.run',
            name: 'Palette Run Plugin',
            contributes: {
              commands: [
                {
                  id: 'plugin.palette.execute',
                  title: 'Palette Execute',
                  execute: pluginExecute,
                },
              ],
            },
          }),
        ]}
      >
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByTitle('Open Command Palette'));
    fireEvent.click(screen.getByRole('option', { name: /Palette Execute/ }));

    expect(pluginExecute).toHaveBeenCalledTimes(1);
  });

  it('宿主内置命令会出现在命令面板中', () => {
    const hostExecute = vi.fn();

    render(
      <AppShell
        pluginContext={{
          commands: {
            execute: hostExecute,
          },
        }}
      >
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByTitle('Open Command Palette'));

    const searchInput = screen.getByLabelText('Command Palette Search');
    const palette = searchInput.closest('.w-\\[560px\\]');

    expect(palette).not.toBeNull();
    expect(within(palette as HTMLElement).getByRole('option', { name: /Save File/ })).toBeInTheDocument();
    expect(within(palette as HTMLElement).getByRole('option', { name: /Undo/ })).toBeInTheDocument();
    expect(within(palette as HTMLElement).getByRole('option', { name: /Hide Sidebar/ })).toBeInTheDocument();
    expect(within(palette as HTMLElement).getByText('Mod+S')).toBeInTheDocument();
    expect(within(palette as HTMLElement).getByText('Mod+Z')).toBeInTheDocument();
  });

  it('宿主快捷键可以打开命令面板', () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.keyDown(screen.getByText('Content'), { key: 'p', ctrlKey: true, shiftKey: true });

    expect(screen.getByLabelText('Command Palette Search')).toBeInTheDocument();
  });

  it('宿主命令默认不会显示在工具栏中', () => {
    const hostExecute = vi.fn();

    render(
      <AppShell
        pluginContext={{
          commands: {
            execute: hostExecute,
          },
        }}
      >
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.queryByRole('button', { name: 'Save File' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hide Sidebar' })).toBeNull();
  });

  it('未聚焦编辑器时 editorFocused 命令不会出现在菜单中', async () => {
    render(
      <div>
        <button type="button">Outside Trigger</button>
        <AppShell
          plugins={[
            defineEditorPlugin({
              id: 'plugin.focus-aware',
              name: 'Focus Aware Plugin',
              contributes: {
                commands: [
                  {
                    id: 'plugin.focus-aware.run',
                    title: 'Focused Only Command',
                    when: 'editorFocused',
                    execute: vi.fn(),
                  },
                ],
                menus: [
                  {
                    id: 'plugin.focus-aware.run.menu',
                    label: 'Focused Only Command',
                    commandId: 'plugin.focus-aware.run',
                    target: 'toolbar-start',
                    order: 90,
                  },
                ],
              },
            }),
          ]}
        >
          <div>Content</div>
        </AppShell>
      </div>,
    );

    const outsideButton = screen.getByRole('button', { name: 'Outside Trigger' });
    act(() => {
      outsideButton.focus();
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Focused Only Command' })).not.toBeInTheDocument();
    });
  });

  it('插件声明的菜单可以执行命令', () => {
    const pluginExecute = vi.fn();

    render(
      <AppShell
        plugins={[
          defineEditorPlugin({
            id: 'plugin.menus',
            name: 'Menus Plugin',
            contributes: {
              commands: [
                {
                  id: 'plugin.menus.run',
                  title: 'Menu Run',
                  execute: pluginExecute,
                },
              ],
              menus: [
                {
                  id: 'plugin.menus.entry',
                  label: 'Plugin Menu Run',
                  commandId: 'plugin.menus.run',
                  order: 90,
                },
              ],
            },
          }),
        ]}
      >
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Plugin Menu Run' }));

    expect(pluginExecute).toHaveBeenCalledTimes(1);
  });

  it('宿主上下文菜单会显示在画布区域中', () => {
    const hostExecute = vi.fn();

    render(
      <AppShell
        pluginContext={{
          commands: {
            execute: hostExecute,
          },
        }}
      >
        <div>Canvas Content</div>
      </AppShell>,
    );

    fireEvent.contextMenu(screen.getByText('Canvas Content'));

    expect(screen.getByRole('menu', { name: 'Canvas Context Menu' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Save File' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Undo' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open Command Palette' })).toBeInTheDocument();
  });

  it('宿主上下文菜单会按区域切换菜单项', () => {
    render(
      <AppShell
        inspectorProps={{
          tabs: [
            {
              id: 'advanced',
              label: 'Advanced',
              order: 10,
              render: () => <div>Advanced Panel</div>,
            },
          ],
        }}
      >
        <div>Canvas Content</div>
      </AppShell>,
    );

    const sidebarArea = document.querySelector('[data-shenbi-shortcut-area="sidebar"]');
    const activityBarArea = document.querySelector('[data-shenbi-shortcut-area="activity-bar"]');
    expect(sidebarArea).not.toBeNull();
    expect(activityBarArea).not.toBeNull();

    fireEvent.contextMenu(sidebarArea as Element);
    expect(screen.getByRole('menuitem', { name: 'Hide Sidebar' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Save File' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('menu'));
    fireEvent.contextMenu(screen.getByText('Advanced'));
    expect(screen.getByRole('menuitem', { name: 'Hide Inspector' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Hide Sidebar' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('menu'));
    fireEvent.contextMenu(activityBarArea as Element);
    expect(screen.getByRole('menuitem', { name: 'Hide Console' })).toBeInTheDocument();
  });

  it('插件声明的上下文菜单可以执行命令', () => {
    const pluginExecute = vi.fn();

    render(
      <AppShell
        plugins={[
          defineEditorPlugin({
            id: 'plugin.context-menus',
            name: 'Context Menus Plugin',
            contributes: {
              commands: [
                {
                  id: 'plugin.context.run',
                  title: 'Context Run',
                  execute: pluginExecute,
                },
              ],
              contextMenus: [
                {
                  id: 'plugin.context.entry',
                  label: 'Plugin Context Run',
                  commandId: 'plugin.context.run',
                  order: 90,
                  when: 'editorFocused && !inputFocused',
                },
              ],
            },
          }),
        ]}
      >
        <div>Canvas Content</div>
      </AppShell>,
    );

    fireEvent.contextMenu(screen.getByText('Canvas Content'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Plugin Context Run' }));

    expect(pluginExecute).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu', { name: 'Canvas Context Menu' })).not.toBeInTheDocument();
  });

  it('插件声明的上下文菜单可以指定目标区域', () => {
    const pluginExecute = vi.fn();

    render(
      <AppShell
        plugins={[
          defineEditorPlugin({
            id: 'plugin.context-targets',
            name: 'Context Targets Plugin',
            contributes: {
              commands: [
                {
                  id: 'plugin.context-targets.run',
                  title: 'Sidebar Context Run',
                  execute: pluginExecute,
                },
              ],
              contextMenus: [
                {
                  id: 'plugin.context-targets.sidebar',
                  label: 'Sidebar Context Run',
                  commandId: 'plugin.context-targets.run',
                  area: 'sidebar',
                  order: 50,
                  when: 'sidebarFocused',
                },
              ],
            },
          }),
        ]}
      >
        <div>Canvas Content</div>
      </AppShell>,
    );

    const sidebarArea = document.querySelector('[data-shenbi-shortcut-area="sidebar"]');
    expect(sidebarArea).not.toBeNull();
    fireEvent.contextMenu(sidebarArea as Element);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sidebar Context Run' }));

    expect(pluginExecute).toHaveBeenCalledTimes(1);
  });

  it('命令面板会按命令 when 过滤不可见命令', () => {
    render(
      <AppShell
        plugins={[
          defineEditorPlugin({
            id: 'plugin.command-visibility',
            name: 'Command Visibility Plugin',
            contributes: {
              commands: [
                {
                  id: 'plugin.command-visibility.run',
                  title: 'Hidden Without Selection',
                  when: 'hasSelection',
                  execute: vi.fn(),
                },
              ],
            },
          }),
        ]}
      >
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByTitle('Open Command Palette'));

    expect(screen.queryByRole('option', { name: /Hidden Without Selection/ })).not.toBeInTheDocument();
  });

  it('命令面板、工具栏菜单和上下文菜单会展示禁用态', () => {
    const pluginExecute = vi.fn();

    render(
      <AppShell
        pluginContext={{
          selection: {
            getSelectedNodeId: () => undefined,
          },
        }}
        plugins={[
          defineEditorPlugin({
            id: 'plugin.command-enabled',
            name: 'Command Enabled Plugin',
            contributes: {
              commands: [
                {
                  id: 'plugin.command-enabled.run',
                  title: 'Disabled Without Selection',
                  enabledWhen: 'hasSelection',
                  execute: pluginExecute,
                },
              ],
              menus: [
                {
                  id: 'plugin.command-enabled.menu',
                  label: 'Disabled Menu Run',
                  commandId: 'plugin.command-enabled.run',
                  order: 30,
                },
              ],
              contextMenus: [
                {
                  id: 'plugin.command-enabled.context',
                  label: 'Disabled Context Run',
                  commandId: 'plugin.command-enabled.run',
                  order: 30,
                },
              ],
            },
          }),
        ]}
      >
        <div>Canvas Content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByTitle('Open Command Palette'));
    const disabledPaletteCommand = screen.getByRole('option', { name: /Disabled Without Selection/ });
    expect(disabledPaletteCommand).toBeDisabled();
    fireEvent.click(disabledPaletteCommand);

    const disabledToolbarMenu = screen.getByRole('button', { name: 'Disabled Menu Run' });
    expect(disabledToolbarMenu).toBeDisabled();
    fireEvent.click(disabledToolbarMenu);

    fireEvent.contextMenu(screen.getByText('Canvas Content'));
    const disabledContextMenu = screen.getByRole('menuitem', { name: 'Disabled Context Run' });
    expect(disabledContextMenu).toBeDisabled();
    fireEvent.click(disabledContextMenu);

    expect(pluginExecute).not.toHaveBeenCalled();
  });

  it('命令面板会按 category 分组展示宿主命令', () => {
    const hostExecute = vi.fn();

    render(
      <AppShell
        pluginContext={{
          commands: {
            execute: hostExecute,
          },
        }}
      >
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByTitle('Open Command Palette'));

    expect(screen.getByText('Workbench')).toBeInTheDocument();
    expect(screen.getByText('File')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Layout')).toBeInTheDocument();
  });

  it('命令面板会展示插件命令 description', () => {
    render(
      <AppShell
        plugins={[
          defineEditorPlugin({
            id: 'plugin.command-meta',
            name: 'Command Meta Plugin',
            contributes: {
              commands: [
                {
                  id: 'plugin.command-meta.run',
                  title: 'Generate Mock Data',
                  category: 'Data',
                  description: 'Generate placeholder records for the selected table.',
                  execute: vi.fn(),
                },
              ],
            },
          }),
        ]}
      >
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByTitle('Open Command Palette'));

    const searchInput = screen.getByLabelText('Command Palette Search');
    const palette = searchInput.closest('.w-\\[560px\\]');

    expect(palette).not.toBeNull();
    expect(within(palette as HTMLElement).getByText('Data')).toBeInTheDocument();
    expect(within(palette as HTMLElement).getByText('Generate placeholder records for the selected table.')).toBeInTheDocument();
  });

  it('命令面板支持 aliases 和 keywords 搜索', async () => {
    render(
      <AppShell
        plugins={[
          defineEditorPlugin({
            id: 'plugin.command-search-meta',
            name: 'Command Search Meta Plugin',
            contributes: {
              commands: [
                {
                  id: 'plugin.command-search-meta.persist',
                  title: 'Persist Selected Schema',
                  aliases: ['save schema'],
                  keywords: ['store', 'persist'],
                  execute: vi.fn(),
                },
              ],
            },
          }),
        ]}
      >
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByTitle('Open Command Palette'));
    const searchInput = screen.getByLabelText('Command Palette Search');

    fireEvent.change(searchInput, { target: { value: 'save schema' } });
    expect(await screen.findByRole('option', { name: /Persist Selected Schema/ })).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'store' } });
    expect(await screen.findByRole('option', { name: /Persist Selected Schema/ })).toBeInTheDocument();
  });

  it('命令面板会在空搜索时展示最近使用命令', async () => {
    const firstExecute = vi.fn();
    const secondExecute = vi.fn();

    render(
      <AppShell
        plugins={[
          defineEditorPlugin({
            id: 'plugin.palette.recent',
            name: 'Palette Recent Plugin',
            contributes: {
              commands: [
                {
                  id: 'plugin.palette.recent.first',
                  title: 'Recent First',
                  category: 'RecentGroup',
                  execute: firstExecute,
                },
                {
                  id: 'plugin.palette.recent.second',
                  title: 'Recent Second',
                  category: 'RecentGroup',
                  execute: secondExecute,
                },
              ],
            },
          }),
        ]}
      >
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByTitle('Open Command Palette'));
    fireEvent.click(screen.getByRole('option', { name: /Recent First/ }));
    expect(firstExecute).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Open Command Palette'));
    fireEvent.click(screen.getByRole('option', { name: /Recent Second/ }));
    expect(secondExecute).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Open Command Palette'));

    const recentHeader = await screen.findByText('Recent');
    const recentGroup = recentHeader.parentElement;
    expect(recentGroup).not.toBeNull();
    const recentOptions = within(recentGroup as HTMLElement).getAllByRole('option');
    expect(recentOptions).toHaveLength(2);
    expect(recentOptions[0]).toHaveAccessibleName(/Recent Second/);
    expect(recentOptions[1]).toHaveAccessibleName(/Recent First/);
  });

  it('命令面板最近使用命令会去重并前移', async () => {
    const firstExecute = vi.fn();
    const secondExecute = vi.fn();

    render(
      <AppShell
        plugins={[
          defineEditorPlugin({
            id: 'plugin.palette.recent-dedupe',
            name: 'Palette Recent Dedupe Plugin',
            contributes: {
              commands: [
                {
                  id: 'plugin.palette.recent-dedupe.first',
                  title: 'Dedupe First',
                  category: 'RecentDedupe',
                  execute: firstExecute,
                },
                {
                  id: 'plugin.palette.recent-dedupe.second',
                  title: 'Dedupe Second',
                  category: 'RecentDedupe',
                  execute: secondExecute,
                },
              ],
            },
          }),
        ]}
      >
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByTitle('Open Command Palette'));
    fireEvent.click(screen.getByRole('option', { name: /Dedupe First/ }));
    fireEvent.click(screen.getByTitle('Open Command Palette'));
    fireEvent.click(screen.getByRole('option', { name: /Dedupe Second/ }));
    fireEvent.click(screen.getByTitle('Open Command Palette'));
    fireEvent.click(screen.getByRole('option', { name: /Dedupe First/ }));

    expect(firstExecute).toHaveBeenCalledTimes(2);
    expect(secondExecute).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Open Command Palette'));

    const recentGroup = (await screen.findByText('Recent')).parentElement;
    expect(recentGroup).not.toBeNull();
    const recentOptions = within(recentGroup as HTMLElement).getAllByRole('option');
    expect(recentOptions).toHaveLength(2);
    expect(recentOptions[0]).toHaveTextContent('Dedupe First');
    expect(recentOptions[1]).toHaveTextContent('Dedupe Second');
  });

  it('命令面板空搜索时回车会执行最近分组第一项', async () => {
    const firstExecute = vi.fn();
    const secondExecute = vi.fn();

    render(
      <AppShell
        plugins={[
          defineEditorPlugin({
            id: 'plugin.palette.recent-enter',
            name: 'Palette Recent Enter Plugin',
            contributes: {
              commands: [
                {
                  id: 'plugin.palette.recent-enter.first',
                  title: 'Recent Enter First',
                  category: 'RecentEnter',
                  execute: firstExecute,
                },
                {
                  id: 'plugin.palette.recent-enter.second',
                  title: 'Recent Enter Second',
                  category: 'RecentEnter',
                  execute: secondExecute,
                },
              ],
            },
          }),
        ]}
      >
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByTitle('Open Command Palette'));
    fireEvent.click(screen.getByRole('option', { name: /Recent Enter First/ }));
    fireEvent.click(screen.getByTitle('Open Command Palette'));
    fireEvent.click(screen.getByRole('option', { name: /Recent Enter Second/ }));

    fireEvent.click(screen.getByTitle('Open Command Palette'));
    const searchInput = screen.getByLabelText('Command Palette Search');

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Recent Enter Second/ })).toHaveAttribute('aria-selected', 'true');
    });

    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(secondExecute).toHaveBeenCalledTimes(2);
    expect(firstExecute).toHaveBeenCalledTimes(1);
  });

  it('工具栏菜单会按 target 放到不同区域并按 group 分隔', () => {
    render(
      <AppShell
        breadcrumbItems={[{ id: 'test-root', label: 'Page' }]}
        plugins={[
          defineEditorPlugin({
            id: 'plugin.toolbar-layout',
            name: 'Toolbar Layout Plugin',
            contributes: {
              commands: [
                { id: 'plugin.toolbar-layout.left', title: 'Left Tool', execute: vi.fn() },
                { id: 'plugin.toolbar-layout.right', title: 'Right Tool', execute: vi.fn() },
              ],
              menus: [
                {
                  id: 'plugin.toolbar-layout.left.menu',
                  label: 'Left Tool',
                  commandId: 'plugin.toolbar-layout.left',
                  target: 'toolbar-start',
                  group: 'plugin-left',
                  order: 10,
                },
                {
                  id: 'plugin.toolbar-layout.right.menu',
                  label: 'Right Tool',
                  commandId: 'plugin.toolbar-layout.right',
                  target: 'toolbar-end',
                  group: 'plugin-right',
                  order: 10,
                },
              ],
            },
          }),
        ]}
      >
        <div>Content</div>
      </AppShell>,
    );

    const leftButton = screen.getByRole('button', { name: 'Left Tool' });
    const rightButton = screen.getByRole('button', { name: 'Right Tool' });
    const breadcrumb = screen.getByText('Page');

    expect(leftButton.compareDocumentPosition(breadcrumb) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rightButton.compareDocumentPosition(breadcrumb) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('上下文菜单会按 group 渲染分隔线', () => {
    render(
      <AppShell
        plugins={[
          defineEditorPlugin({
            id: 'plugin.context-groups',
            name: 'Context Groups Plugin',
            contributes: {
              commands: [
                { id: 'plugin.context-groups.first', title: 'First Group Item', execute: vi.fn() },
                { id: 'plugin.context-groups.second', title: 'Second Group Item', execute: vi.fn() },
              ],
              contextMenus: [
                {
                  id: 'plugin.context-groups.first.item',
                  label: 'First Group Item',
                  commandId: 'plugin.context-groups.first',
                  group: 'edit',
                  order: 90,
                },
                {
                  id: 'plugin.context-groups.second.item',
                  label: 'Second Group Item',
                  commandId: 'plugin.context-groups.second',
                  group: 'danger',
                  order: 100,
                },
              ],
            },
          }),
        ]}
      >
        <div>Canvas Content</div>
      </AppShell>,
    );

    fireEvent.contextMenu(screen.getByText('Canvas Content'));

    const menu = screen.getByRole('menu', { name: 'Canvas Context Menu' });
    expect(within(menu).getAllByRole('separator').length).toBeGreaterThanOrEqual(1);
  });

  it('命令面板支持键盘导航并通过回车执行命令', async () => {
    const firstExecute = vi.fn();
    const secondExecute = vi.fn();

    render(
      <AppShell
        plugins={[
          defineEditorPlugin({
            id: 'plugin.palette.keyboard',
            name: 'Palette Keyboard Plugin',
            contributes: {
              commands: [
                {
                  id: 'plugin.palette.keyboard.first',
                  title: 'First Command',
                  category: 'PaletteNav',
                  execute: firstExecute,
                },
                {
                  id: 'plugin.palette.keyboard.second',
                  title: 'Second Command',
                  category: 'PaletteNav',
                  execute: secondExecute,
                },
              ],
            },
          }),
        ]}
      >
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByTitle('Open Command Palette'));

    const searchInput = screen.getByLabelText('Command Palette Search');
    fireEvent.change(searchInput, { target: { value: 'palettenav' } });

    await waitFor(() => {
      const firstButton = screen.getByRole('option', { name: /First Command/ });
      const secondButton = screen.getByRole('option', { name: /Second Command/ });
      expect(firstButton).toHaveAttribute('aria-selected', 'true');
      expect(secondButton).toHaveAttribute('aria-selected', 'false');
    });

    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: /First Command/ })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('option', { name: /Second Command/ })).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(searchInput, { key: 'Enter' });
    expect(secondExecute).toHaveBeenCalledTimes(1);
    expect(firstExecute).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Command Palette Search')).not.toBeInTheDocument();
  });

  it('命令面板键盘导航会跳过禁用命令', async () => {
    const enabledExecute = vi.fn();

    render(
      <AppShell
        pluginContext={{
          selection: {
            getSelectedNodeId: () => undefined,
          },
        }}
        plugins={[
          defineEditorPlugin({
            id: 'plugin.palette.disabled-keyboard',
            name: 'Palette Disabled Keyboard Plugin',
            contributes: {
              commands: [
                {
                  id: 'plugin.palette.disabled-keyboard.blocked',
                  title: 'Blocked Command',
                  category: 'PaletteDisabledNav',
                  enabledWhen: 'hasSelection',
                  execute: vi.fn(),
                },
                {
                  id: 'plugin.palette.disabled-keyboard.enabled',
                  title: 'Enabled Command',
                  category: 'PaletteDisabledNav',
                  execute: enabledExecute,
                },
              ],
            },
          }),
        ]}
      >
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByTitle('Open Command Palette'));

    const searchInput = screen.getByLabelText('Command Palette Search');
    fireEvent.change(searchInput, { target: { value: 'palettedisablednav' } });

    await waitFor(() => {
      const blockedButton = screen.getByRole('option', { name: /Blocked Command/ });
      const enabledButton = screen.getByRole('option', { name: /Enabled Command/ });
      expect(blockedButton).toHaveAttribute('aria-selected', 'false');
      expect(enabledButton).toHaveAttribute('aria-selected', 'true');
    });

    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: /Enabled Command/ })).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(searchInput, { key: 'Enter' });
    expect(enabledExecute).toHaveBeenCalledTimes(1);
  });

  it('命令面板支持 Escape 和 Tab 关闭', () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByTitle('Open Command Palette'));
    const searchInput = screen.getByLabelText('Command Palette Search');

    fireEvent.keyDown(searchInput, { key: 'Escape' });
    expect(screen.queryByLabelText('Command Palette Search')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Open Command Palette'));
    const reopenedSearchInput = screen.getByLabelText('Command Palette Search');
    fireEvent.keyDown(reopenedSearchInput, { key: 'Tab' });
    expect(screen.queryByLabelText('Command Palette Search')).not.toBeInTheDocument();
  });

  it('命令面板提供 listbox 语义和 active descendant', () => {
    render(
      <AppShell
        plugins={[
          defineEditorPlugin({
            id: 'plugin.palette.a11y',
            name: 'Palette A11y Plugin',
            contributes: {
              commands: [
                {
                  id: 'plugin.palette.a11y.run',
                  title: 'Accessible Command',
                  category: 'PaletteA11y',
                  execute: vi.fn(),
                },
              ],
            },
          }),
        ]}
      >
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByTitle('Open Command Palette'));
    const searchInput = screen.getByLabelText('Command Palette Search');
    fireEvent.change(searchInput, { target: { value: 'palettea11y' } });

    const listbox = screen.getByRole('listbox', { name: 'Command Palette Results' });
    const option = screen.getByRole('option', { name: /Accessible Command/ });

    expect(screen.getByRole('dialog', { name: 'Command Palette' })).toBeInTheDocument();
    expect(listbox).toBeInTheDocument();
    expect(option).toHaveAttribute('id', 'command-palette-option-plugin.palette.a11y.run');
    expect(searchInput).toHaveAttribute('aria-controls', 'command-palette-listbox');
    expect(searchInput).toHaveAttribute('aria-activedescendant', 'command-palette-option-plugin.palette.a11y.run');
  });

  it('命令面板选中项变化时会滚动到可见区域', async () => {
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      render(
        <AppShell
          plugins={[
            defineEditorPlugin({
              id: 'plugin.palette.scroll',
              name: 'Palette Scroll Plugin',
              contributes: {
                commands: [
                  {
                    id: 'plugin.palette.scroll.first',
                    title: 'Scroll First',
                    category: 'PaletteScroll',
                    execute: vi.fn(),
                  },
                  {
                    id: 'plugin.palette.scroll.second',
                    title: 'Scroll Second',
                    category: 'PaletteScroll',
                    execute: vi.fn(),
                  },
                ],
              },
            }),
          ]}
        >
          <div>Content</div>
        </AppShell>,
      );

      fireEvent.click(screen.getByTitle('Open Command Palette'));
      const searchInput = screen.getByLabelText('Command Palette Search');
      fireEvent.change(searchInput, { target: { value: 'palettescroll' } });

      await waitFor(() => {
        expect(scrollIntoView).toHaveBeenCalled();
      });

      scrollIntoView.mockClear();
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });

      await waitFor(() => {
        expect(screen.getByRole('option', { name: /Scroll Second/ })).toHaveAttribute('aria-selected', 'true');
      });
      expect(scrollIntoView).toHaveBeenCalled();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('会让当前选中的画布节点支持直接拖拽移动', async () => {
    const view = render(
      <AppShell selectedNodeSchemaId="node-1" selectedNodeTreeId="body:0">
        <div data-shenbi-node-id="node-1" data-shenbi-component-type="Button">
          Node Content
        </div>
      </AppShell>,
    );

    const selectedNode = screen.getByText('Node Content');
    await waitFor(() => {
      expect(selectedNode).toHaveAttribute('draggable', 'true');
    });

    view.rerender(
      <AppShell selectedNodeSchemaId={undefined} selectedNodeTreeId={undefined}>
        <div data-shenbi-node-id="node-1" data-shenbi-component-type="Button">
          Node Content
        </div>
      </AppShell>,
    );

    await waitFor(() => {
      expect(selectedNode).not.toHaveAttribute('draggable');
    });
  });

  it('会在选中框外层渲染通用 Action 条，并且点击不会误触发取消选中', async () => {
    const duplicateExecute = vi.fn();
    render(
      <AppShell
        selectedNodeSchemaId="node-1"
        selectedNodeTreeId="body:0"
        canDuplicateSelectedNode
        canMoveSelectedNodeDown
        canDeleteSelectedNode
        onCanvasDeselectNode={vi.fn()}
        pluginContext={{
          selection: {
            getSelectedNodeId: () => 'body:0',
          },
        }}
        plugins={[
          defineEditorPlugin({
            id: 'plugin.canvas-actions',
            name: 'Canvas Actions',
            contributes: {
              commands: [
                { id: 'canvas.duplicateSelectedNode', title: 'Duplicate', execute: duplicateExecute },
                { id: 'canvas.moveSelectedNodeUp', title: 'Move Up', enabledWhen: 'canCanvasMoveSelectionUp', execute: () => undefined },
                { id: 'canvas.moveSelectedNodeDown', title: 'Move Down', enabledWhen: 'canCanvasMoveSelectionDown', execute: () => undefined },
                { id: 'canvas.deleteSelectedNode', title: 'Delete', enabledWhen: 'canCanvasDeleteSelection', execute: () => undefined },
              ],
            },
          }),
        ]}
      >
        <div data-shenbi-node-id="node-1" data-shenbi-component-type="Button">
          Node Content
        </div>
      </AppShell>,
    );

    const selectedNode = screen.getByText('Node Content');
    Object.defineProperty(selectedNode, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 80,
        left: 120,
        right: 240,
        bottom: 132,
        width: 120,
        height: 52,
        x: 120,
        y: 80,
        toJSON: () => undefined,
      }),
    });

    fireEvent(window, new Event('resize'));

    await waitFor(() => {
      expect(screen.getByRole('toolbar', { name: 'Selected Node Actions' })).toBeInTheDocument();
    });

    expect(screen.getByTitle('Move Up')).toBeDisabled();
    expect(screen.getByTitle('Move Down')).not.toBeDisabled();

    fireEvent.click(screen.getByTitle('Duplicate'));
    expect(duplicateExecute).toHaveBeenCalled();
  });

  it('会渲染画布浮动工具栏和缩放 HUD', () => {
    render(
      <AppShell>
        <div>Canvas Content</div>
      </AppShell>,
    );

    expect(screen.getByRole('toolbar', { name: 'Canvas Tools' })).toBeInTheDocument();
    expect(screen.getByTitle('Selection Tool (V)')).toBeInTheDocument();
    expect(screen.getByTitle('Hand Tool (H)')).toBeInTheDocument();
    expect(screen.getByLabelText('Canvas Zoom Controls')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '100%' })).toBeInTheDocument();
  });

  it('支持通过快捷键切换画布工具模式', () => {
    render(
      <AppShell>
        <div>Canvas Content</div>
      </AppShell>,
    );

    const canvas = document.querySelector('[data-shenbi-shortcut-area="canvas"]');
    expect(canvas).not.toBeNull();
    canvas?.focus?.();

    const selectButton = screen.getByTitle('Selection Tool (V)');
    const panButton = screen.getByTitle('Hand Tool (H)');
    expect(selectButton.className).toContain('canvas-chrome-button--active');

    fireEvent.keyDown(canvas as Element, { key: 'H' });
    expect(panButton.className).toContain('canvas-chrome-button--active');

    fireEvent.keyDown(canvas as Element, { key: 'V' });
    expect(selectButton.className).toContain('canvas-chrome-button--active');
  });

  it('手型模式下点击页面节点不会触发选中', () => {
    const onCanvasSelectNode = vi.fn();
    render(
      <AppShell onCanvasSelectNode={onCanvasSelectNode}>
        <div data-shenbi-node-id="node-1">Canvas Node</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByTitle('Hand Tool (H)'));
    fireEvent.click(screen.getByText('Canvas Node'));

    expect(onCanvasSelectNode).not.toHaveBeenCalled();
  });

  it('手型模式下画布会切换为抓手光标语义', async () => {
    render(
      <AppShell>
        <div>Canvas Content</div>
      </AppShell>,
    );

    const canvas = document.querySelector('[data-shenbi-shortcut-area="canvas"]') as HTMLElement | null;
    expect(canvas).not.toBeNull();
    expect(canvas?.className).toContain('cursor-default');

    await act(async () => {
      fireEvent.click(screen.getByTitle('Hand Tool (H)'));
    });
    await waitFor(() => {
      expect(screen.getByTitle('Hand Tool (H)').className).toContain('canvas-chrome-button--active');
    });
    expect(canvas?.className).toContain('cursor-grab');
  });

  it('按下空格会阻止浏览器默认滚动行为', () => {
    render(
      <AppShell>
        <div>Canvas Content</div>
      </AppShell>,
    );

    const event = new KeyboardEvent('keydown', {
      code: 'Space',
      key: ' ',
      bubbles: true,
      cancelable: true,
    });

    const prevented = !document.dispatchEvent(event);
    expect(prevented || event.defaultPrevented).toBe(true);
  });

  it('会在缩放 HUD 中展示固定缩放选项，并在没有选中节点时禁用聚焦按钮', () => {
    render(
      <AppShell>
        <div>Canvas Content</div>
      </AppShell>,
    );

    const focusButton = screen.getByTitle('Focus Selected Node (Shift+3)');
    expect(focusButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '100%' }));
    expect(screen.getByRole('menu', { name: 'Canvas Zoom Presets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '25%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fit' })).toBeInTheDocument();
  });
});

function TestCanvasRenderer({
  fileId,
  onMount,
  onUnmount,
}: {
  fileId: string;
  onMount: (fileId: string) => void;
  onUnmount: (fileId: string) => void;
}) {
  React.useEffect(() => {
    onMount(fileId);
    return () => {
      onUnmount(fileId);
    };
  }, [fileId, onMount, onUnmount]);

  return <div data-testid="test-canvas-renderer">{fileId}</div>;
}
