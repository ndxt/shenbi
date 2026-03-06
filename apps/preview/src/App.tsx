import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as antd from 'antd';
import { Rocket } from 'lucide-react';
import {
  builtinContracts,
  getBuiltinContract,
  type PageSchema,
} from '@shenbi/schema';
import { defineEditorPlugin, type PluginContext } from '@shenbi/editor-plugin-api';
import {
  History,
  LocalFileStorageAdapter,
  type EditorStateSnapshot,
  type FileStorageAdapter,
} from '@shenbi/editor-core';
import {
  antdResolver,
  compileSchema,
  Container,
  ShenbiPage,
  usePageRuntime,
} from '@shenbi/engine';
import { installMockFetch } from './mock/mock-fetch';
import {
  descriptionsSkeletonSchema,
  drawerDetailSkeletonSchema,
  formListSkeletonSchema,
  nineGridSkeletonSchema,
  tabsDetailSkeletonSchema,
  treeManagementSkeletonSchema,
  userManagementSchema,
} from './schemas';

import { AppShell } from '@shenbi/editor-ui';
import {
  useEditorSession,
  useNodePatchDispatch,
  useShellModeUrl,
  useSelectionSync,
  type ShellMode,
  type ActivityBarItemContribution,
} from '@shenbi/editor-ui';
import { createAIChatPlugin } from '@shenbi/editor-plugin-ai-chat';
import { createFilesPlugin, useFileWorkspace } from '@shenbi/editor-plugin-files';
import { createSetterPlugin } from '@shenbi/editor-plugin-setter';
import {
  buildEditorTree,
  getDefaultSelectedNodeId,
  getSchemaNodeByTreeId,
  getTreeIdBySchemaNodeId,
  patchSchemaNodeColumns,
  patchSchemaNodeEvents,
  patchSchemaNodeLogic,
  patchSchemaNodeProps,
  patchSchemaNodeStyle,
} from './editor/schema-editor';
const resolver = antdResolver(antd);
resolver.register('Container', Container);

type ScenarioKey =
  | 'user-management'
  | 'form-list'
  | 'tabs-detail'
  | 'tree-management'
  | 'descriptions'
  | 'drawer-detail'
  | 'nine-grid';

type AppMode = ShellMode;

const scenarioOptions: { label: string; value: ScenarioKey }[] = [
  { label: '用户管理场景', value: 'user-management' },
  { label: 'Form.List', value: 'form-list' },
  { label: 'Tabs 详情', value: 'tabs-detail' },
  { label: 'Tree 管理', value: 'tree-management' },
  { label: 'Descriptions', value: 'descriptions' },
  { label: 'Drawer 详情', value: 'drawer-detail' },
  { label: '九宫格布局', value: 'nine-grid' },
];

const modeOptions: { label: string; value: AppMode }[] = [
  { label: '多场景', value: 'scenarios' },
  { label: 'Shell', value: 'shell' },
];

function cloneSchema(schema: PageSchema): PageSchema {
  if (typeof structuredClone === 'function') {
    return structuredClone(schema);
  }
  return JSON.parse(JSON.stringify(schema)) as PageSchema;
}

function createInitialScenarioState(): Record<ScenarioKey, PageSchema> {
  return {
    'user-management': cloneSchema(userManagementSchema),
    'form-list': cloneSchema(formListSkeletonSchema),
    'tabs-detail': cloneSchema(tabsDetailSkeletonSchema),
    'tree-management': cloneSchema(treeManagementSkeletonSchema),
    descriptions: cloneSchema(descriptionsSkeletonSchema),
    'drawer-detail': cloneSchema(drawerDetailSkeletonSchema),
    'nine-grid': cloneSchema(nineGridSkeletonSchema),
  };
}

function createScenarioSnapshot(schema: PageSchema): EditorStateSnapshot {
  return {
    schema,
    isDirty: false,
    canUndo: false,
    canRedo: false,
  };
}

function createInitialScenarioSnapshots(): Record<ScenarioKey, EditorStateSnapshot> {
  const schemas = createInitialScenarioState();
  return {
    'user-management': createScenarioSnapshot(schemas['user-management']),
    'form-list': createScenarioSnapshot(schemas['form-list']),
    'tabs-detail': createScenarioSnapshot(schemas['tabs-detail']),
    'tree-management': createScenarioSnapshot(schemas['tree-management']),
    descriptions: createScenarioSnapshot(schemas.descriptions),
    'drawer-detail': createScenarioSnapshot(schemas['drawer-detail']),
    'nine-grid': createScenarioSnapshot(schemas['nine-grid']),
  };
}

