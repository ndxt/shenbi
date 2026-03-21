// ---------------------------------------------------------------------------
// Page Canvas Plugin Manifest
// ---------------------------------------------------------------------------

import React from 'react';
import {
  defineEditorPlugin,
  type EditorPluginManifest,
} from '@shenbi/editor-plugin-api';
import { PageCanvasRenderer } from './PageCanvasRenderer';

export function createPageCanvasPlugin(): EditorPluginManifest {
  return defineEditorPlugin({
    id: 'shenbi.plugin.page-canvas',
    name: '页面画布',
    contributes: {
      canvasRenderers: [
        {
          id: 'page-canvas',
          fileTypes: ['page'],
          order: 0, // Default renderer, lowest priority
          render: (context) => <PageCanvasRenderer {...context} />,
        },
      ],
    },
  });
}
