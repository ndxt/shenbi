import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as antd from 'antd';
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
  const [shellSchema, setShellSchema] = useState<PageSchema>(() => createEmptyShellSchema());
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const activeSchema = appMode === 'shell' ? shellSchema : scenarioSchemas[activeScenario];

  useEffect(() => {
    syncModeToUrl(appMode);
  }, [appMode]);

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
      sidebarProps={{
        contracts: builtinContracts,
        treeNodes,
        onSelectNode: setSelectedNodeId,
        ...(selectedNodeId ? { selectedNodeId } : {}),
      }}
      inspectorProps={{
        onPatchProps: handlePatchProps,
        onPatchColumns: handlePatchColumns,
        onPatchStyle: handlePatchStyle,
        onPatchEvents: handlePatchEvents,
        onPatchLogic: handlePatchLogic,
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
        </div>
      )}
    >
      <ScenarioRuntimeView key={`${appMode}:${activeScenario}`} schema={activeSchema} />
    </AppShell>
  );
}
