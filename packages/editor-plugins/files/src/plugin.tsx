import {
  defineEditorPlugin,
  type EditorPluginManifest,
} from '@shenbi/editor-plugin-api';
import { i18n } from '@shenbi/i18n';
import { createFilesSidebarTab, type CreateFilesSidebarTabOptions } from './sidebar-tab';
import './i18n';

export interface CreateFilesPluginOptions extends CreateFilesSidebarTabOptions {
  id?: string;
  name?: string;
}

export function createFilesPlugin(options: CreateFilesPluginOptions): EditorPluginManifest {
  const sidebarTab = createFilesSidebarTab(options);
  return defineEditorPlugin({
    id: options.id ?? 'shenbi.plugin.files',
    name: options.name ?? i18n.t('pluginName', { ns: 'pluginFiles' }),
    contributes: {
      sidebarTabs: [sidebarTab],
    },
  });
}
