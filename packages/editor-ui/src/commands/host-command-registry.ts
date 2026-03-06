import type { PluginShortcutContribution } from '@shenbi/editor-plugin-api';
import type { PluginContext } from '@shenbi/editor-plugin-api';

export interface HostCommandDefinition {
  id: string;
  title: string;
  shortcut?: string;
  when?: string;
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
