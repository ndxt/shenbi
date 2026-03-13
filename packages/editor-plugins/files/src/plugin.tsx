import type React from 'react';
import {
  defineEditorPlugin,
  type EditorPluginManifest,
} from '@shenbi/editor-plugin-api';
import { FileText } from 'lucide-react';
import { i18n } from '@shenbi/i18n';
import { createFilesSidebarTab, type CreateFilesSidebarTabOptions } from './sidebar-tab';
import { FilePanel } from './FilePanel';
import './i18n';

export interface CreateFilesPluginOptions extends CreateFilesSidebarTabOptions {
  id?: string;
  name?: string;
  activityItemId?: string;
  panelId?: string;
  activityLabel?: string;
  panelLabel?: string;
  activityOrder?: number;
  renderPrimaryPanel?: () => React.ReactNode;
}

export function createFilesPlugin(options: CreateFilesPluginOptions): EditorPluginManifest {
  const panelId = options.panelId ?? 'files';
  const panelLabel = options.panelLabel ?? options.label ?? i18n.t('title', { ns: 'pluginFiles' });
  const renderPrimaryPanel = options.renderPrimaryPanel ?? (() => (
    <FilePanel
      files={options.files}
      activeFileId={options.activeFileId}
      status={options.status}
      onOpenFile={options.onOpenFile}
      onSaveFile={options.onSaveFile}
      onSaveAsFile={options.onSaveAsFile}
      onRefresh={options.onRefresh}
    />
  ));
  const sidebarTab = createFilesSidebarTab(options);
  return defineEditorPlugin({
    id: options.id ?? 'shenbi.plugin.files',
    name: options.name ?? i18n.t('pluginName', { ns: 'pluginFiles' }),
    contributes: {
      activityBarItems: [
        {
          id: options.activityItemId ?? 'files',
          label: options.activityLabel ?? panelLabel,
          icon: FileText,
          order: options.activityOrder ?? 5,
          active: true,
          section: 'main',
          target: { type: 'panel', panelId },
        },
      ],
      primaryPanels: [
        {
          id: panelId,
          label: panelLabel,
          order: options.order ?? 35,
          render: renderPrimaryPanel,
        },
      ],
      sidebarTabs: [sidebarTab],
    },
  });
}
