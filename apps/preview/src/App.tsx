import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as antd from 'antd';
import { Rocket } from 'lucide-react';
import {
  builtinContracts,
  getBuiltinContract,
  type PageSchema,
} from '@shenbi/schema';
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
  createEditorAIBridge,
  type ActivityBarItemContribution,
  type InspectorTabContribution,
  type SidebarTabContribution,
  type EditorBridgeSnapshot,
} from '@shenbi/editor-ui';
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
import {
  createEditor,
  LocalFileStorageAdapter,
  type EditorInstance,
  type FileMetadata,
} from '@shenbi/editor-core';

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

type AppMode = 'scenarios' | 'shell';

const SHELL_MODE_QUERY_KEY = 'mode';
const SHELL_MODE_QUERY_VALUE = 'shell';

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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'unknown error';
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

function getInitialAppMode(): AppMode {
  if (typeof window === 'undefined') {
    return 'scenarios';
  }
  const search = new URLSearchParams(window.location.search);
  if (search.get(SHELL_MODE_QUERY_KEY) === SHELL_MODE_QUERY_VALUE) {
    return 'shell';
  }
  if ((window as any).__SHENBI_SHELL_MODE__ === true) {
    return 'shell';
  }
  return 'scenarios';
}

function syncModeToUrl(mode: AppMode): void {
  if (typeof window === 'undefined') {
    return;
  }
  const url = new URL(window.location.href);
  if (mode === 'shell') {
    url.searchParams.set(SHELL_MODE_QUERY_KEY, SHELL_MODE_QUERY_VALUE);
  } else {
    url.searchParams.delete(SHELL_MODE_QUERY_KEY);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
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

interface FilesSidebarPanelProps {
  files: FileMetadata[];
  activeFileId: string | undefined;
  status: string;
  onOpenFile: (fileId: string) => void;
  onSaveFile: () => void;
  onSaveAsFile: () => void;
  onRefresh: () => void;
}

function FilesSidebarPanel({
  files,
  activeFileId,
  status,
  onOpenFile,
  onSaveFile,
  onSaveAsFile,
  onRefresh,
}: FilesSidebarPanelProps) {
  return (
    <div className="h-full flex flex-col text-xs text-text-primary">
      <div className="flex items-center gap-2 p-3 border-b border-border-ide">
        <button
          type="button"
          className="h-7 rounded border border-border-ide bg-bg-panel px-2 text-[12px] text-text-primary transition-colors hover:bg-bg-activity-bar"
          onClick={onSaveFile}
        >
          保存
        </button>
        <button
          type="button"
          className="h-7 rounded border border-border-ide bg-bg-panel px-2 text-[12px] text-text-primary transition-colors hover:bg-bg-activity-bar"
          onClick={onSaveAsFile}
        >
          另存为
        </button>
        <button
          type="button"
          className="h-7 rounded border border-border-ide bg-bg-panel px-2 text-[12px] text-text-primary transition-colors hover:bg-bg-activity-bar"
          onClick={onRefresh}
        >
          刷新
        </button>
      </div>
      <div className="px-3 py-2 text-[11px] text-text-secondary border-b border-border-ide">
        {status}
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-2">
        {files.length === 0 ? (
          <div className="rounded border border-dashed border-border-ide p-3 text-[11px] text-text-secondary">
            暂无文件，点击“另存为”创建
          </div>
        ) : (
          files.map((file) => (
            <div
              key={file.id}
              className={`rounded border px-2 py-2 ${
                file.id === activeFileId
                  ? 'border-blue-500 bg-bg-activity-bar'
                  : 'border-border-ide bg-bg-panel'
              }`}
            >
              <div className="truncate text-[12px] text-text-primary">{file.name}</div>
              <div className="mt-1 text-[11px] text-text-secondary">
                {new Date(file.updatedAt).toLocaleString()}
              </div>
              <button
                type="button"
                className="mt-2 h-6 rounded border border-border-ide px-2 text-[11px] transition-colors hover:bg-bg-sidebar"
                onClick={() => onOpenFile(file.id)}
              >
                打开
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function App() {
  const [appMode, setAppMode] = useState<AppMode>(() => getInitialAppMode());
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>('user-management');
  const [scenarioSchemas, setScenarioSchemas] = useState<Record<ScenarioKey, PageSchema>>(
    () => createInitialScenarioState(),
  );
  const [shellSchema, setShellSchema] = useState<PageSchema>(() => createEmptyShellSchema());
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const [activityMessage, setActivityMessage] = useState<string>('');
  const activeSchema = appMode === 'shell' ? shellSchema : scenarioSchemas[activeScenario];
  const fileStorageRef = useRef<LocalFileStorageAdapter | null>(null);
  if (!fileStorageRef.current) {
    fileStorageRef.current = new LocalFileStorageAdapter();
  }
  const fileStorage = fileStorageRef.current;
  const fileEditorRef = useRef<EditorInstance | null>(null);
  if (!fileEditorRef.current) {
    fileEditorRef.current = createEditor({
      initialSchema: activeSchema,
      fileStorage,
    });
  }
  const fileEditor = fileEditorRef.current;
  const [storedFiles, setStoredFiles] = useState<FileMetadata[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | undefined>(undefined);
  const [fileStatus, setFileStatus] = useState<string>('当前未绑定文件');

  const updateActiveSchema = useCallback((updater: (schema: PageSchema) => PageSchema) => {
    if (appMode === 'shell') {
      setShellSchema((prev) => updater(prev));
      return;
    }
    setScenarioSchemas((prev) => ({
      ...prev,
      [activeScenario]: updater(prev[activeScenario]),
    }));
  }, [activeScenario, appMode]);

  const refreshStoredFiles = useCallback(async () => {
    try {
      const files = await fileStorage.list();
      const sorted = [...files].sort((left, right) => right.updatedAt - left.updatedAt);
      setStoredFiles(sorted);
    } catch (error) {
      setFileStatus(`文件列表加载失败: ${getErrorMessage(error)}`);
    }
  }, [fileStorage]);

  const handleOpenFile = useCallback(async (fileId: string) => {
    try {
      await fileEditor.commands.execute('file.openSchema', { fileId });
      const openedSchema = fileEditor.state.getSchema();
      updateActiveSchema(() => cloneSchema(openedSchema));
      setActiveFileId(fileId);
      setFileStatus(`已打开: ${fileId}`);
      await refreshStoredFiles();
    } catch (error) {
      setFileStatus(`打开失败: ${getErrorMessage(error)}`);
    }
  }, [fileEditor, refreshStoredFiles, updateActiveSchema]);

  const handleSaveFile = useCallback(async () => {
    if (!activeFileId) {
      setFileStatus('请先执行“另存为”');
      return;
    }
    try {
      fileEditor.state.setSchema(activeSchema);
      await fileEditor.commands.execute('file.saveSchema', { fileId: activeFileId });
      setFileStatus(`已保存: ${activeFileId}`);
      await refreshStoredFiles();
    } catch (error) {
      setFileStatus(`保存失败: ${getErrorMessage(error)}`);
    }
  }, [activeFileId, activeSchema, fileEditor, refreshStoredFiles]);

  const handleSaveAsFile = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }
    const defaultName = activeSchema.name?.trim() || 'new-page';
    const nextName = window.prompt('请输入文件名', defaultName);
    if (!nextName || !nextName.trim()) {
      return;
    }
    try {
      fileEditor.state.setSchema(activeSchema);
      await fileEditor.commands.execute('file.saveAs', { name: nextName.trim() });
      await refreshStoredFiles();
      const refreshed = await fileStorage.list();
      const matched = refreshed.find((file) => file.name === nextName.trim());
      if (matched) {
        setActiveFileId(matched.id);
        setFileStatus(`已保存: ${matched.id}`);
      } else {
        setFileStatus(`已保存: ${nextName.trim()}`);
      }
    } catch (error) {
      setFileStatus(`另存失败: ${getErrorMessage(error)}`);
    }
  }, [activeSchema, fileEditor, fileStorage, refreshStoredFiles]);

  useEffect(() => {
    syncModeToUrl(appMode);
  }, [appMode]);

  useEffect(() => () => {
    fileEditor.destroy();
  }, [fileEditor]);

  useEffect(() => {
    fileEditor.state.setSchema(activeSchema);
  }, [activeSchema, fileEditor]);

  useEffect(() => {
    void refreshStoredFiles();
  }, [refreshStoredFiles]);

  useEffect(() => {
    const offSaved = fileEditor.eventBus.on('file:saved', ({ fileId }) => {
      setActiveFileId(fileId);
      setFileStatus(`已保存: ${fileId}`);
    });
    const offOpened = fileEditor.eventBus.on('file:opened', ({ fileId }) => {
      setActiveFileId(fileId);
      setFileStatus(`已打开: ${fileId}`);
    });
    return () => {
      offSaved();
      offOpened();
    };
  }, [fileEditor]);

  const treeNodes = useMemo(() => buildEditorTree(activeSchema), [activeSchema]);

  useEffect(() => {
    setSelectedNodeId((prev) => {
      if (prev && getSchemaNodeByTreeId(activeSchema, prev)) {
        return prev;
      }
      return getDefaultSelectedNodeId(treeNodes);
    });
  }, [activeSchema, treeNodes]);

  const selectedNode = useMemo(
    () => getSchemaNodeByTreeId(activeSchema, selectedNodeId),
    [activeSchema, selectedNodeId],
  );

  const selectedContract = useMemo(
    () => (selectedNode ? getBuiltinContract(selectedNode.component) : undefined),
    [selectedNode],
  );
  const inspectorTabs = useMemo<InspectorTabContribution[]>(() => [
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
  ], []);
  const sidebarTabs = useMemo<SidebarTabContribution[]>(() => {
    const tabs: SidebarTabContribution[] = [
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
    ];
    if (appMode === 'shell') {
      tabs.push({
        id: 'files',
        label: 'Files',
        order: 35,
        render: () => (
          <FilesSidebarPanel
            files={storedFiles}
            activeFileId={activeFileId}
            status={fileStatus}
            onOpenFile={handleOpenFile}
            onSaveFile={handleSaveFile}
            onSaveAsFile={handleSaveAsFile}
            onRefresh={() => {
              void refreshStoredFiles();
            }}
          />
        ),
      });
    }
    return tabs;
  }, [
    activeFileId,
    appMode,
    fileStatus,
    handleOpenFile,
    handleSaveAsFile,
    handleSaveFile,
    refreshStoredFiles,
    storedFiles,
  ]);
  const activityBarItems = useMemo<ActivityBarItemContribution[]>(() => [
    {
      id: 'rocket',
      label: 'Rocket',
      icon: Rocket,
      order: 99,
      section: 'main',
      targetSidebarTabId: 'assets',
      onClick: () => setActivityMessage('Activity Plugin Triggered'),
    },
  ], []);

  const aiBridgeListenersRef = useRef(new Set<(snapshot: EditorBridgeSnapshot) => void>());
  const aiSnapshotRef = useRef<EditorBridgeSnapshot>({
    schema: activeSchema,
    ...(selectedNodeId ? { selectedNodeId } : {}),
  });

  useEffect(() => {
    const snapshot: EditorBridgeSnapshot = {
      schema: activeSchema,
      ...(selectedNodeId ? { selectedNodeId } : {}),
    };
    aiSnapshotRef.current = snapshot;
    for (const listener of aiBridgeListenersRef.current) {
      listener(snapshot);
    }
  }, [activeSchema, selectedNodeId]);

  const aiBridge = useMemo(() => createEditorAIBridge({
    getSnapshot: () => aiSnapshotRef.current,
    replaceSchema: (schema) => updateActiveSchema(() => schema),
    getAvailableComponents: () => builtinContracts,
    subscribe: (listener) => {
      aiBridgeListenersRef.current.add(listener);
      listener(aiSnapshotRef.current);
      return () => {
        aiBridgeListenersRef.current.delete(listener);
      };
    },
  }), [updateActiveSchema]);

  const handlePatchProps = (patch: Record<string, unknown>) => {
    updateActiveSchema((schema) => patchSchemaNodeProps(schema, selectedNodeId, patch));
  };

  const handlePatchEvents = (patch: Record<string, unknown>) => {
    updateActiveSchema((schema) => patchSchemaNodeEvents(schema, selectedNodeId, patch));
  };

  const handlePatchColumns = (columns: unknown[]) => {
    updateActiveSchema((schema) => patchSchemaNodeColumns(schema, selectedNodeId, columns));
  };

  const handlePatchStyle = (patch: Record<string, unknown>) => {
    updateActiveSchema((schema) => patchSchemaNodeStyle(schema, selectedNodeId, patch));
  };

  const handlePatchLogic = (patch: Record<string, unknown>) => {
    updateActiveSchema((schema) => patchSchemaNodeLogic(schema, selectedNodeId, patch));
  };

  const handleCanvasSelectNode = (schemaNodeId: string) => {
    const treeId = getTreeIdBySchemaNodeId(activeSchema, schemaNodeId);
    if (treeId) {
      setSelectedNodeId(treeId);
    }
  };

  return (
    <AppShell
      activityBarProps={{
        items: activityBarItems,
      }}
      sidebarProps={{
        contracts: builtinContracts,
        treeNodes,
        onSelectNode: setSelectedNodeId,
        tabs: sidebarTabs,
        ...(selectedNodeId ? { selectedNodeId } : {}),
      }}
      inspectorProps={{
        onPatchProps: handlePatchProps,
        onPatchColumns: handlePatchColumns,
        onPatchStyle: handlePatchStyle,
        onPatchEvents: handlePatchEvents,
        onPatchLogic: handlePatchLogic,
        tabs: inspectorTabs,
        ...(selectedNode ? { selectedNode } : {}),
        ...(selectedContract ? { contract: selectedContract } : {}),
      }}
      aiPanelProps={{ bridge: aiBridge }}
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
