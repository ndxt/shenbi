// ---------------------------------------------------------------------------
// Gateway Plugin Manifest
// ---------------------------------------------------------------------------

import React from 'react';
import {
  defineEditorPlugin,
  type EditorPluginManifest,
} from '@shenbi/editor-plugin-api';
import { GatewayNodePanel } from './components/GatewayNodePanel';
import { GatewayEditor } from './components/GatewayEditor';

export function createGatewayPlugin(): EditorPluginManifest {
  return defineEditorPlugin({
    id: 'shenbi.plugin.gateway',
    name: 'API 工作流编辑器',
    contributes: {
      fileContextPanels: [
        {
          id: 'components',
          label: '组件',
          fileTypes: ['api'],
          defaultActive: true,
          order: 10,
          render: () => <GatewayNodePanel />,
        },
      ],
      canvasRenderers: [
        {
          id: 'gateway-canvas',
          fileTypes: ['api'],
          order: 10,
          render: () => <GatewayEditor />,
        },
      ],
    },
  });
}
