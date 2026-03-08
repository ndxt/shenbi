import type { ZoneType } from '@shenbi/ai-agents';
import type { ComponentContract } from '@shenbi/schema';
import * as schemaContractsModule from '../../../../packages/schema/contracts/index.ts';

type ComponentGroupName =
  | 'layout-shell'
  | 'typography'
  | 'actions'
  | 'filters-form'
  | 'feedback-status'
  | 'data-display';

interface ComponentGroupDefinition {
  name: ComponentGroupName;
  description: string;
  components: string[];
}

interface CompiledComponentSummary {
  componentType: string;
  category: string;
  childrenType: string;
  propSummary: string[];
  eventSummary: string[];
}

interface CompiledComponentGroup {
  name: ComponentGroupName;
  description: string;
  components: string[];
  promptSummary: string;
}

const zoneGoldenExamples: Record<ZoneType, string> = {
  'page-header': '{"component":"Container","id":"page-header","props":{"direction":"column","gap":8},"children":[{"component":"Typography.Title","id":"page-title","props":{"level":2},"children":["用户列表"]},{"component":"Typography.Text","id":"page-desc","props":{"type":"secondary"},"children":["管理用户信息、角色与状态"]},{"component":"Space","id":"page-actions","props":{"size":"small"},"children":[{"component":"Button","id":"create-user","props":{"type":"primary"},"children":["新建用户"]}]}]}',
  filter: '{"component":"Card","id":"user-filter","props":{"size":"small","bordered":true},"children":[{"component":"Form","id":"filter-form","props":{"layout":"inline"},"children":[{"component":"FormItem","id":"filter-name","props":{"label":"姓名","name":"name"},"children":[{"component":"Input","id":"filter-name-input","props":{"placeholder":"请输入姓名"}}]},{"component":"FormItem","id":"filter-role","props":{"label":"角色","name":"role"},"children":[{"component":"Select","id":"filter-role-select","props":{"placeholder":"请选择角色"}}]},{"component":"FormItem","id":"filter-date","props":{"label":"日期","name":"date"},"children":[{"component":"DatePicker","id":"filter-date-picker","props":{}}]},{"component":"Space","id":"filter-actions","props":{"size":"small"},"children":[{"component":"Button","id":"submit","props":{"type":"primary"},"children":["查询"]},{"component":"Button","id":"reset","props":{},"children":["重置"]}]}]}]}',
  'kpi-row': '{"component":"Row","id":"attendance-kpis","props":{"gutter":[16,16]},"children":[{"component":"Col","id":"kpi-1-col","props":{"span":6},"children":[{"component":"Card","id":"kpi-1-card","props":{},"children":[{"component":"Statistic","id":"kpi-1","props":{"title":"今日出勤率","value":96}}]}]},{"component":"Col","id":"kpi-2-col","props":{"span":6},"children":[{"component":"Card","id":"kpi-2-card","props":{},"children":[{"component":"Statistic","id":"kpi-2","props":{"title":"迟到人数","value":12}}]}]}]}',
  'data-table': '{"component":"Card","id":"user-table-card","props":{"title":"用户列表"},"children":[{"component":"Table","id":"user-table","props":{"dataSource":[{"key":"1","name":"张三","role":"管理员","status":"启用"}],"pagination":{"pageSize":10}},"columns":[{"key":"name","dataIndex":"name","title":"姓名"},{"key":"role","dataIndex":"role","title":"角色"},{"key":"status","dataIndex":"status","title":"状态"}]}]}',
  'detail-info': '{"component":"Card","id":"employee-detail","props":{"title":"员工详情"},"children":[{"component":"Descriptions","id":"employee-descriptions","props":{"column":2},"children":[{"component":"Descriptions.Item","id":"detail-name","props":{"label":"姓名"},"children":["张三"]},{"component":"Descriptions.Item","id":"detail-dept","props":{"label":"部门"},"children":["技术部"]}]}]}',
  'form-body': '{"component":"Card","id":"employee-form-card","props":{"title":"员工信息"},"children":[{"component":"Form","id":"employee-form","props":{"layout":"vertical"},"children":[{"component":"FormItem","id":"employee-name","props":{"label":"姓名","name":"name"},"children":[{"component":"Input","id":"employee-name-input","props":{"placeholder":"请输入姓名"}}]},{"component":"FormItem","id":"employee-role","props":{"label":"角色","name":"role"},"children":[{"component":"Select","id":"employee-role-select","props":{"placeholder":"请选择角色"}}]}]}]}',
  'form-actions': '{"component":"Space","id":"form-actions","props":{"size":"small"},"children":[{"component":"Button","id":"save-btn","props":{"type":"primary"},"children":["保存"]},{"component":"Button","id":"cancel-btn","props":{},"children":["取消"]}]}',
  'chart-area': '{"component":"Card","id":"trend-summary-card","props":{"title":"趋势概览"},"children":[{"component":"Typography.Paragraph","id":"trend-summary-text","props":{},"children":["本周出勤趋势整体稳定，建议重点关注周一迟到高峰。"]},{"component":"Statistic","id":"trend-stat","props":{"title":"平均出勤率","value":94}}]}',
  'timeline-area': '{"component":"Card","id":"activity-timeline-card","props":{"title":"最近动态"},"children":[{"component":"Timeline","id":"activity-timeline","props":{},"children":[{"component":"Timeline.Item","id":"timeline-1","props":{},"children":["09:20 张三提交补卡申请"]},{"component":"Timeline.Item","id":"timeline-2","props":{},"children":["10:15 李四完成审批"]}]}]}',
  'side-info': '{"component":"Card","id":"side-info-card","props":{"title":"提示信息"},"children":[{"component":"Typography.Text","id":"side-info-text","props":{"type":"secondary"},"children":["可在此区域展示说明、统计补充或审批提醒。"]}]}',
  'empty-state': '{"component":"Card","id":"empty-state-card","props":{"title":"暂无数据"},"children":[{"component":"Alert","id":"empty-alert","props":{"type":"info","message":"当前条件下暂无记录","showIcon":true}}]}',
  custom: '{"component":"Card","id":"custom-block","props":{"title":"自定义模块"},"children":[{"component":"Typography.Paragraph","id":"custom-copy","props":{},"children":["请使用受支持组件构建清晰的后台业务区块。"]}]}',
};

