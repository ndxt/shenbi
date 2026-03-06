import {
  defineEditorPlugin,
  type EditorPluginManifest,
} from '@shenbi/editor-plugin-api';
import { createFilesSidebarTab, type CreateFilesSidebarTabOptions } from './sidebar-tab';

export interface CreateFilesPluginOptions extends CreateFilesSidebarTabOptions {
  id?: string;
  name?: string;
}

export function createFilesPlugin(options: CreateFilesPluginOptions): EditorPluginManifest {
  const sidebarTab = createFilesSidebarTab(options);
  return defineEditorPlugin({
    id: options.id ?? 'shenbi.plugin.files',
    name: options.name ?? 'Files Plugin',
    contributes: {
      sidebarTabs: [sidebarTab],
    },
  });
}