function createScenarioHistories(
  snapshots: Record<ScenarioKey, EditorStateSnapshot>,
): Record<ScenarioKey, History<EditorStateSnapshot>> {
  return {
    'user-management': new History(snapshots['user-management']),
    'form-list': new History(snapshots['form-list']),
    'tabs-detail': new History(snapshots['tabs-detail']),
    'tree-management': new History(snapshots['tree-management']),
    descriptions: new History(snapshots.descriptions),
    'drawer-detail': new History(snapshots['drawer-detail']),
    'nine-grid': new History(snapshots['nine-grid']),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createEmptyShellSchema(): PageSchema {
  return {
    id: 'shell-page',
    name: 'Shell Page',
    body: [],
  };
}

interface ScenarioRuntimeViewProps {
  schema: PageSchema;
}

function ScenarioRuntimeView({ schema }: ScenarioRuntimeViewProps) {
  useEffect(() => {
    const isTest = process.env.NODE_ENV === 'test';
    const controller = installMockFetch({
      minDelayMs: isTest ? 0 : 200,
      maxDelayMs: isTest ? 0 : 500,
    });
    return () => {
      controller.restore();
    };
  }, []);

  const runtime = usePageRuntime(schema, {
    message: antd.message,
    notification: antd.notification,
  });

  const compiledBody = useMemo(
    () => compileSchema(schema.body, resolver),
    [schema],
  );

  return (
    <ShenbiPage
      schema={schema}
      resolver={resolver}
      runtime={runtime}
      compiledBody={compiledBody}
    />
  );
}

export function App() {
  const [appMode, setAppMode] = useShellModeUrl();
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>('user-management');
  const [scenarioSnapshots, setScenarioSnapshots] = useState<Record<ScenarioKey, EditorStateSnapshot>>(
    () => createInitialScenarioSnapshots(),
  );
  const [activityMessage, setActivityMessage] = useState<string>('');
  const initialShellSchema = useMemo(() => createEmptyShellSchema(), []);
  const scenarioFileStorageRef = useRef<FileStorageAdapter>(new LocalFileStorageAdapter());
  const scenarioHistoriesRef = useRef<Record<ScenarioKey, History<EditorStateSnapshot>> | null>(null);
  if (!scenarioHistoriesRef.current) {
    scenarioHistoriesRef.current = createScenarioHistories(scenarioSnapshots);
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
  const {
    editor: fileEditor,
    shellSnapshot,
    setShellSelectedNodeId,
    executeShellNodeCommand,
    updateActiveSchema,
  } = useEditorSession({
    mode: appMode,
    initialShellSchema,
    updateScenarioSchema,
    onError: (message) => {
      antd.message.error(message);
    },
  });
  const activeScenarioSnapshot = scenarioSnapshots[activeScenario];
  const activeSchema = appMode === 'shell' ? shellSnapshot.schema : activeScenarioSnapshot.schema;
  const {
    activeFileName,
    filesSidebarTabOptions,
    isDirty,
    canUndo,
    canRedo,
    handleSave: handleSaveFile,
    handleUndo,
    handleRedo,
  } = useFileWorkspace({
    mode: appMode === 'shell' ? 'shell' : 'scenarios',
    snapshot: {
      currentFileId: appMode === 'shell' ? shellSnapshot.currentFileId : activeScenarioSnapshot.currentFileId,
      schemaName: activeSchema.name,
      isDirty: appMode === 'shell' ? shellSnapshot.isDirty : activeScenarioSnapshot.isDirty,
      canUndo: appMode === 'shell' ? shellSnapshot.canUndo : activeScenarioSnapshot.canUndo,
      canRedo: appMode === 'shell' ? shellSnapshot.canRedo : activeScenarioSnapshot.canRedo,
    },
    commands: fileEditor.commands,
    onError: (message) => {
      antd.message.error(message);
    },
    promptFileName: (defaultName) => {
      if (typeof window === 'undefined') {
        return null;
      }
      return window.prompt('请输入文件名', defaultName);
    },
  });

  const treeNodes = useMemo(() => buildEditorTree(activeSchema), [activeSchema]);
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
  const { selectedNodeId, selectTreeNode, selectSchemaNode } = useSelectionSync({
    mode: appMode === 'shell' ? 'shell' : 'scenarios',
    schema: activeSchema,
    treeNodes,
    shellSelectedNodeId: shellSnapshot.selectedNodeId,
    scenarioSelectedNodeId: activeScenarioSnapshot.selectedNodeId,
    setShellSelectedNodeId,
    setScenarioSelectedNodeId,
    getNodeByTreeId: getSchemaNodeByTreeId,
    getDefaultSelectedNodeId,
    getTreeIdBySchemaNodeId,
  });

  const selectedNode = useMemo(
    () => getSchemaNodeByTreeId(activeSchema, selectedNodeId),
    [activeSchema, selectedNodeId],
  );

  const selectedContract = useMemo(
    () => (selectedNode ? getBuiltinContract(selectedNode.component) : undefined),
    [selectedNode],
  );
  const {
    handlePatchProps,
    handlePatchEvents,
    handlePatchColumns,
    handlePatchStyle,
    handlePatchLogic,
  } = useNodePatchDispatch({
    mode: appMode === 'shell' ? 'shell' : 'scenarios',
    selectedNodeId,
    executeShellCommand: executeShellNodeCommand,
    updateScenarioSchema,
    patchSchemaNodeProps,
    patchSchemaNodeEvents,
    patchSchemaNodeStyle,
    patchSchemaNodeLogic,
    patchSchemaNodeColumns,
  });
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
  const promptFileName = useCallback((defaultName: string) => {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.prompt('请输入文件名', defaultName);
  }, []);
  const executeBaseCommand = useCallback((commandId: string, payload?: unknown) => {
    if (appMode === 'shell') {
      return fileEditor.commands.execute(commandId, payload);
    }
    return executeScenarioCommand(commandId, payload);
  }, [appMode, executeScenarioCommand, fileEditor.commands]);
  const activeSchemaRef = useRef(activeSchema);
  const selectedNodeRef = useRef(selectedNode);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const documentListenersRef = useRef(new Set<(schema: PageSchema) => void>());
  const selectionListenersRef = useRef(new Set<(nodeId: string | undefined) => void>());

  useEffect(() => {
    activeSchemaRef.current = activeSchema;
    for (const listener of documentListenersRef.current) {
      listener(activeSchema);
    }
  }, [activeSchema]);

  useEffect(() => {
    selectedNodeRef.current = selectedNode;
    selectedNodeIdRef.current = selectedNodeId;
    for (const listener of selectionListenersRef.current) {
      listener(selectedNodeId);
    }
  }, [selectedNode, selectedNodeId]);

  const executePluginCommand = useCallback((commandId: string, payload?: unknown) => {
    const activeFileId = appMode === 'shell'
      ? shellSnapshot.currentFileId
      : activeScenarioSnapshot.currentFileId;
    const defaultName = activeSchemaRef.current.name?.trim() || 'new-page';

    if (commandId === 'file.saveAs') {
      const explicitName = isRecord(payload) && typeof payload.name === 'string' && payload.name.trim().length > 0
        ? payload.name.trim()
        : promptFileName(defaultName);
      if (!explicitName) {
        return Promise.resolve(undefined);
      }
      return executeBaseCommand(commandId, { name: explicitName });
    }

    if (commandId === 'file.saveSchema' && !activeFileId && (!isRecord(payload) || payload.fileId === undefined)) {
      const explicitName = promptFileName(defaultName);
      if (!explicitName) {
        return Promise.resolve(undefined);
      }
      return executeBaseCommand('file.saveAs', { name: explicitName });
    }

    return executeBaseCommand(commandId, payload);
  }, [
    activeScenarioSnapshot.currentFileId,
    appMode,
    executeBaseCommand,
    promptFileName,
    shellSnapshot.currentFileId,
  ]);
  const pluginContext = useMemo<PluginContext>(() => ({
    document: {
      getSchema: () => activeSchemaRef.current,
      replaceSchema: (schema) => updateActiveSchema(() => schema),
      patchSelectedNode: {
        props: handlePatchProps,
        columns: handlePatchColumns,
        style: handlePatchStyle,
        events: handlePatchEvents,
        logic: handlePatchLogic,
      },
      subscribe: (listener) => {
        documentListenersRef.current.add(listener);
        listener(activeSchemaRef.current);
        return () => {
          documentListenersRef.current.delete(listener);
        };
      },
    },
    selection: {
      getSelectedNode: () => selectedNodeRef.current,
      getSelectedNodeId: () => selectedNodeIdRef.current,
      subscribe: (listener) => {
        selectionListenersRef.current.add(listener);
        listener(selectedNodeIdRef.current);
        return () => {
          selectionListenersRef.current.delete(listener);
        };
      },
    },
    commands: {
      execute: executePluginCommand,
    },
    notifications: {
      info: (message) => antd.message.info(message),
      success: (message) => antd.message.success(message),
      warning: (message) => antd.message.warning(message),
      error: (message) => antd.message.error(message),
    },
  }), [
    executePluginCommand,
    handlePatchColumns,
    handlePatchEvents,
    handlePatchLogic,
    handlePatchProps,
    handlePatchStyle,
    updateActiveSchema,
  ]);
  const plugins = useMemo(() => {
    const registeredPlugins = [
      createSetterPlugin({
        inspectorTabs: [
          {
            id: 'debug',
            label: 'Debug',
            order: 99,
            render: (context) => (
              <div className="p-3 text-xs text-text-secondary">
                Plugin Tab Loaded
                {context.selectedNode?.id ? (
                  <div className="mt-2 text-[11px]">Selected: {context.selectedNode.id}</div>
                ) : null}
              </div>
            ),
          },
        ],
      }),
      defineEditorPlugin({
        id: 'preview.assets',
        name: 'Preview Assets Plugin',
        contributes: {
          activityBarItems: [
            {
              id: 'rocket',
              label: 'Rocket',
              icon: Rocket,
              order: 99,
              section: 'main',
              targetSidebarTabId: 'assets',
              onClick: () => setActivityMessage('Activity Plugin Triggered'),
            },
          ],
          sidebarTabs: [
            {
              id: 'assets',
              label: 'Assets',
              order: 99,
              render: () => (
                <div className="p-3 text-xs text-text-secondary">
                  Sidebar Plugin Loaded
                </div>
              ),
            },
          ],
        },
      }),
      createAIChatPlugin({
        defaultWidth: 300,
        getAvailableComponents: () => builtinContracts,
      }),
    ];
    if (appMode === 'shell' && filesSidebarTabOptions) {
      registeredPlugins.push(createFilesPlugin(filesSidebarTabOptions));
    }
    return registeredPlugins;
  }, [appMode, filesSidebarTabOptions]);

  const handleCanvasSelectNode = (schemaNodeId: string) => {
    selectSchemaNode(schemaNodeId);
  };

  return (
    <AppShell
      sidebarProps={{
        contracts: builtinContracts,
        treeNodes,
        onSelectNode: selectTreeNode,
        ...(selectedNodeId ? { selectedNodeId } : {}),
      }}
      inspectorProps={{
        ...(selectedNode ? { selectedNode } : {}),
        ...(selectedContract ? { contract: selectedContract } : {}),
      }}
      plugins={plugins}
      pluginContext={pluginContext}
      onCanvasSelectNode={handleCanvasSelectNode}
      toolbarExtra={(
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-secondary">模式</span>
          <select
            className="h-7 w-[110px] rounded border border-border-ide bg-bg-panel px-2 text-[12px] text-text-primary outline-none transition-colors hover:bg-bg-activity-bar focus:border-blue-500"
            aria-label="模式切换"
            value={appMode}
            onChange={(event) => setAppMode(event.target.value as AppMode)}
          >
            {modeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {appMode === 'scenarios' ? (
            <>
              <span className="text-[11px] text-text-secondary">场景</span>
              <select
                className="h-7 w-[180px] rounded border border-border-ide bg-bg-panel px-2 text-[12px] text-text-primary outline-none transition-colors hover:bg-bg-activity-bar focus:border-blue-500"
                aria-label="场景切换"
                value={activeScenario}
                onChange={(event) => setActiveScenario(event.target.value as ScenarioKey)}
              >
                {scenarioOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          {appMode === 'shell' ? (
            <>
              <span
                aria-label="当前文件"
                className="max-w-[220px] truncate text-[11px] text-text-secondary"
              >
                {activeFileName ?? '未命名页面'}
                {isDirty ? ' *' : ''}
              </span>
              <button
                type="button"
                aria-label="撤销"
                className="h-7 rounded border border-border-ide bg-bg-panel px-2 text-[12px] text-text-primary transition-colors hover:bg-bg-activity-bar disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canUndo}
                onClick={handleUndo}
              >
                撤销
              </button>
              <button
                type="button"
                aria-label="重做"
                className="h-7 rounded border border-border-ide bg-bg-panel px-2 text-[12px] text-text-primary transition-colors hover:bg-bg-activity-bar disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canRedo}
                onClick={handleRedo}
              >
                重做
              </button>
            </>
          ) : null}
          {activityMessage ? (
            <span className="ml-2 text-[11px] text-text-secondary">{activityMessage}</span>
          ) : null}
        </div>
      )}
    >
      <ScenarioRuntimeView key={`${appMode}:${activeScenario}`} schema={activeSchema} />
    </AppShell>
  );
}