const builtinContracts =
  (schemaContractsModule as { builtinContracts?: ComponentContract[] }).builtinContracts
  ?? (schemaContractsModule as { default?: { builtinContracts?: ComponentContract[] } }).default?.builtinContracts
  ?? [];

const builtinContractMap = Object.fromEntries(
  builtinContracts.map((contract) => [contract.componentType, contract]),
) as Record<string, ComponentContract>;

const componentGroupDefinitions: ComponentGroupDefinition[] = [
  {
    name: 'layout-shell',
    description: 'layout wrappers for page sections and grid composition',
    components: ['Container', 'Space', 'Row', 'Col'],
  },
  {
    name: 'typography',
    description: 'page headings, helper text, and content copy',
    components: ['Typography.Title', 'Typography.Text', 'Typography.Paragraph'],
  },
  {
    name: 'actions',
    description: 'primary and secondary action triggers',
    components: ['Button'],
  },
  {
    name: 'filters-form',
    description: 'query conditions and form controls for admin pages',
    components: ['Form', 'FormItem', 'Input', 'Select', 'DatePicker'],
  },
  {
    name: 'feedback-status',
    description: 'status emphasis, alerts, and labels',
    components: ['Alert', 'Tag'],
  },
  {
    name: 'data-display',
    description: 'cards, data views, detail blocks, tabs, and timelines',
    components: [
      'Card',
      'Statistic',
      'Table',
      'Descriptions',
      'Descriptions.Item',
      'Tabs',
      'Tabs.TabPane',
      'Timeline',
      'Timeline.Item',
    ],
  },
];

