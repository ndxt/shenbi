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
import { registerAiChatLocale } from './i18n';

// Register i18n locale resources
registerAiChatLocale();

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

function AIChatPanelHost(
  props: Pick<
    CreateAIChatPluginOptions,
    'bridge'
    | 'defaultPlannerModel'
    | 'defaultBlockModel'
    | 'getAvailableComponents'
    | 'subscribe'
  > & {
    context: PluginContext;
  },
) {
  const bridge = React.useMemo(() => {
    if (props.bridge) {
      return props.bridge;
    }
    if (!props.getAvailableComponents) {
      return undefined;
    }
    return createEditorAIBridgeFromPluginContext({
      context: props.context,
      getAvailableComponents: props.getAvailableComponents,
      ...(props.subscribe ? { subscribe: props.subscribe } : {}),
    });
  }, [props.bridge, props.context, props.getAvailableComponents, props.subscribe]);

  return (
    <AIPanel
      pluginContext={props.context}
      {...(bridge ? { bridge } : {})}
      {...(props.defaultPlannerModel ? { defaultPlannerModel: props.defaultPlannerModel } : {})}
      {...(props.defaultBlockModel ? { defaultBlockModel: props.defaultBlockModel } : {})}
    />
  );
}

export function createAIChatPlugin(options: CreateAIChatPluginOptions): EditorPluginManifest {
  const panel = {
    id: options.panelId ?? 'ai-chat',
    label: options.panelLabel ?? 'AI Assistant',
    order: options.order ?? 100,
    ...(options.defaultOpen !== undefined ? { defaultOpen: options.defaultOpen } : {}),
    defaultWidth: options.defaultWidth ?? 300,
    render: (context: PluginContext) => {
      return (
        <AIChatPanelHost
          context={context}
          {...(options.bridge ? { bridge: options.bridge } : {})}
          {...(options.defaultPlannerModel ? { defaultPlannerModel: options.defaultPlannerModel } : {})}
          {...(options.defaultBlockModel ? { defaultBlockModel: options.defaultBlockModel } : {})}
          {...(options.getAvailableComponents ? { getAvailableComponents: options.getAvailableComponents } : {})}
          {...(options.subscribe ? { subscribe: options.subscribe } : {})}
        />
      );
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
