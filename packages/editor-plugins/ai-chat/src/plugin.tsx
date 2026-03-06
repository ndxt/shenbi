import React from 'react';
import {
  type PluginContext,
  defineEditorPlugin,
  type EditorPluginManifest,
} from '@shenbi/editor-plugin-api';
import type { ComponentContract } from '@shenbi/schema';
import {
  createEditorAIBridgeFromPluginContext,
  type EditorBridgeSnapshot,
} from './ai/editor-ai-bridge';
import { AIPanel, type AIPanelProps } from './ui/AIPanel';

export interface CreateAIChatPluginOptions extends AIPanelProps {
  id?: string;
  name?: string;
  panelId?: string;
  panelLabel?: string;
  order?: number;
  defaultOpen?: boolean;
  defaultWidth?: number;
  getAvailableComponents?: () => ComponentContract[];
  subscribe?: (listener: (snapshot: EditorBridgeSnapshot) => void) => () => void;
}

export function createAIChatPlugin(options: CreateAIChatPluginOptions): EditorPluginManifest {
  const panel = {
    id: options.panelId ?? 'ai-chat',
    label: options.panelLabel ?? 'AI Assistant',
    order: options.order ?? 100,
    ...(options.defaultOpen !== undefined ? { defaultOpen: options.defaultOpen } : {}),
    defaultWidth: options.defaultWidth ?? 300,
    render: (context: PluginContext) => {
      const bridge = options.bridge ?? (
        options.getAvailableComponents
          ? createEditorAIBridgeFromPluginContext({
            context,
            getAvailableComponents: options.getAvailableComponents,
            ...(options.subscribe ? { subscribe: options.subscribe } : {}),
          })
          : undefined
      );
      return <AIPanel {...(bridge ? { bridge } : {})} />;
    },
  };

  return defineEditorPlugin({
    id: options.id ?? 'shenbi.plugin.ai-chat',
    name: options.name ?? 'AI Chat Plugin',
    contributes: {
      auxiliaryPanels: [panel],
    },
  });
}
