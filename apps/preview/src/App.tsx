import { useCallback, useEffect, useMemo, useState } from 'react';
import * as antd from 'antd';
import { Rocket } from 'lucide-react';
import {
  builtinContracts,
  getBuiltinContract,
  type PageSchema,
} from '@shenbi/schema';
import { defineEditorPlugin } from '@shenbi/editor-plugin-api';
import {
  type EditorStateSnapshot,
  buildEditorTree,
  getDefaultSelectedNodeId,
  getSchemaNodeByTreeId,
  getTreeIdBySchemaNodeId,
  patchSchemaNodeColumns,
  patchSchemaNodeEvents,
  patchSchemaNodeLogic,
  patchSchemaNodeProps,
  patchSchemaNodeStyle,
} from '@shenbi/editor-core';
import {
  descriptionsSkeletonSchema,
  drawerDetailSkeletonSchema,
  formListSkeletonSchema,
  nineGridSkeletonSchema,
  tabsDetailSkeletonSchema,
  treeManagementSkeletonSchema,
  userManagementSchema,
} from './schemas';
import { ScenarioRuntimeView } from './runtime/ScenarioRuntimeView';

import { AppShell } from '@shenbi/editor-ui';
import {
  useEditorHostBridge,
  useEditorSession,
  useNodePatchDispatch,
  usePluginContext,
  useScenarioSession,
  useShellModeUrl,
  useSelectionSync,
  type ShellMode,
} from '@shenbi/editor-ui';
import { createAIChatPlugin } from '@shenbi/editor-plugin-ai-chat';
import { createFilesPlugin, useFileWorkspace } from '@shenbi/editor-plugin-files';
import { createSetterPlugin } from '@shenbi/editor-plugin-setter';

type ScenarioKey =
  | 'user-management'
  | 'form-list'
  | 'tabs-detail'
  | 'tree-management'
  | 'descriptions'
  | 'drawer-detail'
  | 'nine-grid';

type AppMode = ShellMode;
const ACTIVE_SCENARIO_STORAGE_KEY = 'shenbi:preview:active-scenario';

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

function createEmptyShellSchema(): PageSchema {
  return {
    id: 'shell-page',
    name: 'Shell Page',
    body: [],
  };
}

function getStoredActiveScenario(): ScenarioKey {
  if (typeof window === 'undefined') {
    return 'user-management';
  }

  const storedScenario = window.localStorage.getItem(ACTIVE_SCENARIO_STORAGE_KEY);
  if (storedScenario && scenarioOptions.some((option) => option.value === storedScenario)) {
    return storedScenario as ScenarioKey;
  }

  return 'user-management';
}

export function App() {
  const [appMode, setAppMode] = useShellModeUrl();
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>(() => getStoredActiveScenario());
  const initialScenarioSnapshots = useMemo(() => createInitialScenarioSnapshots(), []);
  const initialScenarioSchemas = useMemo(() => createInitialScenarioState(), []);
  const [activityMessage, setActivityMessage] = useState<string>('');
  const initialShellSchema = useMemo(() => createEmptyShellSchema(), []);
  const {
    activeScenarioSnapshot,
    updateScenarioSnapshot,
    updateScenarioSchema,
    setScenarioSelectedNodeId,
    executeScenarioCommand,
  } = useScenarioSession({
    activeScenario,
    initialSnapshots: initialScenarioSnapshots,
  });
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
  const activeSchema = appMode === 'shell' ? shellSnapshot.schema : activeScenarioSnapshot.schema;
  const {
    activeFileName,
    filesSidebarTabOptions,
    isDirty,
    canUndo,
    canRedo,
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
  const patchSelectedNode = useMemo(() => ({
    props: handlePatchProps,
    columns: handlePatchColumns,
    style: handlePatchStyle,
    events: handlePatchEvents,
    logic: handlePatchLogic,
  }), [
    handlePatchColumns,
    handlePatchEvents,
    handlePatchLogic,
    handlePatchProps,
    handlePatchStyle,
  ]);
  const notifications = useMemo(() => ({
    info: (message: string) => antd.message.info(message),
    success: (message: string) => antd.message.success(message),
    warning: (message: string) => antd.message.warning(message),
    error: (message: string) => antd.message.error(message),
  }), []);
  const promptFileName = useCallback((defaultName: string) => {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.prompt('请输入文件名', defaultName);
  }, []);
  const { executePluginCommand } = useEditorHostBridge({
    mode: appMode === 'shell' ? 'shell' : 'scenarios',
    shellCommands: fileEditor.commands,
    scenarioCommands: executeScenarioCommand,
    activeFileId: appMode === 'shell'
      ? shellSnapshot.currentFileId
      : activeScenarioSnapshot.currentFileId,
    schemaName: activeSchema.name,
    promptFileName,
  });
  const pluginContext = usePluginContext({
    schema: activeSchema,
    selectedNode,
    selectedNodeId,
    replaceSchema: (schema) => updateActiveSchema(() => schema),
    patchSelectedNode,
    executeCommand: executePluginCommand,
    notifications,
  });
  const handleResetWorkspace = useCallback(() => {
    if (appMode === 'shell') {
      updateActiveSchema(() => createEmptyShellSchema());
      setShellSelectedNodeId(undefined);
      return;
    }

    updateScenarioSnapshot(activeScenario, (previousSnapshot) => ({
      ...previousSnapshot,
      ...createScenarioSnapshot(cloneSchema(initialScenarioSchemas[activeScenario])),
      ...(previousSnapshot.currentFileId ? { currentFileId: previousSnapshot.currentFileId } : {}),
    }));
    setScenarioSelectedNodeId(undefined);
  }, [
    activeScenario,
    appMode,
    initialScenarioSchemas,
    setScenarioSelectedNodeId,
    setShellSelectedNodeId,
    updateActiveSchema,
    updateScenarioSnapshot,
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
        onResetWorkspace: handleResetWorkspace,
      }),
    ];
    if (appMode === 'shell' && filesSidebarTabOptions) {
      registeredPlugins.push(createFilesPlugin(filesSidebarTabOptions));
    }
    return registeredPlugins;
  }, [appMode, filesSidebarTabOptions, handleResetWorkspace]);

  const handleCanvasSelectNode = (schemaNodeId: string) => {
    selectSchemaNode(schemaNodeId);
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(ACTIVE_SCENARIO_STORAGE_KEY, activeScenario);
  }, [activeScenario]);

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
          <button
            type="button"
            aria-label="清空页面"
            className="h-7 rounded border border-border-ide bg-bg-panel px-2 text-[12px] text-text-primary transition-colors hover:bg-bg-activity-bar"
            onClick={handleResetWorkspace}
          >
            清空页面
          </button>
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
