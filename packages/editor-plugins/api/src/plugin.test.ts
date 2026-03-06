import { describe, expect, it, vi } from 'vitest';
import { collectPluginContributes, defineEditorPlugin } from './plugin';
import type { ActivityBarItemIconProps } from './contributions';

const SearchIcon = (_props: ActivityBarItemIconProps) => null;
const DataIcon = (_props: ActivityBarItemIconProps) => null;

describe('defineEditorPlugin', () => {
  it('保持声明对象不变', () => {
    const plugin = defineEditorPlugin({
      id: 'test.plugin',
      name: 'Test Plugin',
    });

    expect(plugin.id).toBe('test.plugin');
    expect(plugin.name).toBe('Test Plugin');
  });
});

describe('collectPluginContributes', () => {
  it('聚合并按 id 覆盖贡献项', () => {
    const execute = vi.fn();
    const plugins = [
      defineEditorPlugin({
        id: 'plugin.a',
        name: 'Plugin A',
        contributes: {
          activityBarItems: [
            { id: 'search', label: 'Search', icon: SearchIcon, order: 10 },
          ],
          commands: [
            {
              id: 'cmd.save',
              title: 'Save',
              aliases: ['persist schema'],
              keywords: ['save', 'schema'],
              order: 10,
              execute,
            },
          ],
          menus: [
            {
              id: 'menu.save',
              label: 'Save',
              commandId: 'cmd.save',
              target: 'toolbar-start',
              group: 'file',
              order: 10,
            },
          ],
          contextMenus: [
            { id: 'context.copy', label: 'Copy Node', commandId: 'node.copy', group: 'edit', order: 10 },
          ],
          shortcuts: [
            {
              id: 'shortcut.save',
              commandId: 'cmd.save',
              keybinding: 'Mod+S',
              order: 10,
              priority: 1,
              when: 'editorFocused',
            },
          ],
        },
      }),
      defineEditorPlugin({
        id: 'plugin.b',
        name: 'Plugin B',
        contributes: {
          activityBarItems: [
            { id: 'search', label: '搜索', icon: DataIcon, order: 10 },
            { id: 'data', label: 'Data', icon: DataIcon, order: 20 },
          ],
          commands: [
            {
              id: 'cmd.save',
              title: '保存',
              aliases: ['save schema'],
              keywords: ['store'],
              order: 5,
              execute,
            },
          ],
          menus: [
            {
              id: 'menu.save',
              label: '保存',
              commandId: 'cmd.save',
              target: 'toolbar-start',
              group: 'file',
              order: 5,
            },
            {
              id: 'menu.assistant',
              label: 'Assistant',
              commandId: 'cmd.assistant',
              target: 'toolbar-end',
              group: 'assist',
              order: 20,
            },
          ],
          contextMenus: [
            { id: 'context.copy', label: 'Duplicate Node', commandId: 'node.duplicate', group: 'edit', order: 5 },
            { id: 'context.delete', label: 'Delete Node', commandId: 'node.delete', group: 'danger', order: 20 },
          ],
          shortcuts: [
            {
              id: 'shortcut.save',
              commandId: 'cmd.save',
              keybinding: 'Mod+Shift+S',
              order: 5,
              priority: 10,
              when: 'editorFocused && !inputFocused',
            },
          ],
          auxiliaryPanels: [
            {
              id: 'assistant',
              label: 'Assistant',
              order: 10,
              render: () => null,
            },
          ],
        },
      }),
    ];

    const resolved = collectPluginContributes(plugins);

    expect(resolved.activityBarItems.map((item) => item.id)).toEqual(['search', 'data']);
    expect(resolved.activityBarItems[0]?.label).toBe('搜索');
    expect(resolved.commands).toHaveLength(1);
    expect(resolved.commands[0]?.title).toBe('保存');
    expect(resolved.commands[0]?.aliases).toEqual(['save schema']);
    expect(resolved.commands[0]?.keywords).toEqual(['store']);
    expect(resolved.menus.map((item) => item.id)).toEqual(['menu.save', 'menu.assistant']);
    expect(resolved.menus[0]?.label).toBe('保存');
    expect(resolved.menus[0]?.target).toBe('toolbar-start');
    expect(resolved.menus[1]?.group).toBe('assist');
    expect(resolved.contextMenus.map((item) => item.id)).toEqual(['context.copy', 'context.delete']);
    expect(resolved.contextMenus[0]?.label).toBe('Duplicate Node');
    expect(resolved.contextMenus[1]?.group).toBe('danger');
    expect(resolved.shortcuts).toHaveLength(1);
    expect(resolved.shortcuts[0]).toMatchObject({
      id: 'shortcut.save',
      keybinding: 'Mod+Shift+S',
      priority: 10,
      when: 'editorFocused && !inputFocused',
    });
    expect(resolved.auxiliaryPanels.map((item) => item.id)).toEqual(['assistant']);
  });

  it('允许插件返回清理函数作为激活结果', async () => {
    const cleanup = vi.fn();
    const plugin = defineEditorPlugin({
      id: 'plugin.activate',
      name: 'Plugin Activate',
      activate: async () => cleanup,
    });

    const result = await plugin.activate?.({} as never);

    expect(typeof result).toBe('function');
    result?.();
    expect(cleanup).toHaveBeenCalled();
  });
});
