import type { ContextMenuContribution, MenuContribution, PluginShortcutContribution } from '@shenbi/editor-plugin-api';
import type { PluginContext } from '@shenbi/editor-plugin-api';

export interface HostCommandDefinition {
  id: string;
  title: string;
  category?: string;
  description?: string;
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

export function hostCommandsToMenus(hostCommands: readonly HostCommandDefinition[]): MenuContribution[] {
  const menuCommandIds = new Set([
    'file.saveSchema',
    'file.saveAs',
    'editor.undo',
    'editor.redo',
    'layout.toggleSidebar',
    'layout.toggleConsole',
    'layout.toggleInspector',
    'commandPalette.open',
  ]);

  return hostCommands
    .filter((command) => menuCommandIds.has(command.id))
    .map((command, index) => ({
      id: `host.menu.${command.id}`,
      label: command.title,
      commandId: command.id,
      order: (index + 1) * 10,
      section: command.id.startsWith('layout.') ? 'secondary' : 'primary',
    }));
}

export function hostCommandsToContextMenus(hostCommands: readonly HostCommandDefinition[]): ContextMenuContribution[] {
  return hostCommands.reduce<ContextMenuContribution[]>((menus, command, index) => {
      const base = {
        id: `host.context-menu.${command.id}`,
        label: command.title,
        commandId: command.id,
        order: (index + 1) * 10,
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
