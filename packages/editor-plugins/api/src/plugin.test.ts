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
            { id: 'cmd.save', title: 'Save', order: 10, execute },
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
            { id: 'cmd.save', title: '保存', order: 5, execute },
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
