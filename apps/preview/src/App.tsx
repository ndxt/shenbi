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
  const [scenarioSchemas, setScenarioSchemas] = useState<Record<ScenarioKey, PageSchema>>(
    () => createInitialScenarioState(),
  );
  const [scenarioSelectedNodeId, setScenarioSelectedNodeId] = useState<string | undefined>(undefined);
  const [activityMessage, setActivityMessage] = useState<string>('');
  const initialShellSchema = useMemo(() => createEmptyShellSchema(), []);
  const updateScenarioSchema = useCallback((updater: (schema: PageSchema) => PageSchema) => {
    setScenarioSchemas((previousSchemas) => ({
      ...previousSchemas,
      [activeScenario]: updater(previousSchemas[activeScenario]),
    }));
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
  const activeSchema = appMode === 'shell' ? shellSnapshot.schema : scenarioSchemas[activeScenario];
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
      currentFileId: shellSnapshot.currentFileId,
      schemaName: activeSchema.name,
      isDirty: shellSnapshot.isDirty,
      canUndo: shellSnapshot.canUndo,
      canRedo: shellSnapshot.canRedo,
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
    scenarioSelectedNodeId,
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
      execute: (commandId, payload) => fileEditor.commands.execute(commandId, payload),
    },
    notifications: {
      info: (message) => antd.message.info(message),
      success: (message) => antd.message.success(message),
      warning: (message) => antd.message.warning(message),
      error: (message) => antd.message.error(message),
    },
  }), [
    fileEditor.commands,
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
