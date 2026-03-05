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
  createFilesSidebarTab,
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

function normalizeFileMetadataList(value: unknown): FileMetadata[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is FileMetadata => {
    return Boolean(item)
      && typeof item === 'object'
      && typeof (item as { id?: unknown }).id === 'string'
      && typeof (item as { name?: unknown }).name === 'string'
      && typeof (item as { updatedAt?: unknown }).updatedAt === 'number';
  });
}

function isEditableHotkeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  return target.closest('[contenteditable="true"]') !== null;
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

export function App() {
  const [appMode, setAppMode] = useState<AppMode>(() => getInitialAppMode());
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>('user-management');
  const [scenarioSchemas, setScenarioSchemas] = useState<Record<ScenarioKey, PageSchema>>(
    () => createInitialScenarioState(),
  );
  const [scenarioSelectedNodeId, setScenarioSelectedNodeId] = useState<string | undefined>(undefined);
  const [activityMessage, setActivityMessage] = useState<string>('');
  const fileStorageRef = useRef<LocalFileStorageAdapter | null>(null);
  if (!fileStorageRef.current) {
    fileStorageRef.current = new LocalFileStorageAdapter();
  }
  const fileStorage = fileStorageRef.current;
  const fileEditorRef = useRef<EditorInstance | null>(null);
  if (!fileEditorRef.current) {
    fileEditorRef.current = createEditor({
      initialSchema: createEmptyShellSchema(),
      fileStorage,
    });
  }
  const fileEditor = fileEditorRef.current;
  const [shellSnapshot, setShellSnapshot] = useState(() => fileEditor.state.getSnapshot());
  const selectedNodeId = appMode === 'shell' ? shellSnapshot.selectedNodeId : scenarioSelectedNodeId;
  const activeFileId = shellSnapshot.currentFileId;
  const activeSchema = appMode === 'shell' ? shellSnapshot.schema : scenarioSchemas[activeScenario];
  const [storedFiles, setStoredFiles] = useState<FileMetadata[]>([]);
  const [fileStatus, setFileStatus] = useState<string>('当前未绑定文件');
  const isDirty = appMode === 'shell' ? shellSnapshot.isDirty : false;
  const canUndo = appMode === 'shell' ? shellSnapshot.canUndo : false;
  const canRedo = appMode === 'shell' ? shellSnapshot.canRedo : false;
  const activeFileName = useMemo(() => {
    if (!activeFileId) {
      return undefined;
    }
    return storedFiles.find((file) => file.id === activeFileId)?.name;
  }, [activeFileId, storedFiles]);

  const updateActiveSchema = useCallback((updater: (schema: PageSchema) => PageSchema) => {
    if (appMode === 'shell') {
      const nextSchema = updater(fileEditor.state.getSchema());
      void fileEditor.commands.execute('schema.replace', { schema: nextSchema }).catch((error) => {
        antd.message.error(`Schema 更新失败: ${getErrorMessage(error)}`);
      });
      return;
    }
    setScenarioSchemas((prev) => ({
      ...prev,
      [activeScenario]: updater(prev[activeScenario]),
    }));
  }, [activeScenario, appMode, fileEditor]);

  const refreshStoredFiles = useCallback(async () => {
    try {
      const listResult = await fileEditor.commands.execute('file.listSchemas');
      const files = normalizeFileMetadataList(listResult);
      const sorted = [...files].sort((left, right) => right.updatedAt - left.updatedAt);
      setStoredFiles(sorted);
    } catch (error) {
      setFileStatus(`文件列表加载失败: ${getErrorMessage(error)}`);
    }
  }, [fileEditor]);

  const handleOpenFile = useCallback(async (fileId: string) => {
    try {
      await fileEditor.commands.execute('file.openSchema', { fileId });
      setFileStatus(`已打开: ${fileId}`);
      await refreshStoredFiles();
    } catch (error) {
      setFileStatus(`打开失败: ${getErrorMessage(error)}`);
    }
  }, [fileEditor, refreshStoredFiles]);

  const requestSaveAs = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }
    const defaultName = activeSchema.name?.trim() || 'new-page';
    const nextName = window.prompt('请输入文件名', defaultName);
    if (!nextName || !nextName.trim()) {
      return;
    }
    try {
      const saveAsResult = await fileEditor.commands.execute('file.saveAs', { name: nextName.trim() });
      const nextFileId = typeof saveAsResult === 'string' ? saveAsResult : nextName.trim();
      setFileStatus(`已保存: ${nextFileId}`);
      await refreshStoredFiles();
    } catch (error) {
      setFileStatus(`另存失败: ${getErrorMessage(error)}`);
    }
  }, [fileEditor, refreshStoredFiles]);

  const handleSaveAsFile = useCallback(async () => {
    await requestSaveAs();
  }, [requestSaveAs]);

  const handleSaveFile = useCallback(async () => {
    if (!activeFileId) {
      await requestSaveAs();
      return;
    }
    try {
      await fileEditor.commands.execute('file.saveSchema');
      setFileStatus(`已保存: ${activeFileId}`);
      await refreshStoredFiles();
    } catch (error) {
      setFileStatus(`保存失败: ${getErrorMessage(error)}`);
    }
  }, [activeFileId, fileEditor, refreshStoredFiles, requestSaveAs]);

  useEffect(() => {
    syncModeToUrl(appMode);
  }, [appMode]);

  useEffect(() => () => {
    fileEditor.destroy();
  }, [fileEditor]);

  useEffect(() => {
    setShellSnapshot(fileEditor.state.getSnapshot());
    const unsubscribe = fileEditor.state.subscribe((snapshot) => {
      setShellSnapshot(snapshot);
    });
    return unsubscribe;
  }, [fileEditor]);

  useEffect(() => {
    void refreshStoredFiles();
  }, [refreshStoredFiles]);

  useEffect(() => {
    const offSaved = fileEditor.eventBus.on('file:saved', ({ fileId }) => {
      setFileStatus(`已保存: ${fileId}`);
    });
    const offOpened = fileEditor.eventBus.on('file:opened', ({ fileId }) => {
      setFileStatus(`已打开: ${fileId}`);
    });
    return () => {
      offSaved();
      offOpened();
    };
  }, [fileEditor]);

  const treeNodes = useMemo(() => buildEditorTree(activeSchema), [activeSchema]);

  useEffect(() => {
    if (appMode === 'shell') {
      const currentSelected = shellSnapshot.selectedNodeId;
      if (currentSelected && getSchemaNodeByTreeId(activeSchema, currentSelected)) {
        return;
      }
      const nextDefault = getDefaultSelectedNodeId(treeNodes);
      if (nextDefault !== currentSelected) {
        fileEditor.state.setSelectedNodeId(nextDefault);
      }
      return;
    }
    setScenarioSelectedNodeId((prev) => {
      if (prev && getSchemaNodeByTreeId(activeSchema, prev)) {
        return prev;
      }
      return getDefaultSelectedNodeId(treeNodes);
    });
  }, [activeSchema, appMode, fileEditor, shellSnapshot.selectedNodeId, treeNodes]);

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
      tabs.push(createFilesSidebarTab({
        files: storedFiles,
        activeFileId,
        status: fileStatus,
        onOpenFile: (fileId) => {
          void handleOpenFile(fileId);
        },
        onSaveFile: () => {
          void handleSaveFile();
        },
        onSaveAsFile: () => {
          void handleSaveAsFile();
        },
        onRefresh: () => {
          void refreshStoredFiles();
        },
      }));
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

  const executeShellNodeCommand = useCallback(
    (commandId: string, args: Record<string, unknown>) => {
      void fileEditor.commands.execute(commandId, args).catch((error) => {
        antd.message.error(`节点更新失败: ${getErrorMessage(error)}`);
      });
    },
    [fileEditor],
  );

  const handleUndo = useCallback(() => {
    if (appMode !== 'shell' || !canUndo) {
      return;
    }
    void fileEditor.commands.execute('editor.undo').catch((error) => {
      antd.message.error(`撤销失败: ${getErrorMessage(error)}`);
    });
  }, [appMode, canUndo, fileEditor]);

  const handleRedo = useCallback(() => {
    if (appMode !== 'shell' || !canRedo) {
      return;
    }
    void fileEditor.commands.execute('editor.redo').catch((error) => {
      antd.message.error(`重做失败: ${getErrorMessage(error)}`);
    });
  }, [appMode, canRedo, fileEditor]);

  useEffect(() => {
    if (appMode !== 'shell') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const withPrimaryModifier = event.ctrlKey || event.metaKey;
      if (!withPrimaryModifier || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        void handleSaveFile();
        return;
      }

      if (isEditableHotkeyTarget(event.target)) {
        return;
      }

      if (key === 'z' && !event.shiftKey) {
        if (!canUndo) {
          return;
        }
        event.preventDefault();
        handleUndo();
        return;
      }

      if ((key === 'z' && event.shiftKey) || key === 'y') {
        if (!canRedo) {
          return;
        }
        event.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [appMode, canRedo, canUndo, handleRedo, handleSaveFile, handleUndo]);

  const handlePatchProps = (patch: Record<string, unknown>) => {
    if (appMode === 'shell') {
      if (!selectedNodeId) {
        return;
      }
      executeShellNodeCommand('node.patchProps', { treeId: selectedNodeId, patch });
      return;
    }
    updateActiveSchema((schema) => patchSchemaNodeProps(schema, selectedNodeId, patch));
  };

  const handlePatchEvents = (patch: Record<string, unknown>) => {
    if (appMode === 'shell') {
      if (!selectedNodeId) {
        return;
      }
      executeShellNodeCommand('node.patchEvents', { treeId: selectedNodeId, patch });
      return;
    }
    updateActiveSchema((schema) => patchSchemaNodeEvents(schema, selectedNodeId, patch));
  };

  const handlePatchColumns = (columns: unknown[]) => {
    if (appMode === 'shell') {
      if (!selectedNodeId) {
        return;
      }
      executeShellNodeCommand('node.patchColumns', { treeId: selectedNodeId, columns });
      return;
    }
    updateActiveSchema((schema) => patchSchemaNodeColumns(schema, selectedNodeId, columns));
  };

  const handlePatchStyle = (patch: Record<string, unknown>) => {
    if (appMode === 'shell') {
      if (!selectedNodeId) {
        return;
      }
      executeShellNodeCommand('node.patchStyle', { treeId: selectedNodeId, patch });
      return;
    }
    updateActiveSchema((schema) => patchSchemaNodeStyle(schema, selectedNodeId, patch));
  };

  const handlePatchLogic = (patch: Record<string, unknown>) => {
    if (appMode === 'shell') {
      if (!selectedNodeId) {
        return;
      }
      executeShellNodeCommand('node.patchLogic', { treeId: selectedNodeId, patch });
      return;
    }
    updateActiveSchema((schema) => patchSchemaNodeLogic(schema, selectedNodeId, patch));
  };

  const handleCanvasSelectNode = (schemaNodeId: string) => {
    const treeId = getTreeIdBySchemaNodeId(activeSchema, schemaNodeId);
    if (treeId) {
      if (appMode === 'shell') {
        fileEditor.state.setSelectedNodeId(treeId);
      } else {
        setScenarioSelectedNodeId(treeId);
      }
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
        onSelectNode: (nodeId) => {
          if (appMode === 'shell') {
            fileEditor.state.setSelectedNodeId(nodeId);
          } else {
            setScenarioSelectedNodeId(nodeId);
          }
        },
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
