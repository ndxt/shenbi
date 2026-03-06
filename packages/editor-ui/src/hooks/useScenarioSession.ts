import { useCallback, useRef, useState } from 'react';
import type { PageSchema } from '@shenbi/schema';
import {
  History,
  LocalFileStorageAdapter,
  type EditorStateSnapshot,
  type FileStorageAdapter,
} from '@shenbi/editor-core';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export interface UseScenarioSessionOptions<ScenarioKey extends string> {
  activeScenario: ScenarioKey;
  initialSnapshots: Record<ScenarioKey, EditorStateSnapshot>;
  fileStorage?: FileStorageAdapter;
}

export interface UseScenarioSessionResult<ScenarioKey extends string> {
  scenarioSnapshots: Record<ScenarioKey, EditorStateSnapshot>;
  activeScenarioSnapshot: EditorStateSnapshot;
  updateScenarioSnapshot: (
    scenario: ScenarioKey,
    updater: (snapshot: EditorStateSnapshot) => EditorStateSnapshot,
  ) => void;
  updateScenarioSchema: (updater: (schema: PageSchema) => PageSchema) => void;
  setScenarioSelectedNodeId: (
    nextNodeId: string | undefined | ((previousNodeId: string | undefined) => string | undefined),
  ) => void;
  executeScenarioCommand: (commandId: string, payload?: unknown) => Promise<unknown>;
}

