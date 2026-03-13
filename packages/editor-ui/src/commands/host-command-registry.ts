import type { ContextMenuContribution, MenuContribution, PluginShortcutContribution } from '@shenbi/editor-plugin-api';
import type { PluginContext } from '@shenbi/editor-plugin-api';

export interface HostCommandDefinition {
  id: string;
  title: string;
  category?: string;
  description?: string;
  aliases?: string[];
  keywords?: string[];
  shortcut?: string;
  when?: string;
  enabledWhen?: string;
  priority?: number;
  execute: (payload?: unknown) => unknown | Promise<unknown>;
}

export interface HostCommandRegistryOptions {
  pluginContext: PluginContext | undefined;
  showSidebar: boolean;
  showInspector: boolean;
  showConsole: boolean;
  hasAssistantPanel: boolean;
  showAssistantPanel: boolean;
  isMaximized: boolean;
  setShowSidebar: (value: boolean) => void;
  setShowInspector: (value: boolean) => void;
  setShowConsole: (value: boolean) => void;
  setShowAssistantPanel: (value: boolean) => void;
  setShowCommandPalette: (value: boolean) => void;
  toggleMaximize: () => void;
  t: (key: string) => string;
}

function createDelegatedCommand(
  id: string,
  title: string,
  category: string,
  description: string,
  aliases: string[],
  keywords: string[],
  shortcut: string | undefined,
  pluginContext: PluginContext | undefined,
  when = 'editorFocused && !inputFocused',
): HostCommandDefinition | undefined {
  const execute = pluginContext?.commands?.execute;
  if (!execute) {
    return undefined;
  }
  return {
    id,
    title,
    category,
    aliases,
    keywords,
    description,
    when,
    priority: 50,
    execute: (payload) => execute(id, payload),
    ...(shortcut ? { shortcut } : {}),
  };
}

export function createHostCommandRegistry(options: HostCommandRegistryOptions): HostCommandDefinition[] {
  const { t } = options;
  const commands: Array<HostCommandDefinition | undefined> = [
    {
      id: 'commandPalette.open',
      title: t('hostCommands.openCommandPalette'),
      category: t('hostCommands.category.workbench'),
      aliases: ['show commands', 'open palette'],
      keywords: ['commands', 'search', 'palette'],
      description: 'Open the command palette to search and run commands.',
      shortcut: 'Mod+Shift+P',
      when: '!inputFocused',
      priority: 100,
      execute: () => {
        options.setShowCommandPalette(true);
      },
    },
    createDelegatedCommand(
      'editor.undo',
      t('hostCommands.undo'),
      t('hostCommands.category.edit'),
      'Undo the most recent change.',
      ['undo change'],
      ['history', 'back'],
      'Mod+Z',
      options.pluginContext,
    ),
    createDelegatedCommand(
      'editor.redo',
      t('hostCommands.redo'),
      t('hostCommands.category.edit'),
      'Redo the most recent undone change.',
      ['redo change'],
      ['history', 'forward'],
      'Mod+Shift+Z',
      options.pluginContext,
    ),
    createDelegatedCommand(
      'file.saveSchema',
      t('hostCommands.saveFile'),
      t('hostCommands.category.file'),
      'Save the current schema.',
      ['save'],
      ['schema', 'persist'],
      'Mod+S',
      options.pluginContext,
    ),
    createDelegatedCommand(
      'file.saveAs',
      t('hostCommands.saveAs'),
      t('hostCommands.category.file'),
      'Save the current schema as a new file.',
      ['save as'],
      ['schema', 'export'],
      'Mod+Shift+S',
      options.pluginContext,
    ),
    {
      id: 'layout.toggleSidebar',
      title: options.showSidebar ? t('hostCommands.hideSidebar') : t('hostCommands.showSidebar'),
      category: t('hostCommands.category.layout'),
      aliases: ['toggle sidebar', 'left panel'],
      keywords: ['sidebar', 'layout', 'navigation'],
      description: 'Toggle the visibility of the left sidebar.',
      shortcut: 'Mod+B',
      when: '!inputFocused',
      priority: 10,
      execute: () => {
        options.setShowSidebar(!options.showSidebar);
      },
    },
    {
      id: 'layout.toggleConsole',
      title: options.showConsole ? t('hostCommands.hideConsole') : t('hostCommands.showConsole'),
      category: t('hostCommands.category.layout'),
      aliases: ['toggle console', 'bottom panel'],
      keywords: ['console', 'layout', 'logs'],
      description: 'Toggle the visibility of the bottom console panel.',
      shortcut: 'Mod+J',
      when: '!inputFocused',
      priority: 10,
      execute: () => {
        options.setShowConsole(!options.showConsole);
      },
    },
    {
      id: 'layout.toggleInspector',
      title: options.showInspector ? t('hostCommands.hideInspector') : t('hostCommands.showInspector'),
      category: t('hostCommands.category.layout'),
      aliases: ['toggle inspector', 'right panel'],
      keywords: ['inspector', 'layout', 'properties'],
      description: 'Toggle the visibility of the right inspector panel.',
      shortcut: 'Mod+Shift+I',
      when: '!inputFocused',
      priority: 10,
      execute: () => {
        options.setShowInspector(!options.showInspector);
      },
    },
    options.hasAssistantPanel
      ? {
          id: 'layout.toggleAssistantPanel',
          title: options.showAssistantPanel ? t('hostCommands.hideAssistantPanel') : t('hostCommands.showAssistantPanel'),
          category: t('hostCommands.category.layout'),
          aliases: ['toggle assistant', 'toggle ai panel'],
          keywords: ['assistant', 'ai', 'layout'],
          description: 'Toggle the visibility of the assistant panel.',
          when: '!inputFocused',
          priority: 10,
          execute: () => {
            options.setShowAssistantPanel(!options.showAssistantPanel);
          },
        }
      : undefined,
    {
      id: 'layout.toggleMaximize',
      title: options.isMaximized ? t('hostCommands.restoreLayout') : t('hostCommands.maximizeCenter'),
      category: t('hostCommands.category.layout'),
      aliases: ['maximize editor', 'restore panels'],
      keywords: ['maximize', 'layout', 'focus'],
      description: 'Maximize or restore the center editing area.',
      when: '!inputFocused',
      priority: 10,
      execute: () => {
        options.toggleMaximize();
      },
    },
  ];

  return commands.filter((command): command is HostCommandDefinition => Boolean(command));
}

