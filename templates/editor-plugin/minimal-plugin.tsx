import * as React from 'react';
import { defineEditorPlugin } from '@shenbi/editor-plugin-api';

export const minimalPlugin = defineEditorPlugin({
  id: 'shenbi.plugin.minimal',
  name: 'Minimal Plugin',
  activate: (context) => {
    context.notifications?.info?.('Minimal plugin activated');

    return () => {
      context.notifications?.info?.('Minimal plugin disposed');
    };
  },
  contributes: {
    commands: [
      {
        id: 'shenbi.plugin.minimal.sayHello',
        title: 'Minimal: Say Hello',
        category: 'Examples',
        description: 'Show a simple notification from a plugin command.',
        aliases: ['hello plugin'],
        keywords: ['example', 'template', 'notification'],
        execute: (context) => {
          context.notifications?.info?.('Hello from minimal plugin');
        },
      },
    ],
    shortcuts: [
      {
        id: 'shenbi.plugin.minimal.sayHello.shortcut',
        commandId: 'shenbi.plugin.minimal.sayHello',
        keybinding: 'Mod+Shift+H',
        when: 'editorFocused && !inputFocused',
      },
    ],
    menus: [
      {
        id: 'shenbi.plugin.minimal.sayHello.menu',
        label: 'Minimal Hello',
        commandId: 'shenbi.plugin.minimal.sayHello',
        target: 'toolbar-end',
        group: 'examples',
        order: 50,
      },
    ],
    contextMenus: [
      {
        id: 'shenbi.plugin.minimal.sayHello.context',
        label: 'Minimal Hello',
        commandId: 'shenbi.plugin.minimal.sayHello',
        area: 'canvas',
        group: 'examples',
        order: 50,
      },
    ],
  },
});

export function MinimalPluginPanel() {
  return React.createElement('div', null, 'Minimal plugin panel placeholder');
}
