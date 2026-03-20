/**
 * GitLab Sync plugin registration.
 *
 * Adds a GitLab icon to the ActivityBar and a primary panel
 * for the sync UI.
 */

import type React from 'react';
import {
  defineEditorPlugin,
  type EditorPluginManifest,
} from '@shenbi/editor-plugin-api';
import { GitBranch } from 'lucide-react';
import type { GitLabSyncPanelProps } from './GitLabSyncPanel';
import { GitLabSyncPanel } from './GitLabSyncPanel';

export interface CreateGitLabSyncPluginOptions extends GitLabSyncPanelProps {
  id?: string | undefined;
  name?: string | undefined;
  activityLabel?: string | undefined;
  activityOrder?: number | undefined;
}

export function createGitLabSyncPlugin(options: CreateGitLabSyncPluginOptions): EditorPluginManifest {
  const panelId = 'gitlab-sync';

  return defineEditorPlugin({
    id: options.id ?? 'shenbi.plugin.gitlab-sync',
    name: options.name ?? 'GitLab 同步',
    contributes: {
      activityBarItems: [
        {
          id: 'gitlab-sync',
          label: options.activityLabel ?? 'GitLab',
          icon: GitBranch,
          order: options.activityOrder ?? 10,
          active: false,
          section: 'main',
          target: { type: 'panel', panelId },
        },
      ],
      primaryPanels: [
        {
          id: panelId,
          label: 'GitLab 同步',
          order: 40,
          render: () => (
            <GitLabSyncPanel
              getLocalFiles={options.getLocalFiles}
              writeLocalFile={options.writeLocalFile}
              deleteLocalFile={options.deleteLocalFile}
              refreshFileTree={options.refreshFileTree}
            />
          ),
        },
      ],
    },
  });
}