export function hostCommandsToShortcuts(hostCommands: readonly HostCommandDefinition[]): PluginShortcutContribution[] {
  return hostCommands
    .filter((command) => Boolean(command.shortcut))
    .map((command) => ({
      id: `host.shortcut.${command.id}`,
      commandId: command.id,
      keybinding: command.shortcut!,
      ...(command.priority !== undefined ? { priority: command.priority } : {}),
      ...(command.when ? { when: command.when } : {}),
    }));
}

export function hostCommandsToMenus(_hostCommands: readonly HostCommandDefinition[]): MenuContribution[] {
  // 初始阶段不在工具栏上显示内置命令按钮。
  // 用户仍然可以通过快捷键和命令面板 (Cmd+Shift+P) 访问全部命令。
  return [];
}

export function hostCommandsToContextMenus(hostCommands: readonly HostCommandDefinition[]): ContextMenuContribution[] {
  return hostCommands.reduce<ContextMenuContribution[]>((menus, command, index) => {
      const base = {
        id: `host.context-menu.${command.id}`,
        label: command.title,
        commandId: command.id,
        order: (index + 1) * 10,
        group: command.id.startsWith('file.')
          ? 'file'
          : command.id.startsWith('editor.')
            ? 'edit'
            : command.id.startsWith('layout.')
              ? 'layout'
              : 'workbench',
        ...(command.when ? { when: command.when } : {}),
      };

      switch (command.id) {
        case 'editor.undo':
        case 'editor.redo':
        case 'file.saveSchema':
        case 'file.saveAs':
        case 'commandPalette.open':
          menus.push({ ...base, area: 'canvas' });
          break;
        case 'layout.toggleSidebar':
          menus.push({ ...base, area: 'sidebar' });
          break;
        case 'layout.toggleInspector':
          menus.push({ ...base, area: 'inspector' });
          break;
        case 'layout.toggleConsole':
          menus.push({ ...base, area: 'activity-bar' });
          break;
        default:
          break;
      }
      return menus;
    }, []);
}
