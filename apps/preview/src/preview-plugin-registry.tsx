import { builtinContracts } from '@shenbi/schema';
import { defineEditorPlugin } from '@shenbi/editor-plugin-api';
import {
  createFilesHostCommandsPlugin,
  createFilesHostPlugin,
  getEnabledHostPluginRegistrationIds,
  resolveHostPluginRegistrations,
} from '@shenbi/editor-ui';
import { createAIChatPlugin } from '@shenbi/editor-plugin-ai-chat';
import { createFilesPlugin, type CreateFilesPluginOptions } from '@shenbi/editor-plugin-files';
import { createSetterPlugin } from '@shenbi/editor-plugin-setter';
import { createGatewayPlugin } from '@shenbi/editor-plugin-gateway';
import { createPageCanvasPlugin } from '@shenbi/editor-plugin-page-canvas';
import { createGitLabSyncPlugin } from '../../../packages/editor-plugins/gitlab-sync/src';
import type {
  PreviewPluginFactoryContext,
  PreviewPluginRegistration,
} from './preview-types';

function createWorkspaceCommandPlugin(
  context: PreviewPluginFactoryContext,
) {
  return defineEditorPlugin({
    id: 'preview.workspace',
    name: 'Preview Workspace Commands',
    contributes: {
      commands: [
        {
          id: 'workspace.resetDocument',
          title: context.translations.previewT('commands.resetDocument.title'),
          category: 'Workspace',
          description: context.translations.previewT('commands.resetDocument.description'),
          execute: () => {
            void context.commands.executeAppCommand('workspace.resetDocument');
          },
        },
      ],
    },
  });
}

function createCanvasEditingPlugin(
  context: PreviewPluginFactoryContext,
) {
  return defineEditorPlugin({
    id: 'preview.canvas-editing',
    name: 'Preview Canvas Editing',
    contributes: {
      commands: [
        {
          id: 'canvas.deleteSelectedNode',
          title: 'Delete Selected Node',
          category: 'Canvas',
          enabledWhen: 'hasSelection && !canvasReadOnly && canCanvasDeleteSelection',
          execute: () => {
            context.canvas.handleDeleteSelectedNode();
          },
        },
        {
          id: 'canvas.duplicateSelectedNode',
          title: 'Duplicate Selected Node',
          category: 'Canvas',
          enabledWhen: 'hasSelection && !canvasReadOnly && canCanvasDuplicateSelection',
          execute: () => {
            context.canvas.handleDuplicateSelectedNode();
          },
        },
        {
          id: 'canvas.moveSelectedNodeUp',
          title: 'Move Selected Node Up',
          category: 'Canvas',
          enabledWhen: 'hasSelection && !canvasReadOnly && canCanvasMoveSelectionUp',
          execute: () => {
            context.canvas.moveSelectedNode(-1);
          },
        },
        {
          id: 'canvas.moveSelectedNodeDown',
          title: 'Move Selected Node Down',
          category: 'Canvas',
          enabledWhen: 'hasSelection && !canvasReadOnly && canCanvasMoveSelectionDown',
          execute: () => {
            context.canvas.moveSelectedNode(1);
          },
        },
      ],
      shortcuts: [
        {
          id: 'canvas.deleteSelectedNode.delete',
          commandId: 'canvas.deleteSelectedNode',
          keybinding: 'Delete',
          when: 'editorFocused && !inputFocused',
        },
        {
          id: 'canvas.deleteSelectedNode.backspace',
          commandId: 'canvas.deleteSelectedNode',
          keybinding: 'Backspace',
          when: 'editorFocused && !inputFocused',
        },
        {
          id: 'canvas.moveSelectedNodeUp.shortcut',
          commandId: 'canvas.moveSelectedNodeUp',
          keybinding: 'Alt+ArrowUp',
          when: 'editorFocused && !inputFocused',
        },
        {
          id: 'canvas.moveSelectedNodeDown.shortcut',
          commandId: 'canvas.moveSelectedNodeDown',
          keybinding: 'Alt+ArrowDown',
          when: 'editorFocused && !inputFocused',
        },
      ],
      contextMenus: [
        {
          id: 'canvas.moveSelectedNodeUp.context',
          label: 'Move Up',
          commandId: 'canvas.moveSelectedNodeUp',
          area: 'canvas',
          group: 'edit',
        },
        {
          id: 'canvas.duplicateSelectedNode.context',
          label: 'Duplicate',
          commandId: 'canvas.duplicateSelectedNode',
          area: 'canvas',
          group: 'edit',
        },
        {
          id: 'canvas.moveSelectedNodeDown.context',
          label: 'Move Down',
          commandId: 'canvas.moveSelectedNodeDown',
          area: 'canvas',
          group: 'edit',
        },
        {
          id: 'canvas.deleteSelectedNode.context',
          label: 'Delete',
          commandId: 'canvas.deleteSelectedNode',
          area: 'canvas',
          group: 'edit',
        },
      ],
    },
  });
}