const zoneGroupMap: Record<ZoneType, ComponentGroupName[]> = {
  'page-header': ['layout-shell', 'typography', 'actions'],
  filter: ['data-display', 'filters-form', 'layout-shell', 'actions'],
  'kpi-row': ['layout-shell', 'data-display', 'feedback-status'],
  'data-table': ['data-display', 'actions', 'feedback-status'],
  'detail-info': ['data-display', 'typography', 'feedback-status'],
  'form-body': ['data-display', 'filters-form'],
  'form-actions': ['layout-shell', 'actions'],
  'chart-area': ['data-display', 'typography', 'feedback-status'],
  'timeline-area': ['data-display', 'typography'],
  'side-info': ['data-display', 'typography', 'feedback-status'],
  'empty-state': ['data-display', 'typography', 'actions'],
  custom: ['layout-shell', 'typography', 'actions', 'data-display'],
};

function summarizeContract(contract: ComponentContract): CompiledComponentSummary {
  const propSummary = Object.entries(contract.props ?? {})
    .slice(0, 4)
    .map(([name, prop]) => `${name}:${prop.type}`);
  const eventSummary = Object.keys(contract.events ?? {})
    .slice(0, 3)
    .map((name) => name);

  return {
    componentType: contract.componentType,
    category: contract.category ?? 'general',
    childrenType: contract.children?.type ?? 'none',
    propSummary,
    eventSummary,
  };
}

function compileComponentGroup(definition: ComponentGroupDefinition): CompiledComponentGroup {
  const components = definition.components.filter((componentType) => builtinContractMap[componentType]);
  const promptSummary = components
    .map((componentType) => {
      const summary = summarizeContract(builtinContractMap[componentType]!);
      const propPart = summary.propSummary.length > 0 ? `props=${summary.propSummary.join(', ')}` : 'props=minimal';
      const eventPart = summary.eventSummary.length > 0 ? `events=${summary.eventSummary.join(', ')}` : 'events=none';
      return `${summary.componentType} [${summary.category}] children=${summary.childrenType}; ${propPart}; ${eventPart}`;
    })
    .join('\n');

  return {
    name: definition.name,
    description: definition.description,
    components,
    promptSummary,
  };
}

const compiledGroups = componentGroupDefinitions.map(compileComponentGroup);
const compiledGroupMap = Object.fromEntries(compiledGroups.map((group) => [group.name, group])) as Record<ComponentGroupName, CompiledComponentGroup>;

function uniqueComponents(groups: readonly ComponentGroupName[]): string[] {
  return [...new Set(groups.flatMap((groupName) => compiledGroupMap[groupName].components))];
}

export const supportedComponents = uniqueComponents(componentGroupDefinitions.map((group) => group.name)) as string[];
export const supportedComponentList = supportedComponents.join(', ');
export const supportedComponentSet = new Set(supportedComponents);
export const supportedContracts = builtinContracts.filter((contract) => supportedComponentSet.has(contract.componentType));
export const componentGroups = compiledGroups;

export function getPlannerContractSummary(): string {
  return compiledGroups
    .map((group) => `Group ${group.name}: ${group.description}\n${group.promptSummary}`)
    .join('\n\n');
}

export function getZoneContractSummary(zoneType: ZoneType, preferredComponents: readonly string[] = []): string {
  const groups = zoneGroupMap[zoneType];
  const preferredSet = new Set(preferredComponents);
  const orderedComponents = uniqueComponents(groups).sort((left, right) => {
    const leftPreferred = preferredSet.has(left) ? 1 : 0;
    const rightPreferred = preferredSet.has(right) ? 1 : 0;
    return rightPreferred - leftPreferred;
  });

  return orderedComponents
    .map((componentType) => {
      const contract = builtinContractMap[componentType];
      if (!contract) {
        return null;
      }
      const summary = summarizeContract(contract);
      const props = summary.propSummary.length > 0 ? summary.propSummary.join(', ') : 'minimal props';
      const preferred = preferredSet.has(componentType) ? 'preferred' : 'allowed';
      return `${summary.componentType} (${preferred}, ${summary.category}, children=${summary.childrenType}, ${props})`;
    })
    .filter(Boolean)
    .join('\n');
}

export function getZoneComponentCandidates(zoneType: ZoneType): string[] {
  return uniqueComponents(zoneGroupMap[zoneType]);
}

export function getZoneGoldenExample(zoneType: ZoneType): string {
  return zoneGoldenExamples[zoneType];
}
