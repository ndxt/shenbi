import type { PageType, ZoneType } from '@shenbi/ai-agents';
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
  slotSummary: string[];
  parentHints: string[];
}

interface CompiledComponentGroup {
  name: ComponentGroupName;
  description: string;
  components: string[];
  promptSummary: string;
}

interface ZoneTemplate {
  zoneType: ZoneType;
  intent: string;
  layoutPattern: string;
  preferredGroups: ComponentGroupName[];
  preferredComponents: string[];
  maxDepth: number;
  maxChildrenPerArray: number;
  skeleton: string;
  wrapper?: {
    component: string;
    props?: Record<string, unknown>;
    useDescriptionAsTitle?: boolean;
  };
}

interface PageSkeleton {
  pageType: PageType;
  intent: string;
  layoutPattern: string;
  recommendedZones: ZoneType[];
  optionalZones: ZoneType[];
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

const pageSkeletons: Record<PageType, PageSkeleton> = {
  dashboard: {
    pageType: 'dashboard',
    intent: '仪表盘类页面，先展示概况，再展示趋势和主数据',
    layoutPattern: 'page-header -> kpi-row -> chart-area -> data-table -> timeline-area',
    recommendedZones: ['page-header', 'kpi-row', 'chart-area', 'data-table'],
    optionalZones: ['timeline-area', 'side-info'],
  },
  list: {
    pageType: 'list',
    intent: '列表管理类页面，重点是筛选、表格和分页相关区域',
    layoutPattern: 'page-header -> filter -> data-table',
    recommendedZones: ['page-header', 'filter', 'data-table'],
    optionalZones: ['side-info', 'empty-state'],
  },
  form: {
    pageType: 'form',
    intent: '表单录入或编辑页面，重点是表单主体和提交操作',
    layoutPattern: 'page-header -> form-body -> form-actions',
    recommendedZones: ['page-header', 'form-body', 'form-actions'],
    optionalZones: ['side-info', 'timeline-area'],
  },
  detail: {
    pageType: 'detail',
    intent: '详情展示页面，重点是键值信息和关联记录',
    layoutPattern: 'page-header -> detail-info -> data-table|timeline-area',
    recommendedZones: ['page-header', 'detail-info'],
    optionalZones: ['data-table', 'timeline-area', 'side-info'],
  },
  statistics: {
    pageType: 'statistics',
    intent: '统计分析页面，重点是指标概览、趋势和对比数据',
    layoutPattern: 'page-header -> kpi-row -> chart-area -> data-table',
    recommendedZones: ['page-header', 'kpi-row', 'chart-area'],
    optionalZones: ['data-table', 'side-info', 'timeline-area'],
  },
  custom: {
    pageType: 'custom',
    intent: '自由布局页面，不强制固定区域顺序',
    layoutPattern: 'custom',
    recommendedZones: ['page-header', 'custom'],
    optionalZones: ['filter', 'kpi-row', 'data-table', 'detail-info', 'form-body', 'form-actions', 'chart-area', 'timeline-area', 'side-info', 'empty-state'],
  },
};

const zoneTemplates: Record<ZoneType, ZoneTemplate> = {
  'page-header': {
    zoneType: 'page-header',
    intent: '页面标题、说明信息和主要操作按钮区域',
    layoutPattern: 'title-first, helper-text second, actions last; favor vertical composition with a trailing action row',
    preferredGroups: ['layout-shell', 'typography', 'actions'],
    preferredComponents: ['Container', 'Typography.Title', 'Typography.Text', 'Space', 'Button'],
    maxDepth: 3,
    maxChildrenPerArray: 4,
    skeleton: '{"component":"Container","id":"__ZONE_ID__","props":{"direction":"column","gap":8},"children":[{"component":"Typography.Title","id":"__TITLE_ID__","props":{"level":2},"children":["__TITLE__"]},{"component":"Typography.Text","id":"__DESC_ID__","props":{"type":"secondary"},"children":["__DESC__"]},{"component":"Space","id":"__ACTION_ID__","props":{"size":"small"},"children":[{"component":"Button","id":"__PRIMARY_ACTION__","props":{"type":"primary"},"children":["__PRIMARY_ACTION_TEXT__"]}]}]}',
  },
  filter: {
    zoneType: 'filter',
    intent: '搜索、筛选、时间范围和查询操作区域',
    layoutPattern: 'compact card wrapper, inline or vertical form, action buttons aligned at the end',
    preferredGroups: ['data-display', 'filters-form', 'layout-shell', 'actions'],
    preferredComponents: ['Card', 'Form', 'FormItem', 'Input', 'Select', 'DatePicker', 'Space', 'Button'],
    maxDepth: 4,
    maxChildrenPerArray: 6,
    skeleton: '{"component":"Card","id":"__ZONE_ID__","props":{"size":"small","bordered":true},"children":[{"component":"Form","id":"__FORM_ID__","props":{"layout":"inline"},"children":[{"component":"FormItem","id":"__FIELD_ID__","props":{"label":"关键词","name":"keyword"},"children":[{"component":"Input","id":"__INPUT_ID__","props":{"placeholder":"请输入关键词"}}]},{"component":"Space","id":"__ACTION_ID__","props":{"size":"small"},"children":[{"component":"Button","id":"__QUERY_ID__","props":{"type":"primary"},"children":["查询"]},{"component":"Button","id":"__RESET_ID__","props":{},"children":["重置"]}]}]}]}',
    wrapper: {
      component: 'Card',
      props: {
        bordered: true,
        size: 'small',
      },
    },
  },
  'kpi-row': {
    zoneType: 'kpi-row',
    intent: '展示关键业务指标，通常为 3-4 张统计卡片',
    layoutPattern: '24-grid row with 3-4 equal columns, each column contains one concise KPI card',
    preferredGroups: ['layout-shell', 'data-display', 'feedback-status'],
    preferredComponents: ['Row', 'Col', 'Card', 'Statistic', 'Tag'],
    maxDepth: 4,
    maxChildrenPerArray: 4,
    skeleton: '{"component":"Row","id":"__ZONE_ID__","props":{"gutter":[16,16]},"children":[{"component":"Col","id":"__COL_1__","props":{"span":6},"children":[{"component":"Card","id":"__CARD_1__","props":{},"children":[{"component":"Statistic","id":"__STAT_1__","props":{"title":"__METRIC_TITLE__","value":96}}]}]}]}',
  },
  'data-table': {
    zoneType: 'data-table',
    intent: '主数据列表区域，包含标题、表格和可能的操作说明',
    layoutPattern: 'card wrapper with clear title, optional helper text, one primary table',
    preferredGroups: ['data-display', 'actions', 'feedback-status'],
    preferredComponents: ['Card', 'Table', 'Tag', 'Button'],
    maxDepth: 3,
    maxChildrenPerArray: 5,
    skeleton: '{"component":"Card","id":"__ZONE_ID__","props":{"title":"__TITLE__"},"children":[{"component":"Table","id":"__TABLE_ID__","props":{"dataSource":[{"key":"1","name":"张三","status":"启用"}],"pagination":{"pageSize":10}},"columns":[{"key":"name","dataIndex":"name","title":"姓名"},{"key":"status","dataIndex":"status","title":"状态"}]}]}',
    wrapper: {
      component: 'Card',
      props: {
        bordered: true,
      },
      useDescriptionAsTitle: true,
    },
  },
  'detail-info': {
    zoneType: 'detail-info',
    intent: '键值对详情信息展示区域',
    layoutPattern: 'card wrapper containing Descriptions grouped into concise sections, avoid deeply nested decorations',
    preferredGroups: ['data-display', 'typography', 'feedback-status'],
    preferredComponents: ['Card', 'Descriptions', 'Descriptions.Item', 'Tag', 'Typography.Text'],
    maxDepth: 4,
    maxChildrenPerArray: 6,
    skeleton: '{"component":"Card","id":"__ZONE_ID__","props":{"title":"__TITLE__"},"children":[{"component":"Descriptions","id":"__DESCRIPTIONS_ID__","props":{"column":2},"children":[{"component":"Descriptions.Item","id":"__ITEM_1__","props":{"label":"姓名"},"children":["张三"]},{"component":"Descriptions.Item","id":"__ITEM_2__","props":{"label":"部门"},"children":["技术部"]}]}]}',
    wrapper: {
      component: 'Card',
      props: {
        bordered: true,
      },
      useDescriptionAsTitle: true,
    },
  },
  'form-body': {
    zoneType: 'form-body',
    intent: '表单主体区域，负责录入和编辑业务数据',
    layoutPattern: 'card wrapper + vertical form + grouped fields, each FormItem contains exactly one input-like child',
    preferredGroups: ['data-display', 'filters-form'],
    preferredComponents: ['Card', 'Form', 'FormItem', 'Input', 'Select', 'DatePicker'],
    maxDepth: 4,
    maxChildrenPerArray: 6,
    skeleton: '{"component":"Card","id":"__ZONE_ID__","props":{"title":"__TITLE__"},"children":[{"component":"Form","id":"__FORM_ID__","props":{"layout":"vertical"},"children":[{"component":"FormItem","id":"__FIELD_1__","props":{"label":"姓名","name":"name"},"children":[{"component":"Input","id":"__INPUT_1__","props":{"placeholder":"请输入姓名"}}]},{"component":"FormItem","id":"__FIELD_2__","props":{"label":"部门","name":"department"},"children":[{"component":"Select","id":"__SELECT_1__","props":{"placeholder":"请选择部门"}}]}]}]}',
    wrapper: {
      component: 'Card',
      props: {
        bordered: true,
      },
      useDescriptionAsTitle: true,
    },
  },
  'form-actions': {
    zoneType: 'form-actions',
    intent: '表单提交、取消、暂存等操作区域',
    layoutPattern: 'single horizontal action row with one primary button and one secondary button',
    preferredGroups: ['layout-shell', 'actions'],
    preferredComponents: ['Space', 'Button'],
    maxDepth: 2,
    maxChildrenPerArray: 4,
    skeleton: '{"component":"Space","id":"__ZONE_ID__","props":{"size":"small"},"children":[{"component":"Button","id":"__PRIMARY_ACTION__","props":{"type":"primary"},"children":["保存"]},{"component":"Button","id":"__SECONDARY_ACTION__","props":{},"children":["取消"]}]}',
  },
  'chart-area': {
    zoneType: 'chart-area',
    intent: '趋势、分布或图表替代的统计概览区域',
    layoutPattern: 'card wrapper with one concise heading, one narrative paragraph, and 1-2 supporting stats',
    preferredGroups: ['data-display', 'typography', 'feedback-status'],
    preferredComponents: ['Card', 'Typography.Title', 'Typography.Paragraph', 'Statistic', 'Tag'],
    maxDepth: 3,
    maxChildrenPerArray: 5,
    skeleton: '{"component":"Card","id":"__ZONE_ID__","props":{"title":"__TITLE__"},"children":[{"component":"Typography.Paragraph","id":"__SUMMARY_ID__","props":{},"children":["本周出勤趋势整体稳定。"]},{"component":"Statistic","id":"__STAT_ID__","props":{"title":"平均出勤率","value":94}}]}',
    wrapper: {
      component: 'Card',
      props: {
        bordered: true,
      },
      useDescriptionAsTitle: true,
    },
  },
  'timeline-area': {
    zoneType: 'timeline-area',
    intent: '操作日志、审批流程或近期动态时间线',
    layoutPattern: 'card wrapper with one vertical timeline and short text-only items',
    preferredGroups: ['data-display', 'typography'],
    preferredComponents: ['Card', 'Timeline', 'Timeline.Item', 'Typography.Text'],
    maxDepth: 3,
    maxChildrenPerArray: 6,
    skeleton: '{"component":"Card","id":"__ZONE_ID__","props":{"title":"__TITLE__"},"children":[{"component":"Timeline","id":"__TIMELINE_ID__","props":{},"children":[{"component":"Timeline.Item","id":"__ITEM_1__","props":{},"children":["09:20 张三提交补卡申请"]},{"component":"Timeline.Item","id":"__ITEM_2__","props":{},"children":["10:15 李四完成审批"]}]}]}',
    wrapper: {
      component: 'Card',
      props: {
        bordered: true,
      },
      useDescriptionAsTitle: true,
    },
  },
  'side-info': {
    zoneType: 'side-info',
    intent: '补充提示、摘要说明、辅助统计',
    layoutPattern: 'compact side card with short helper text or secondary stats',
    preferredGroups: ['data-display', 'typography', 'feedback-status'],
    preferredComponents: ['Card', 'Typography.Text', 'Descriptions', 'Tag'],
    maxDepth: 3,
    maxChildrenPerArray: 4,
    skeleton: '{"component":"Card","id":"__ZONE_ID__","props":{"title":"__TITLE__"},"children":[{"component":"Typography.Text","id":"__TEXT_ID__","props":{"type":"secondary"},"children":["请在此展示补充说明、审批提醒或状态提示。"]}]}',
    wrapper: {
      component: 'Card',
      props: {
        bordered: true,
      },
      useDescriptionAsTitle: true,
    },
  },
  'empty-state': {
    zoneType: 'empty-state',
    intent: '空数据、无结果、待初始化状态提示',
    layoutPattern: 'single calm feedback card with concise message and optional action',
    preferredGroups: ['data-display', 'typography', 'actions'],
    preferredComponents: ['Card', 'Alert', 'Button', 'Typography.Text'],
    maxDepth: 3,
    maxChildrenPerArray: 3,
    skeleton: '{"component":"Card","id":"__ZONE_ID__","props":{"title":"暂无数据"},"children":[{"component":"Alert","id":"__ALERT_ID__","props":{"type":"info","message":"当前条件下暂无记录","showIcon":true}}]}',
    wrapper: {
      component: 'Card',
      props: {
        bordered: true,
      },
    },
  },
  custom: {
    zoneType: 'custom',
    intent: '自由组合区块，仍需遵守后台页面的层级和留白规范',
    layoutPattern: 'prefer one clear card/container with one primary purpose instead of many mixed fragments',
    preferredGroups: ['layout-shell', 'typography', 'actions', 'data-display'],
    preferredComponents: ['Card', 'Container', 'Typography.Paragraph', 'Button'],
    maxDepth: 3,
    maxChildrenPerArray: 4,
    skeleton: '{"component":"Card","id":"__ZONE_ID__","props":{"title":"自定义模块"},"children":[{"component":"Typography.Paragraph","id":"__TEXT_ID__","props":{},"children":["请使用受支持组件构建清晰的后台业务区块。"]}]}',
    wrapper: {
      component: 'Card',
      props: {
        bordered: true,
      },
      useDescriptionAsTitle: true,
    },
  },
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
    .filter(([, prop]) => !prop.deprecated)
    .slice(0, 6)
    .map(([name, prop]) => {
      const required = prop.required ? '!' : '';
      const enumHint = Array.isArray(prop.enum) && prop.enum.length > 0
        ? `=${prop.enum.slice(0, 3).join('|')}`
        : '';
      return `${name}:${prop.type}${required}${enumHint}`;
    });
  const eventSummary = Object.keys(contract.events ?? {})
    .slice(0, 3)
    .map((name) => name);
  const slotSummary = Object.entries(contract.slots ?? {})
    .slice(0, 3)
    .map(([name, slot]) => `${name}${slot.multiple ? '[]' : ''}`);
  const parentHints: string[] = [];
  if (contract.componentType === 'Form') {
    parentHints.push('children prefer FormItem');
  }
  if (contract.componentType === 'FormItem') {
    parentHints.push('parent Form; child one input-like node');
  }
  if (contract.componentType === 'Descriptions') {
    parentHints.push('children prefer Descriptions.Item');
  }
  if (contract.componentType === 'Descriptions.Item') {
    parentHints.push('parent Descriptions');
  }
  if (contract.componentType === 'Tabs') {
    parentHints.push('children prefer Tabs.TabPane');
  }
  if (contract.componentType === 'Tabs.TabPane') {
    parentHints.push('parent Tabs');
  }
  if (contract.componentType === 'Timeline') {
    parentHints.push('children prefer Timeline.Item');
  }
  if (contract.componentType === 'Timeline.Item') {
    parentHints.push('parent Timeline');
  }
  if (contract.componentType === 'Table') {
    parentHints.push('use columns at schema root or props.columns; render callbacks not allowed');
  }

  return {
    componentType: contract.componentType,
    category: contract.category ?? 'general',
    childrenType: contract.children?.type ?? 'none',
    propSummary,
    eventSummary,
    slotSummary,
    parentHints,
  };
}

function compileComponentGroup(definition: ComponentGroupDefinition): CompiledComponentGroup {
  const components = definition.components.filter((componentType) => builtinContractMap[componentType]);
  const promptSummary = components
    .map((componentType) => {
      const summary = summarizeContract(builtinContractMap[componentType]!);
      const propPart = summary.propSummary.length > 0 ? `props=${summary.propSummary.join(', ')}` : 'props=minimal';
      const eventPart = summary.eventSummary.length > 0 ? `events=${summary.eventSummary.join(', ')}` : 'events=none';
      const slotPart = summary.slotSummary.length > 0 ? `slots=${summary.slotSummary.join(', ')}` : 'slots=none';
      const hintPart = summary.parentHints.length > 0 ? `hints=${summary.parentHints.join('; ')}` : 'hints=general';
      return `${summary.componentType} [${summary.category}] children=${summary.childrenType}; ${propPart}; ${eventPart}; ${slotPart}; ${hintPart}`;
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
export const compiledZoneTemplates = zoneTemplates;
export const compiledPageSkeletons = pageSkeletons;

export function getPlannerContractSummary(): string {
  return compiledGroups
    .map((group) => `Group ${group.name}: ${group.description}\n${group.promptSummary}`)
    .join('\n\n');
}

export function getPlannerZoneTemplateSummary(): string {
  return Object.values(zoneTemplates)
    .map((template) => {
      const components = template.preferredComponents.join(', ');
      return `${template.zoneType}: ${template.intent}; layout=${template.layoutPattern}; groups=${template.preferredGroups.join(', ')}; prefer=${components}; maxDepth=${template.maxDepth}; maxChildren=${template.maxChildrenPerArray}`;
    })
    .join('\n');
}

export function getPageSkeleton(pageType: PageType): PageSkeleton {
  return pageSkeletons[pageType];
}

export function getPageSkeletonSummary(pageType: PageType): string {
  const skeleton = pageSkeletons[pageType];
  return [
    `pageType: ${skeleton.pageType}`,
    `intent: ${skeleton.intent}`,
    `layoutPattern: ${skeleton.layoutPattern}`,
    `recommendedZones: ${skeleton.recommendedZones.join(', ')}`,
    `optionalZones: ${skeleton.optionalZones.join(', ')}`,
  ].join('\n');
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
      const slots = summary.slotSummary.length > 0 ? `; slots=${summary.slotSummary.join(', ')}` : '';
      const hints = summary.parentHints.length > 0 ? `; hints=${summary.parentHints.join('; ')}` : '';
      const preferred = preferredSet.has(componentType) ? 'preferred' : 'allowed';
      return `${summary.componentType} (${preferred}, ${summary.category}, children=${summary.childrenType}, ${props}${slots}${hints})`;
    })
    .filter(Boolean)
    .join('\n');
}

export function getZoneLevel2ComponentBrief(zoneType: ZoneType, preferredComponents: readonly string[] = []): string {
  const template = zoneTemplates[zoneType];
  const groups = zoneGroupMap[zoneType];
  const preferredSet = new Set(preferredComponents);
  const ordered = uniqueComponents(groups)
    .sort((left, right) => {
      const leftPreferred = preferredSet.has(left) ? 1 : 0;
      const rightPreferred = preferredSet.has(right) ? 1 : 0;
      return rightPreferred - leftPreferred;
    })
    .slice(0, Math.max(template.preferredComponents.length + 2, 8));

  return ordered
    .map((componentType) => {
      const contract = builtinContractMap[componentType];
      if (!contract) {
        return null;
      }
      const summary = summarizeContract(contract);
      const props = summary.propSummary.length > 0 ? summary.propSummary.join(', ') : 'none';
      const slots = summary.slotSummary.length > 0 ? summary.slotSummary.join(', ') : 'none';
      const hints = summary.parentHints.length > 0 ? summary.parentHints.join('; ') : 'none';
      return [
        `- ${summary.componentType}`,
        `  category: ${summary.category}`,
        `  children: ${summary.childrenType}`,
        `  props: ${props}`,
        `  slots: ${slots}`,
        `  hints: ${hints}`,
      ].join('\n');
    })
    .filter(Boolean)
    .join('\n');
}

export function getZoneGenerationParameters(zoneType: ZoneType): string {
  const template = zoneTemplates[zoneType];
  return [
    `root should usually be one of: ${template.preferredComponents.slice(0, 3).join(', ')}`,
    `maxDepth=${template.maxDepth}`,
    `maxChildrenPerArray=${template.maxChildrenPerArray}`,
    `layoutPattern=${template.layoutPattern}`,
  ].join('\n');
}

export function getZoneComponentCandidates(zoneType: ZoneType): string[] {
  return uniqueComponents(zoneGroupMap[zoneType]);
}

export function getZoneGoldenExample(zoneType: ZoneType): string {
  return zoneGoldenExamples[zoneType];
}

export function getZoneTemplate(zoneType: ZoneType): ZoneTemplate {
  return zoneTemplates[zoneType];
}

export function getZoneTemplateSummary(zoneType: ZoneType): string {
  const template = zoneTemplates[zoneType];
  return [
    `intent: ${template.intent}`,
    `layoutPattern: ${template.layoutPattern}`,
    `preferredGroups: ${template.preferredGroups.join(', ')}`,
    `preferredComponents: ${template.preferredComponents.join(', ')}`,
    `maxDepth: ${template.maxDepth}`,
    `maxChildrenPerArray: ${template.maxChildrenPerArray}`,
    `skeleton: ${template.skeleton}`,
  ].join('\n');
}
