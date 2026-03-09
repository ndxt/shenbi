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
}

function createDelegatedCommand(
  id: string,
  title: string,
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
    category: id.startsWith('file.') ? 'File' : 'Edit',
    aliases: id === 'file.saveSchema'
      ? ['save']
      : id === 'file.saveAs'
        ? ['save as']
        : id === 'editor.undo'
          ? ['undo change']
          : ['redo change'],
    keywords: id === 'file.saveSchema'
      ? ['schema', 'persist']
      : id === 'file.saveAs'
        ? ['schema', 'export']
        : id === 'editor.undo'
          ? ['history', 'back']
          : ['history', 'forward'],
    description: id === 'file.saveSchema'
      ? 'Save the current schema.'
      : id === 'file.saveAs'
        ? 'Save the current schema as a new file.'
        : id === 'editor.undo'
          ? 'Undo the most recent change.'
          : 'Redo the most recent undone change.',
    when,
    priority: 50,
    execute: (payload) => execute(id, payload),
    ...(shortcut ? { shortcut } : {}),
  };
}

export function createHostCommandRegistry(options: HostCommandRegistryOptions): HostCommandDefinition[] {
  const commands: Array<HostCommandDefinition | undefined> = [
    {
      id: 'commandPalette.open',
      title: 'Open Command Palette',
      category: 'Workbench',
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
    createDelegatedCommand('editor.undo', 'Undo', 'Mod+Z', options.pluginContext),
    createDelegatedCommand('editor.redo', 'Redo', 'Mod+Shift+Z', options.pluginContext),
    createDelegatedCommand('file.saveSchema', 'Save File', 'Mod+S', options.pluginContext),
    createDelegatedCommand('file.saveAs', 'Save As', 'Mod+Shift+S', options.pluginContext),
    {
      id: 'layout.toggleSidebar',
      title: options.showSidebar ? 'Hide Sidebar' : 'Show Sidebar',
      category: 'Layout',
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
      title: options.showConsole ? 'Hide Console' : 'Show Console',
      category: 'Layout',
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
      title: options.showInspector ? 'Hide Inspector' : 'Show Inspector',
      category: 'Layout',
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
          title: options.showAssistantPanel ? 'Hide Assistant Panel' : 'Show Assistant Panel',
          category: 'Layout',
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
      title: options.isMaximized ? 'Restore Layout' : 'Maximize Center Area',
      category: 'Layout',
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