function createSetterDebugPlugin(
  context: PreviewPluginFactoryContext,
) {
  return createSetterPlugin({
    inspectorTabs: [
      {
        id: 'debug',
        label: context.translations.previewT('plugins.debug.label'),
        order: 99,
        render: (pluginContext) => (
          <div className="p-3 text-xs text-text-secondary">
            {context.translations.previewT('plugins.debug.loaded')}
            {pluginContext.selectedNode?.id ? (
              <div className="mt-2 text-[11px]">
                {context.translations.previewT('plugins.debug.selected', {
                  nodeId: pluginContext.selectedNode.id,
                })}
              </div>
            ) : null}
          </div>
        ),
      },
    ],
  });
}

function createFilesPrimaryPlugin(
  context: PreviewPluginFactoryContext,
) {
  return createFilesHostPlugin({
    ...((context.workspace.filesPrimaryPanelOptions as CreateFilesPluginOptions) ?? {
      files: [],
      activeFileId: undefined,
      status: context.workspace.fileExplorerStatusText,
      onOpenFile: () => undefined,
      onSaveFile: () => undefined,
      onSaveAsFile: () => undefined,
      onRefresh: () => undefined,
    }),
    hostAdapter: context.adapters.files,
  });
}

function createFilesCommandsPlugin(
  context: PreviewPluginFactoryContext,
) {
  return createFilesHostCommandsPlugin({
    hostAdapter: context.adapters.files,
    title: context.translations.previewT('plugins.files.closeActiveTab'),
    category: context.translations.filesT('title'),
    pluginName: `${context.translations.filesT('pluginName')} Commands`,
  });
}

function createFilesFallbackPlugin(
  context: PreviewPluginFactoryContext,
) {
  return createFilesPlugin(
    context.workspace.filesPrimaryPanelOptions as CreateFilesPluginOptions,
  );
}

function createGitLabSyncManifest(
  context: PreviewPluginFactoryContext,
) {
  return createGitLabSyncPlugin({
    ...context.adapters.gitlabSync,
  });
}

export const PREVIEW_PLUGIN_REGISTRATIONS: PreviewPluginRegistration[] = [
  {
    id: 'preview.workspace',
    order: 10,
    when: () => true,
    create: createWorkspaceCommandPlugin,
  },
  {
    id: 'preview.canvas-editing',
    order: 20,
    when: () => true,
    create: createCanvasEditingPlugin,
  },
  {
    id: 'shenbi.plugin.setter.debug',
    order: 30,
    when: () => true,
    create: createSetterDebugPlugin,
  },
  {
    id: 'shenbi.plugin.ai-chat',
    order: 40,
    when: () => true,
    create: () => createAIChatPlugin({
      defaultWidth: 300,
      getAvailableComponents: () => builtinContracts,
    }),
  },
  {
    id: 'shenbi.plugin.gateway',
    order: 50,
    when: () => true,
    create: () => createGatewayPlugin(),
  },
  {
    id: 'shenbi.plugin.page-canvas',
    order: 60,
    when: () => true,
    create: () => createPageCanvasPlugin(),
  },
  {
    id: 'shenbi.plugin.files',
    order: 70,
    when: (context) => context.featureFlags.shellMode && context.featureFlags.vfsInitialized,
    create: createFilesPrimaryPlugin,
  },
  {
    id: 'shenbi.plugin.files.commands',
    order: 80,
    when: (context) => context.featureFlags.shellMode && context.featureFlags.vfsInitialized,
    create: createFilesCommandsPlugin,
  },
  {
    id: 'shenbi.plugin.gitlab-sync',
    order: 90,
    when: (context) => context.featureFlags.shellMode && context.featureFlags.vfsInitialized,
    create: createGitLabSyncManifest,
  },
  {
    id: 'shenbi.plugin.files.fallback',
    order: 100,
    when: (context) => (
      context.featureFlags.shellMode
      && !context.featureFlags.vfsInitialized
      && context.featureFlags.hasFilesPrimaryPanel
    ),
    create: createFilesFallbackPlugin,
  },
];

export function getEnabledPreviewPluginIds(context: PreviewPluginFactoryContext): string[] {
  return getEnabledHostPluginRegistrationIds(PREVIEW_PLUGIN_REGISTRATIONS, context);
}

export function resolvePreviewPlugins(context: PreviewPluginFactoryContext) {
  return resolveHostPluginRegistrations(PREVIEW_PLUGIN_REGISTRATIONS, context);
}
