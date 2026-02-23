import { useEffect, useMemo, useState } from 'react';
import * as antd from 'antd';
import type { PageSchema } from '@shenbi/schema';
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

const scenarioSchemaMap: Record<ScenarioKey, PageSchema> = {
  'user-management': userManagementSchema,
  'form-list': formListSkeletonSchema,
  'tabs-detail': tabsDetailSkeletonSchema,
  'tree-management': treeManagementSkeletonSchema,
  descriptions: descriptionsSkeletonSchema,
  'drawer-detail': drawerDetailSkeletonSchema,
  'nine-grid': nineGridSkeletonSchema,
};

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
  const activeSchema = scenarioSchemaMap[activeScenario];

  return (
    <AppShell
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