export function useScenarioSession<ScenarioKey extends string>(
  options: UseScenarioSessionOptions<ScenarioKey>,
): UseScenarioSessionResult<ScenarioKey> {
  const { activeScenario, initialSnapshots } = options;
  const [scenarioSnapshots, setScenarioSnapshots] = useState<Record<ScenarioKey, EditorStateSnapshot>>(
    () => initialSnapshots,
  );
  const scenarioFileStorageRef = useRef<FileStorageAdapter>(options.fileStorage ?? new LocalFileStorageAdapter());
  const scenarioHistoriesRef = useRef<Record<ScenarioKey, History<EditorStateSnapshot>> | null>(null);
  if (!scenarioHistoriesRef.current) {
    scenarioHistoriesRef.current = Object.fromEntries(
      Object.entries(initialSnapshots).map(([scenario, snapshot]) => [scenario, new History(snapshot)]),
    ) as Record<ScenarioKey, History<EditorStateSnapshot>>;
  }

  const updateScenarioSnapshot = useCallback((
    scenario: ScenarioKey,
    updater: (snapshot: EditorStateSnapshot) => EditorStateSnapshot,
  ) => {
    setScenarioSnapshots((previousSnapshots) => ({
      ...previousSnapshots,
      [scenario]: updater(previousSnapshots[scenario]),
    }));
  }, []);

  const updateScenarioSchema = useCallback((updater: (schema: PageSchema) => PageSchema) => {
    const scenario = activeScenario;
    const history = scenarioHistoriesRef.current?.[scenario];
    setScenarioSnapshots((previousSnapshots) => {
      const previousSnapshot = previousSnapshots[scenario];
      const nextSchema = updater(previousSnapshot.schema);
      if (nextSchema === previousSnapshot.schema) {
        return previousSnapshots;
      }
      const nextSnapshotBase: EditorStateSnapshot = {
        ...previousSnapshot,
        schema: nextSchema,
        isDirty: true,
      };
      history?.push(nextSnapshotBase);
      const nextSnapshot: EditorStateSnapshot = {
        ...nextSnapshotBase,
        canUndo: history?.canUndo() ?? previousSnapshot.canUndo,
        canRedo: history?.canRedo() ?? previousSnapshot.canRedo,
      };
      return {
        ...previousSnapshots,
        [scenario]: nextSnapshot,
      };
    });
  }, [activeScenario]);

  const setScenarioSelectedNodeId = useCallback((
    nextNodeId: string | undefined | ((previousNodeId: string | undefined) => string | undefined),
  ) => {
    updateScenarioSnapshot(activeScenario, (previousSnapshot) => {
      const resolvedNodeId = typeof nextNodeId === 'function'
        ? nextNodeId(previousSnapshot.selectedNodeId)
        : nextNodeId;
      const { selectedNodeId: _selectedNodeId, ...restSnapshot } = previousSnapshot;
      return {
        ...restSnapshot,
        ...(resolvedNodeId ? { selectedNodeId: resolvedNodeId } : {}),
      };
    });
  }, [activeScenario, updateScenarioSnapshot]);

  const executeScenarioCommand = useCallback(async (commandId: string, payload?: unknown) => {
    const scenario = activeScenario;
    const history = scenarioHistoriesRef.current?.[scenario];
    const storage = scenarioFileStorageRef.current;
    if (!history) {
      throw new Error(`Scenario history not initialized: ${scenario}`);
    }

    const getActiveScenarioSnapshot = (): EditorStateSnapshot => scenarioSnapshots[scenario];

    switch (commandId) {
      case 'schema.replace': {
        if (!isRecord(payload) || !('schema' in payload)) {
          throw new Error('schema.replace expects args: { schema }');
        }
        updateScenarioSchema(() => payload.schema as PageSchema);
        return undefined;
      }
      case 'editor.undo': {
        const previousSnapshot = history.undo();
        if (!previousSnapshot) {
          return undefined;
        }
        updateScenarioSnapshot(scenario, () => ({
          ...previousSnapshot,
          canUndo: history.canUndo(),
          canRedo: history.canRedo(),
        }));
        return undefined;
      }
      case 'editor.redo': {
        const nextSnapshot = history.redo();
        if (!nextSnapshot) {
          return undefined;
        }
        updateScenarioSnapshot(scenario, () => ({
          ...nextSnapshot,
          canUndo: history.canUndo(),
          canRedo: history.canRedo(),
        }));
        return undefined;
      }
      case 'file.listSchemas':
        return storage.list();
      case 'file.openSchema': {
        if (!isRecord(payload) || typeof payload.fileId !== 'string' || payload.fileId.trim().length === 0) {
          throw new Error('file command expects args: { fileId: string }');
        }
        const fileId = payload.fileId.trim();
        const schema = await storage.read(fileId);
        const previousSnapshot = getActiveScenarioSnapshot();
        const { selectedNodeId: _selectedNodeId, ...restSnapshot } = previousSnapshot;
        const nextSnapshotBase: EditorStateSnapshot = {
          ...restSnapshot,
          schema,
          currentFileId: fileId,
          isDirty: false,
        };
        history.push(nextSnapshotBase);
        updateScenarioSnapshot(scenario, () => ({
          ...nextSnapshotBase,
          canUndo: history.canUndo(),
          canRedo: history.canRedo(),
        }));
        return undefined;
      }
      case 'file.saveSchema': {
        const snapshot = getActiveScenarioSnapshot();
        const fileId = isRecord(payload) && typeof payload.fileId === 'string' && payload.fileId.trim().length > 0
          ? payload.fileId.trim()
          : snapshot.currentFileId;
        if (!fileId) {
          throw new Error('file.saveSchema requires current file, please open or saveAs first');
        }
        await storage.write(fileId, snapshot.schema);
        updateScenarioSnapshot(scenario, (previousSnapshot) => ({
          ...previousSnapshot,
          currentFileId: fileId,
          isDirty: false,
        }));
        return undefined;
      }
      case 'file.saveAs': {
        if (!isRecord(payload) || typeof payload.name !== 'string' || payload.name.trim().length === 0) {
          throw new Error('file.saveAs expects args: { name: string }');
        }
        const snapshot = getActiveScenarioSnapshot();
        const name = payload.name.trim();
        const fileId = await storage.saveAs!(name, snapshot.schema);
        updateScenarioSnapshot(scenario, (previousSnapshot) => ({
          ...previousSnapshot,
          currentFileId: fileId,
          isDirty: false,
        }));
        return fileId;
      }
      default:
        throw new Error(`Command "${commandId}" is not supported in scenarios mode`);
    }
  }, [activeScenario, scenarioSnapshots, updateScenarioSchema, updateScenarioSnapshot]);

  return {
    scenarioSnapshots,
    activeScenarioSnapshot: scenarioSnapshots[activeScenario],
    updateScenarioSnapshot,
    updateScenarioSchema,
    setScenarioSelectedNodeId,
    executeScenarioCommand,
  };
}
