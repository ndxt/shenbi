import {
  defineEditorPlugin,
  type EditorPluginManifest,
  type InspectorTabContribution,
} from '@shenbi/editor-plugin-api';
import { createBuiltinInspectorTabs } from './inspector-tabs';

export interface CreateSetterPluginOptions {
  id?: string;
  name?: string;
  inspectorTabs?: InspectorTabContribution[];
}

export function createSetterPlugin(options: CreateSetterPluginOptions = {}): EditorPluginManifest {
  return defineEditorPlugin({
    id: options.id ?? 'shenbi.plugin.setter',
    name: options.name ?? 'Setter Plugin',
    contributes: {
      inspectorTabs: [
        ...createBuiltinInspectorTabs(),
        ...(options.inspectorTabs ?? []),
      ],
    },
  });
}
