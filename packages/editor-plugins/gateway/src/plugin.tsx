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
import { createGatewayHostAdapter } from './gateway-host-adapter';

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
          render: (context) => {
            const hostAdapter = createGatewayHostAdapter(context);
            const interaction = context.canvasHost.interaction;
            return (
              <GatewayEditor
                {...(hostAdapter ? { hostAdapter } : {})}
                {...(interaction.activeTool ? { activeCanvasTool: interaction.activeTool as import('@shenbi/editor-ui').CanvasToolMode } : {})}
                {...(interaction.setActiveTool ? { setActiveCanvasTool: interaction.setActiveTool as (mode: import('@shenbi/editor-ui').CanvasToolMode) => void } : {})}
                {...(interaction.onRuntimeReady ? { onCanvasRuntimeReady: interaction.onRuntimeReady } : {})}
                {...(context.document ? { documentContext: context.document } : {})}
              />
            );
          },
        },
      ],
    },
  });
}
