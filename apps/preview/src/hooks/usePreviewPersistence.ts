import { useWorkspacePersistence } from '@shenbi/editor-ui';
import type { DocumentSessionManager, FileContent } from '@shenbi/editor-core';
import type { ScenarioKey, RenderMode } from '../preview-types';
import { createEmptyShellSchema } from '../editor/previewSchemaUtils';

const PREVIEW_PERSISTENCE_NAMESPACE = 'preview-debug';
const ACTIVE_SCENARIO_PERSISTENCE_KEY = 'active-scenario';
const SHELL_SESSION_PERSISTENCE_KEY = 'shell-session';
const RENDER_MODE_PERSISTENCE_KEY = 'canvas-render-mode';

export interface UsePreviewPersistenceOptions {
  appMode: 'shell' | 'scenarios';
  activeProjectId: string;
  activeScenario: ScenarioKey;
  setActiveScenario: (scenario: ScenarioKey) => void;
  renderMode: RenderMode;
  setRenderMode: (mode: RenderMode) => void;
  fileEditor: {
    commands: {
      execute: (commandId: string, payload?: unknown) => Promise<unknown>;
    };
  };
  fileExplorerExpandedIds: string[];
  fileExplorerFocusedId?: string | undefined;
  setFileExplorerExpandedIds: (value: string[]) => void;
  setFileExplorerFocusedId: (value: string | undefined) => void;
  scenarioValues: ScenarioKey[];
  tabManager: {
    restoreSnapshot: (snapshot: import('@shenbi/editor-core').TabManagerSnapshot) => void;
  };
  tabSnapshot: import('@shenbi/editor-core').TabManagerSnapshot;
  vfs: Pick<import('@shenbi/editor-core').VirtualFileSystemAdapter, 'listTree' | 'readFile'>;
  vfsInitialized: boolean;
  vfsInitializationFailed: boolean;
  workspacePersistence: {
    getJSON: <T>(namespace: string, key: string) => Promise<T | null | undefined>;
    setJSON: <T>(namespace: string, key: string, value: T) => Promise<void>;
  };
  sessions: DocumentSessionManager;
}

export function usePreviewPersistence(options: UsePreviewPersistenceOptions) {
  useWorkspacePersistence({
    ...options,
    renderModeValues: ['direct', 'iframe'] as const,
    persistenceKeys: {
      namespace: PREVIEW_PERSISTENCE_NAMESPACE,
      activeScenarioKey: ACTIVE_SCENARIO_PERSISTENCE_KEY,
      renderModeKey: RENDER_MODE_PERSISTENCE_KEY,
      shellSessionKey: SHELL_SESSION_PERSISTENCE_KEY,
    },
    createEmptySchema: createEmptyShellSchema,
  });
}
