import { useEffect, useMemo, useState } from 'react';
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

import { AppShell } from './ui/AppShell';
import {
  buildEditorTree,
  getDefaultSelectedNodeId,
  getSchemaNodeByTreeId,
  getTreeIdBySchemaNodeId,
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

const scenarioOptions: { label: string; value: ScenarioKey }[] = [
  { label: '用户管理场景', value: 'user-management' },
  { label: 'Form.List', value: 'form-list' },
  { label: 'Tabs 详情', value: 'tabs-detail' },
  { label: 'Tree 管理', value: 'tree-management' },
  { label: 'Descriptions', value: 'descriptions' },
  { label: 'Drawer 详情', value: 'drawer-detail' },
  { label: '九宫格布局', value: 'nine-grid' },
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
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>('user-management');
  const [scenarioSchemas, setScenarioSchemas] = useState<Record<ScenarioKey, PageSchema>>(
    () => createInitialScenarioState(),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const activeSchema = scenarioSchemas[activeScenario];

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

  const handlePatchProps = (patch: Record<string, unknown>) => {
    setScenarioSchemas((prev) => ({
      ...prev,
      [activeScenario]: patchSchemaNodeProps(prev[activeScenario], selectedNodeId, patch),
    }));
  };

  const handlePatchEvents = (patch: Record<string, unknown>) => {
    setScenarioSchemas((prev) => ({
      ...prev,
      [activeScenario]: patchSchemaNodeEvents(prev[activeScenario], selectedNodeId, patch),
    }));
  };

  const handlePatchStyle = (patch: Record<string, unknown>) => {
    setScenarioSchemas((prev) => ({
      ...prev,
      [activeScenario]: patchSchemaNodeStyle(prev[activeScenario], selectedNodeId, patch),
    }));
  };

  const handlePatchLogic = (patch: Record<string, unknown>) => {
    setScenarioSchemas((prev) => ({
      ...prev,
      [activeScenario]: patchSchemaNodeLogic(prev[activeScenario], selectedNodeId, patch),
    }));
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
        onPatchStyle: handlePatchStyle,
        onPatchEvents: handlePatchEvents,
        onPatchLogic: handlePatchLogic,
        ...(selectedNode ? { selectedNode } : {}),
        ...(selectedContract ? { contract: selectedContract } : {}),
      }}
      onCanvasSelectNode={handleCanvasSelectNode}
      toolbarExtra={(
        <div className="flex items-center gap-2">
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
        </div>
      )}
    >
      <ScenarioRuntimeView key={activeScenario} schema={activeSchema} />
    </AppShell>
  );
}
