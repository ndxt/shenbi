import type { PageType } from './types';
import type { ComponentContract } from '../../schema/types/contract';
const schemaTypesModuleUrl = new URL('../../schema/types/index.ts', import.meta.url).href;
const { builtinContracts } = await import(schemaTypesModuleUrl) as {
  builtinContracts: ComponentContract[];
};

type ComponentGroupName =
  | 'layout-shell'
  | 'typography'
  | 'actions'
  | 'filters-form'
  | 'feedback-status'
  | 'data-display'
  | 'navigation'
  | 'advanced-form'
  | 'extended-feedback'
  | 'identity'
  | 'disclosure'
  | 'charts';

interface FreeLayoutPattern {
  id: string;
  appliesTo: PageType[];
  title: string;
  intent: string;
  composition: string;
  guidance: string[];
  example: string;
}

interface ComponentGroupDefinition {
  name: ComponentGroupName;
  description: string;
  components: string[];
}

interface ComponentIndexEntry {
  componentType: string;
  category: string;
  groups: ComponentGroupName[];
  childrenType: string;
  parentComponent?: string | undefined;
  childComponents: string[];
  isComposite: boolean;
}

interface CompiledLevel0Catalog {
  byComponent: Record<string, ComponentIndexEntry>;
  byCategory: Record<string, string[]>;
  byGroup: Record<ComponentGroupName, string[]>;
}

interface CompiledComponentSummary {
  componentType: string;
  category: string;
  childrenType: string;
  propSummary: string[];
  eventSummary: string[];
  slotSummary: string[];
  parentHints: string[];
  usageScenario?: string | undefined;
}

interface CompiledComponentGroup {
  name: ComponentGroupName;
  description: string;
  components: string[];
  promptSummary: string;
}

interface CompiledLevel1GroupSummary extends CompiledComponentGroup {
  typicalZones: LegacyZoneType[];
  parentChildPatterns: string[];
}

interface CompiledLevel2ComponentBrief extends CompiledComponentSummary {
  groups: ComponentGroupName[];
  parentComponent?: string | undefined;
  childComponents: string[];
  miniSkeleton?: string | undefined;
  itemsWarning?: string | undefined;
  schemaContract: string;
}

interface ZoneTemplate {
  zoneType: LegacyZoneType;
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
  recommendedZones: LegacyZoneType[];
  optionalZones: LegacyZoneType[];
}

type LegacyZoneType =
  | 'page-header'
  | 'filter'
  | 'kpi-row'
  | 'data-table'
  | 'detail-info'
  | 'form-body'
  | 'form-actions'
  | 'chart-area'
  | 'timeline-area'
  | 'side-info'
  | 'empty-state'
  | 'custom';

// Legacy zone references are retained only as background design material for
// planner/group summaries. They are no longer part of the runtime main path.
const legacyZoneGoldenExamples: Record<LegacyZoneType, string> = {
  'page-header': '{"component":"Container","id":"page-header","props":{"direction":"column","gap":8},"children":[{"component":"Typography.Title","id":"page-title","props":{"level":2},"children":["用户列表"]},{"component":"Typography.Text","id":"page-desc","props":{"type":"secondary"},"children":["管理用户信息、角色与状态"]},{"component":"Space","id":"page-actions","props":{"size":"small"},"children":[{"component":"Button","id":"create-user","props":{"type":"primary"},"children":["新建用户"]}]}]}',
  filter: '{"component":"Card","id":"user-filter","props":{"size":"small","bordered":true},"children":[{"component":"Form","id":"filter-form","props":{"layout":"vertical"},"children":[{"component":"Row","id":"filter-row","props":{"gutter":[16,16],"align":"bottom"},"children":[{"component":"Col","id":"filter-keyword-col","props":{"span":5},"children":[{"component":"Form.Item","id":"filter-keyword","props":{"label":"关键词","name":"keyword"},"children":[{"component":"Input","id":"filter-keyword-input","props":{"placeholder":"请输入关键词"}}]}]},{"component":"Col","id":"filter-role-col","props":{"span":5},"children":[{"component":"Form.Item","id":"filter-role","props":{"label":"状态","name":"status"},"children":[{"component":"Select","id":"filter-role-select","props":{"placeholder":"请选择状态"}}]}]},{"component":"Col","id":"filter-date-col","props":{"span":8},"children":[{"component":"Form.Item","id":"filter-date","props":{"label":"日期范围","name":"date"},"children":[{"component":"DatePicker.RangePicker","id":"filter-date-picker","props":{"placeholder":["开始日期","结束日期"],"style":{"width":"100%"}}}]}]},{"component":"Col","id":"filter-actions-col","props":{"span":6},"children":[{"component":"Container","id":"filter-actions-wrap","props":{"direction":"row","justify":"end","style":{"paddingTop":"30px"}},"children":[{"component":"Space","id":"filter-actions","props":{"size":"small"},"children":[{"component":"Button","id":"submit","props":{"type":"primary"},"children":["查询"]},{"component":"Button","id":"reset","props":{},"children":["重置"]},{"component":"Button","id":"export","props":{"type":"dashed"},"children":["导出"]}]}]}]}]}]}]}',
  'kpi-row': '{"component":"Row","id":"attendance-kpis","props":{"gutter":[16,16]},"children":[{"component":"Col","id":"kpi-1-col","props":{"span":6},"children":[{"component":"Card","id":"kpi-1-card","props":{},"children":[{"component":"Statistic","id":"kpi-1","props":{"title":"今日出勤率","value":96}},{"component":"Typography.Text","id":"kpi-1-note","props":{"type":"secondary"},"children":["较昨日 +1.2%"]}]}]},{"component":"Col","id":"kpi-2-col","props":{"span":6},"children":[{"component":"Card","id":"kpi-2-card","props":{},"children":[{"component":"Statistic","id":"kpi-2","props":{"title":"迟到人数","value":12}},{"component":"Typography.Text","id":"kpi-2-note","props":{"type":"secondary"},"children":["需重点关注"]}]}]}]}',
  'data-table': '{"component":"Card","id":"user-table-card","props":{"title":"用户列表"},"children":[{"component":"Table","id":"user-table","props":{"dataSource":[{"key":"1","name":"张三","role":"管理员","status":"启用"}],"pagination":{"pageSize":10}},"columns":[{"key":"name","dataIndex":"name","title":"姓名"},{"key":"role","dataIndex":"role","title":"角色"},{"key":"status","dataIndex":"status","title":"状态"}]}]}',
  'detail-info': '{"component":"Card","id":"employee-detail","props":{"title":"员工详情"},"children":[{"component":"Descriptions","id":"employee-descriptions","props":{"column":2},"children":[{"component":"Descriptions.Item","id":"detail-name","props":{"label":"姓名"},"children":["张三"]},{"component":"Descriptions.Item","id":"detail-dept","props":{"label":"部门"},"children":["技术部"]}]}]}',
  'form-body': '{"component":"Card","id":"employee-form-card","props":{"title":"员工信息"},"children":[{"component":"Form","id":"employee-form","props":{"layout":"vertical"},"children":[{"component":"Form.Item","id":"employee-name","props":{"label":"姓名","name":"name"},"children":[{"component":"Input","id":"employee-name-input","props":{"placeholder":"请输入姓名"}}]},{"component":"Form.Item","id":"employee-role","props":{"label":"角色","name":"role"},"children":[{"component":"Select","id":"employee-role-select","props":{"placeholder":"请选择角色"}}]}]}]}',
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
    layoutPattern: 'page-header -> filter -> kpi-row -> (chart-area|data-table) + side-info',
    recommendedZones: ['page-header', 'filter', 'kpi-row', 'chart-area', 'data-table'],
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

const designPolicy = [
  'Build polished B-end admin pages with clear information hierarchy, steady alignment, and moderate whitespace.',
  'Prefer one primary content focus per zone; avoid mixing table, form, timeline, and detail semantics into one block.',
  'Use Row, Col, Space, Flex, and Divider to organize rhythm and spacing instead of deeply nesting Containers.',
  'Make action placement predictable: primary actions near the title or at the end of filters/forms; secondary actions nearby but visually quieter.',
  'Use cards to group related business information, but do not wrap every tiny element in a card.',
  'Favor concise Chinese business copy and short labels. Titles should be strong, descriptions should be short, and supporting text should be secondary.',
  'For free layouts, prefer asymmetric but balanced compositions such as main content + side info, summary cards above details, or left text + right data.',
  'For master-detail pages, prefer a 7/17 or 8/16 split: compact master navigation/list on the left, richer detail tabs/body on the right.',
  'In narrow left side panels, do not use Button type="text" as a multi-line card wrapper. Use compact Containers/Cards for selectable master items instead.',
  'For dashboard pages, prefer header full-width, filter full-width, KPI full-width, then a 16/8 or 18/6 main-content + side-info row.',
  'For dashboard and list filter regions, default to one horizontal search bar with at most 3 fields in the same row plus a right-aligned tail action area.',
  'If a RangePicker appears, give it a wider column inside the same row. Do not switch the whole filter block to a vertical stacked layout just because a date range exists.',
  'Use vertical/two-row filter layouts only for advanced search, more than 3 fields, or genuinely narrow widths.',
  'Filter action buttons should be a separate tail action area, not an empty-label Form.Item mixed into the same line of fields.',
  'For KPI regions, keep a single row of at most 4 cards. Each card should use a consistent structure: title + main value + one secondary line.',
  'Do not mix progress-only cards, tag-only cards, and verbose text cards in the same KPI row.',
  'Inside one tab pane, keep at most one Alert, one short description, and one main data area. Avoid a wall of many tiny cards.',
].join('\n');

const freeLayoutPatterns: FreeLayoutPattern[] = [
  {
    id: 'main-with-side-info',
    appliesTo: ['dashboard', 'detail', 'custom'],
    title: '主区 + 侧信息',
    intent: '让页面保持明显主次关系，主区承载关键内容，侧区承载补充说明、提醒或简要统计。',
    composition: 'Use Row with two Col children. Main column span 16-18, side column span 6-8. Main column contains one or two larger cards. Side column contains one compact card or descriptions block.',
    guidance: [
      'Keep the main column visually heavier and the side column concise.',
      'Avoid placing large tables in the side column.',
      'Use Typography.Text or Descriptions for side notes instead of repeating another table.',
    ],
    example: '{"component":"Row","id":"layout-main-side","props":{"gutter":[16,16]},"children":[{"component":"Col","id":"layout-main","props":{"span":17},"children":[{"component":"Card","id":"main-card","props":{"title":"核心内容"},"children":[{"component":"Typography.Paragraph","id":"main-copy","props":{},"children":["主区展示列表、详情或表单主体。"]}]}]},{"component":"Col","id":"layout-side","props":{"span":7},"children":[{"component":"Card","id":"side-card","props":{"title":"补充信息"},"children":[{"component":"Typography.Text","id":"side-copy","props":{"type":"secondary"},"children":["侧区用于说明、提醒或状态补充。"]}]}]}]}',
  },
  {
    id: 'summary-then-detail',
    appliesTo: ['dashboard', 'statistics', 'list', 'custom'],
    title: '摘要卡片 + 明细主体',
    intent: '先快速传达全局状态，再进入更重的业务明细。',
    composition: 'Top area uses Row/Col or Flex for 3-4 compact summary cards. Lower area uses one large Card for table, timeline, or detailed analysis.',
    guidance: [
      'Summary cards should be compact and data-forward.',
      'The lower detail card should occupy most of the width.',
      'Use one clear gap rhythm between top summaries and lower detail area.',
    ],
    example: '{"component":"Container","id":"layout-summary-detail","props":{"direction":"column","gap":16},"children":[{"component":"Row","id":"summary-row","props":{"gutter":[16,16]},"children":[{"component":"Col","id":"summary-col-1","props":{"span":8},"children":[{"component":"Card","id":"summary-card-1","props":{},"children":[{"component":"Statistic","id":"summary-stat-1","props":{"title":"待处理事项","value":12}}]}]},{"component":"Col","id":"summary-col-2","props":{"span":8},"children":[{"component":"Card","id":"summary-card-2","props":{},"children":[{"component":"Statistic","id":"summary-stat-2","props":{"title":"今日完成","value":48}}]}]}]},{"component":"Card","id":"detail-card","props":{"title":"明细数据"},"children":[{"component":"Typography.Paragraph","id":"detail-desc","props":{},"children":["下方区域展示主要业务明细，例如列表、趋势或时间线。"]}]}]}',
  },
  {
    id: 'split-context-and-data',
    appliesTo: ['detail', 'form', 'custom'],
    title: '左文右数 / 左表右文',
    intent: '让页面既有业务说明，也有结构化数据，适合详情页、运营页和混合页面。',
    composition: 'Use a two-column row. One side emphasizes Typography/Descriptions/Form, the other side emphasizes Table, Timeline, or KPI Cards.',
    guidance: [
      'One side should carry explanation or structure, the other should carry denser data.',
      'Do not mirror identical card density on both sides.',
      'Use Divider only when you need a subtle sectional split, not as the main layout tool.',
    ],
    example: '{"component":"Row","id":"layout-split-context-data","props":{"gutter":[16,16]},"children":[{"component":"Col","id":"context-col","props":{"span":10},"children":[{"component":"Card","id":"context-card","props":{"title":"业务说明"},"children":[{"component":"Typography.Title","id":"context-title","props":{"level":4},"children":["页面背景"]},{"component":"Typography.Paragraph","id":"context-copy","props":{},"children":["左侧展示说明、详情或表单上下文。"]}]}]},{"component":"Col","id":"data-col","props":{"span":14},"children":[{"component":"Card","id":"data-card","props":{"title":"结构化数据"},"children":[{"component":"Table","id":"data-table","props":{"dataSource":[{"key":"1","name":"张三","status":"正常"}],"pagination":{"pageSize":5}},"columns":[{"key":"name","dataIndex":"name","title":"姓名"},{"key":"status","dataIndex":"status","title":"状态"}]}]}]}]}',
  },
  {
    id: 'master-detail-split',
    appliesTo: ['detail', 'custom'],
    title: '主从导航 + 详情 Tabs',
    intent: '适合左侧主列表、右侧详情区的管理页面，保持左紧右松的主从关系。',
    composition: 'Use a two-column Row. Left column span 7-8 for a compact master list/card stack. Right column span 16-17 for Tabs, Descriptions, Form, or timeline content.',
    guidance: [
      'Left-side master items should stay compact: one title line, one status/meta line, and one short description line.',
      'Do not use multiline text Buttons as list-card wrappers in the left column.',
      'Keep the right column visually dominant with detail tabs, descriptions, forms, or timeline content.',
    ],
    example: '{"component":"Row","id":"layout-master-detail","props":{"gutter":[16,16]},"children":[{"component":"Col","id":"master-col","props":{"span":8},"children":[{"component":"Card","id":"master-list-card","props":{"title":"主数据列表","size":"small"},"children":[{"component":"Container","id":"master-list","props":{"direction":"column","gap":8},"children":[{"component":"Container","id":"master-item-1","props":{"direction":"column","gap":4},"children":[{"component":"Typography.Text","id":"master-title-1","props":{"strong":true},"children":["产品管理模块"]},{"component":"Space","id":"master-meta-1","props":{"size":"small"},"children":[{"component":"Tag","id":"master-tag-1","props":{"color":"green"},"children":["启用"]},{"component":"Tag","id":"master-tag-2","props":{"color":"blue"},"children":["已同步"]}]},{"component":"Typography.Text","id":"master-desc-1","props":{"type":"secondary"},"children":["短描述信息，帮助区分当前主项。"]}]}]}]}]},{"component":"Col","id":"detail-col","props":{"span":16},"children":[{"component":"Tabs","id":"detail-tabs","props":{"defaultActiveKey":"basic"},"children":[{"component":"Tabs.TabPane","id":"detail-tab-basic","props":{"label":"基本信息","key":"basic"},"children":[{"component":"Card","id":"detail-info-card","props":{"title":"详细信息"},"children":[{"component":"Descriptions","id":"detail-info","props":{"column":2},"children":[{"component":"Descriptions.Item","id":"detail-code","props":{"label":"编码"},"children":["PRD-2023-001"]},{"component":"Descriptions.Item","id":"detail-name","props":{"label":"名称"},"children":["产品管理模块"]}]}]}]}]}]}]}',
  },
];

const legacyZoneTemplates: Record<LegacyZoneType, ZoneTemplate> = {
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
    layoutPattern: 'compact card wrapper, horizontal search bar using Row/Col, max three fields in one row, wider date column, right-aligned tail action area',
    preferredGroups: ['data-display', 'filters-form', 'layout-shell', 'actions'],
    preferredComponents: ['Card', 'Form', 'Form.Item', 'Input', 'Select', 'DatePicker', 'DatePicker.RangePicker', 'Space', 'Button'],
    maxDepth: 4,
    maxChildrenPerArray: 6,
    skeleton: '{"component":"Card","id":"__ZONE_ID__","props":{"size":"small","bordered":true},"children":[{"component":"Form","id":"__FORM_ID__","props":{"layout":"vertical"},"children":[{"component":"Row","id":"__FILTER_ROW__","props":{"gutter":[16,16],"align":"bottom"},"children":[{"component":"Col","id":"__KEYWORD_COL__","props":{"span":5},"children":[{"component":"Form.Item","id":"__FIELD_ID__","props":{"label":"关键词","name":"keyword"},"children":[{"component":"Input","id":"__INPUT_ID__","props":{"placeholder":"请输入关键词"}}]}]},{"component":"Col","id":"__STATUS_COL__","props":{"span":5},"children":[{"component":"Form.Item","id":"__STATUS_ID__","props":{"label":"状态","name":"status"},"children":[{"component":"Select","id":"__STATUS_SELECT__","props":{"placeholder":"请选择状态"}}]}]},{"component":"Col","id":"__DATE_COL__","props":{"span":8},"children":[{"component":"Form.Item","id":"__DATE_ID__","props":{"label":"日期范围","name":"dateRange"},"children":[{"component":"DatePicker.RangePicker","id":"__RANGE_ID__","props":{"placeholder":["开始日期","结束日期"],"style":{"width":"100%"}}}]}]},{"component":"Col","id":"__ACTION_COL__","props":{"span":6},"children":[{"component":"Container","id":"__ACTION_WRAP__","props":{"direction":"row","justify":"end","style":{"paddingTop":"30px"}},"children":[{"component":"Space","id":"__ACTION_ID__","props":{"size":"small"},"children":[{"component":"Button","id":"__QUERY_ID__","props":{"type":"primary"},"children":["查询"]},{"component":"Button","id":"__RESET_ID__","props":{},"children":["重置"]},{"component":"Button","id":"__EXPORT_ID__","props":{"type":"dashed"},"children":["导出"]}]}]}]}]}]}]}',
    wrapper: {
      component: 'Card',
      props: {
        variant: 'outlined',
        size: 'small',
      },
    },
  },
  'kpi-row': {
    zoneType: 'kpi-row',
    intent: '展示关键业务指标，通常为 3-4 张统计卡片',
    layoutPattern: '24-grid row with at most 4 equal columns, each column contains one KPI card with title, main value, and one secondary line',
    preferredGroups: ['layout-shell', 'data-display', 'feedback-status'],
    preferredComponents: ['Row', 'Col', 'Card', 'Statistic', 'Typography.Text'],
    maxDepth: 4,
    maxChildrenPerArray: 4,
    skeleton: '{"component":"Row","id":"__ZONE_ID__","props":{"gutter":[16,16]},"children":[{"component":"Col","id":"__COL_1__","props":{"span":6},"children":[{"component":"Card","id":"__CARD_1__","props":{},"children":[{"component":"Statistic","id":"__STAT_1__","props":{"title":"__METRIC_TITLE__","value":96}},{"component":"Typography.Text","id":"__NOTE_1__","props":{"type":"secondary"},"children":["较昨日 +2.5%"]}]}]}]}',
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
        variant: 'outlined',
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
        variant: 'outlined',
      },
      useDescriptionAsTitle: true,
    },
  },
  'form-body': {
    zoneType: 'form-body',
    intent: '表单主体区域，负责录入和编辑业务数据',
    layoutPattern: 'card wrapper + vertical form + grouped fields, each Form.Item contains exactly one input-like child',
    preferredGroups: ['data-display', 'filters-form'],
    preferredComponents: ['Card', 'Form', 'Form.Item', 'Input', 'Select', 'DatePicker', 'DatePicker.RangePicker', 'Drawer'],
    maxDepth: 4,
    maxChildrenPerArray: 6,
    skeleton: '{"component":"Card","id":"__ZONE_ID__","props":{"title":"__TITLE__"},"children":[{"component":"Form","id":"__FORM_ID__","props":{"layout":"vertical"},"children":[{"component":"Form.Item","id":"__FIELD_1__","props":{"label":"姓名","name":"name"},"children":[{"component":"Input","id":"__INPUT_1__","props":{"placeholder":"请输入姓名"}}]},{"component":"Form.Item","id":"__FIELD_2__","props":{"label":"部门","name":"department"},"children":[{"component":"Select","id":"__SELECT_1__","props":{"placeholder":"请选择部门"}}]}]}]}',
    wrapper: {
      component: 'Card',
      props: {
        variant: 'outlined',
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
    intent: '统计图表展示区域，优先使用 Chart.* 系列图表组件展示趋势、对比、占比等数据',
    layoutPattern: 'card wrapper with one chart component or optionally a Statistic fallback if no chart is appropriate',
    preferredGroups: ['charts', 'data-display', 'typography', 'feedback-status'],
    preferredComponents: ['Chart.Line', 'Chart.Column', 'Chart.Pie', 'Chart.Area', 'Chart.Bar', 'Chart.Gauge', 'Card', 'Statistic', 'Typography.Paragraph'],
    maxDepth: 3,
    maxChildrenPerArray: 3,
    skeleton: '{"component":"Card","id":"__ZONE_ID__","props":{"title":"__TITLE__"},"children":[{"component":"Chart.Line","id":"__CHART_ID__","props":{"data":[{"month":"1月","value":350},{"month":"2月","value":420},{"month":"3月","value":390}],"xField":"month","yField":"value","height":280,"autoFit":true}}]}',
    wrapper: {
      component: 'Card',
      props: {
        variant: 'outlined',
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
        variant: 'outlined',
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
        variant: 'outlined',
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
        variant: 'outlined',
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
    // custom zones manage their own layout structure (Row/Col etc.),
    // no outer Card wrapper needed.
  },
};

const builtinContractMap = Object.fromEntries(
  builtinContracts.map((contract) => [contract.componentType, contract]),
) as Record<string, ComponentContract>;

const runtimeComponentGroupDefinitions: ComponentGroupDefinition[] = [
  {
    name: 'layout-shell',
    description: 'layout wrappers for page sections and grid composition',
    components: ['Container', 'Space', 'Row', 'Col', 'Flex', 'Divider'],
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
    components: ['Form', 'Form.Item', 'Input', 'Select', 'DatePicker', 'DatePicker.RangePicker'],
  },
  {
    name: 'feedback-status',
    description: 'status emphasis, alerts, and labels',
    components: ['Alert', 'Tag', 'Progress', 'Badge', 'Badge.Ribbon', 'Empty', 'Result'],
  },
  {
    name: 'data-display',
    description: 'cards, data views, detail blocks, tabs, and timelines',
    components: [
      'Avatar',
      'Avatar.Group',
      'Card',
      'Empty',
      'Statistic',
      'Table',
      'Drawer',
      'Descriptions',
      'Descriptions.Item',
      'Tabs',
      'Tabs.TabPane',
      'Timeline',
      'Timeline.Item',
    ],
  },
  {
    name: 'navigation',
    description: 'navigation, paging, and progress indication components',
    components: ['Breadcrumb', 'Pagination', 'Steps'],
  },
  {
    name: 'charts',
    description: 'Ant Design Charts statistical chart components for data visualization',
    components: ['Chart.Line', 'Chart.Column', 'Chart.Bar', 'Chart.Area', 'Chart.Pie', 'Chart.Gauge'],
  },
];

const knowledgeComponentGroupDefinitions: ComponentGroupDefinition[] = [
  ...runtimeComponentGroupDefinitions,
  {
    name: 'navigation',
    description: 'navigation, paging, and progress indication components',
    components: ['Anchor', 'Breadcrumb', 'Pagination', 'Steps', 'Menu'],
  },
  {
    name: 'advanced-form',
    description: 'advanced data-entry and selection controls',
    components: [
      'AutoComplete',
      'Cascader',
      'Checkbox',
      'Checkbox.Group',
      'ColorPicker',
      'InputNumber',
      'Mentions',
      'Radio',
      'Radio.Group',
      'Rate',
      'Slider',
      'Switch',
      'TimePicker',
    ],
  },
  {
    name: 'extended-feedback',
    description: 'extended status and progress display components',
    components: [
      'Alert',
      'Badge',
      'Badge.Ribbon',
      'Empty',
      'Popconfirm',
      'Popover',
      'Progress',
      'Result',
      'Skeleton',
      'Skeleton.Button',
      'Skeleton.Image',
      'Skeleton.Input',
      'Spin',
      'Tag',
      'Tooltip',
    ],
  },
  {
    name: 'identity',
    description: 'identity and lightweight persona display components',
    components: ['Avatar', 'Avatar.Group'],
  },
  {
    name: 'disclosure',
    description: 'expand/collapse structured content sections',
    components: ['Collapse', 'Collapse.Panel'],
  },
  {
    name: 'charts',
    description: 'Ant Design Charts statistical chart components for data visualization',
    components: ['Chart.Line', 'Chart.Column', 'Chart.Bar', 'Chart.Area', 'Chart.Pie', 'Chart.Gauge'],
  },
];

const legacyZoneGroupMap: Record<LegacyZoneType, ComponentGroupName[]> = {
  'page-header': ['layout-shell', 'typography', 'actions', 'navigation'],
  filter: ['data-display', 'filters-form', 'layout-shell', 'actions'],
  'kpi-row': ['layout-shell', 'data-display', 'feedback-status'],
  'data-table': ['data-display', 'actions', 'feedback-status', 'navigation'],
  'detail-info': ['data-display', 'typography', 'feedback-status', 'navigation'],
  'form-body': ['data-display', 'filters-form'],
  'form-actions': ['layout-shell', 'actions'],
  'chart-area': ['data-display', 'typography', 'feedback-status', 'charts'],
  'timeline-area': ['data-display', 'typography'],
  'side-info': ['data-display', 'typography', 'feedback-status'],
  'empty-state': ['data-display', 'typography', 'actions', 'feedback-status'],
  custom: ['layout-shell', 'typography', 'actions', 'data-display'],
};

const legacyKnowledgeZoneGroupMap: Record<LegacyZoneType, ComponentGroupName[]> = {
  'page-header': ['layout-shell', 'typography', 'actions', 'navigation', 'identity'],
  filter: ['data-display', 'filters-form', 'advanced-form', 'layout-shell', 'actions'],
  'kpi-row': ['layout-shell', 'data-display', 'feedback-status', 'extended-feedback'],
  'data-table': ['data-display', 'actions', 'feedback-status', 'navigation', 'extended-feedback'],
  'detail-info': ['data-display', 'typography', 'feedback-status', 'identity', 'disclosure'],
  'form-body': ['data-display', 'filters-form', 'advanced-form', 'extended-feedback'],
  'form-actions': ['layout-shell', 'actions'],
  'chart-area': ['data-display', 'typography', 'feedback-status', 'extended-feedback', 'charts'],
  'timeline-area': ['data-display', 'typography', 'extended-feedback'],
  'side-info': ['data-display', 'typography', 'feedback-status', 'identity', 'extended-feedback'],
  'empty-state': ['data-display', 'typography', 'actions', 'extended-feedback'],
  custom: [
    'layout-shell',
    'typography',
    'actions',
    'data-display',
    'navigation',
    'advanced-form',
    'extended-feedback',
    'identity',
    'disclosure',
  ],
};

function summarizeContract(contract: ComponentContract): CompiledComponentSummary {
  const propSummary = Object.entries(contract.props ?? {})
    .filter(([, prop]) => !prop.deprecated)
    .slice(0, 12)
    .map(([name, prop]) => formatContractProp(name, prop));
  const eventSummary = Object.keys(contract.events ?? {})
    .slice(0, 3)
    .map((name) => name);
  const slotSummary = Object.entries(contract.slots ?? {})
    .slice(0, 3)
    .map(([name, slot]) => `${name}${slot.multiple ? '[]' : ''}`);
  const parentHints: string[] = [];
  if (contract.componentType === 'Form') {
    parentHints.push('children prefer Form.Item');
  }
  if (contract.componentType === 'Form.Item') {
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
    usageScenario: contract.usageScenario,
  };
}

function collectComponentGroups(
  componentType: string,
  definitions: readonly ComponentGroupDefinition[],
): ComponentGroupName[] {
  return definitions
    .filter((group) => group.components.includes(componentType))
    .map((group) => group.name);
}

function getParentComponentHint(componentType: string): string | undefined {
  if (componentType === 'Form.Item') return 'Form';
  if (componentType === 'Descriptions.Item') return 'Descriptions';
  if (componentType === 'Tabs.TabPane') return 'Tabs';
  if (componentType === 'Timeline.Item') return 'Timeline';
  if (componentType === 'Collapse.Panel') return 'Collapse';
  return undefined;
}

function getChildComponentHints(componentType: string): string[] {
  if (componentType === 'Form') return ['Form.Item'];
  if (componentType === 'Descriptions') return ['Descriptions.Item'];
  if (componentType === 'Tabs') return ['Tabs.TabPane'];
  if (componentType === 'Timeline') return ['Timeline.Item'];
  if (componentType === 'Collapse') return ['Collapse.Panel'];
  return [];
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
      const usePart = summary.usageScenario ? `; use=${summary.usageScenario}` : '';
      return `${summary.componentType} [${summary.category}] children=${summary.childrenType}; ${propPart}; ${eventPart}; ${slotPart}; ${hintPart}${usePart}`;
    })
    .join('\n');

  return {
    name: definition.name,
    description: definition.description,
    components,
    promptSummary,
  };
}

const runtimeCompiledGroups = runtimeComponentGroupDefinitions.map(compileComponentGroup);
const runtimeCompiledGroupMap = Object.fromEntries(runtimeCompiledGroups.map((group) => [group.name, group])) as Record<ComponentGroupName, CompiledComponentGroup>;
const knowledgeCompiledGroups = knowledgeComponentGroupDefinitions.map(compileComponentGroup);

function uniqueComponents(
  groups: readonly ComponentGroupName[],
  groupMap: Record<ComponentGroupName, CompiledComponentGroup>,
): string[] {
  return [...new Set(groups.flatMap((groupName) => groupMap[groupName]?.components ?? []))];
}

export const supportedComponents = uniqueComponents(
  runtimeComponentGroupDefinitions.map((group) => group.name),
  runtimeCompiledGroupMap,
) as string[];
export const supportedComponentList = supportedComponents.join(', ');
export const supportedComponentSet = new Set(supportedComponents);
export const supportedContracts = builtinContracts.filter((contract) => supportedComponentSet.has(contract.componentType));
export const componentGroups = runtimeCompiledGroups;
export const knowledgeComponentGroups = knowledgeCompiledGroups;
export const knowledgeSupportedComponents = uniqueComponents(
  knowledgeComponentGroupDefinitions.map((group) => group.name),
  Object.fromEntries(knowledgeCompiledGroups.map((group) => [group.name, group])) as Record<ComponentGroupName, CompiledComponentGroup>,
) as string[];
export const compiledPageSkeletons = pageSkeletons;
export const compiledFreeLayoutPatterns = freeLayoutPatterns;

export function getDesignPolicySummary(): string {
  return designPolicy;
}

export function getPlannerContractSummary(): string {
  return compiledLevel1Groups
    .map((group) => {
      const patterns = group.parentChildPatterns.length > 0
        ? `\npatterns=${group.parentChildPatterns.join('; ')}`
        : '';
      const zones = group.typicalZones.length > 0
        ? `\nzones=${group.typicalZones.join(', ')}`
        : '';
      return `Group ${group.name}: ${group.description}${zones}${patterns}\n${group.promptSummary}`;
    })
    .join('\n\n');
}

export function getKnowledgePlannerContractSummary(): string {
  return compiledKnowledgeLevel1Groups
    .map((group) => {
      const patterns = group.parentChildPatterns.length > 0
        ? `\npatterns=${group.parentChildPatterns.join('; ')}`
        : '';
      const zones = group.typicalZones.length > 0
        ? `\nzones=${group.typicalZones.join(', ')}`
        : '';
      return `Group ${group.name}: ${group.description}${zones}${patterns}\n${group.promptSummary}`;
    })
    .join('\n\n');
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

export function getFreeLayoutPatternSummary(pageType: PageType): string {
  return freeLayoutPatterns
    .filter((pattern) => pattern.appliesTo.includes(pageType) || pattern.appliesTo.includes('custom'))
    .map((pattern) => {
      const guidance = pattern.guidance.map((item) => `- ${item}`).join('\n');
      return [
        `${pattern.id}: ${pattern.title}`,
        `intent: ${pattern.intent}`,
        `composition: ${pattern.composition}`,
        `guidance:\n${guidance}`,
        `example: ${pattern.example}`,
      ].join('\n');
    })
    .join('\n\n');
}

function getLegacyZoneContractSummary(zoneType: LegacyZoneType, preferredComponents: readonly string[] = []): string {
  const groups = legacyZoneGroupMap[zoneType];
  const preferredSet = new Set(preferredComponents);
  const orderedComponents = uniqueComponents(groups, runtimeCompiledGroupMap).sort((left, right) => {
    const leftPreferred = preferredSet.has(left) ? 1 : 0;
    const rightPreferred = preferredSet.has(right) ? 1 : 0;
    return rightPreferred - leftPreferred;
  });

  return orderedComponents
    .map((componentType) => {
      const summary = compiledLevel2Briefs[componentType];
      if (!summary) {
        return null;
      }
      const props = summary.propSummary.length > 0 ? summary.propSummary.join(', ') : 'minimal props';
      const slots = summary.slotSummary.length > 0 ? `; slots=${summary.slotSummary.join(', ')}` : '';
      const hints = summary.parentHints.length > 0 ? `; hints=${summary.parentHints.join('; ')}` : '';
      const preferred = preferredSet.has(componentType) ? 'preferred' : 'allowed';
      return `${summary.componentType} (${preferred}, ${summary.category}, children=${summary.childrenType}, ${props}${slots}${hints})`;
    })
    .filter(Boolean)
    .join('\n');
}

function getKnowledgeLegacyZoneContractSummary(zoneType: LegacyZoneType, preferredComponents: readonly string[] = []): string {
  const groups = legacyKnowledgeZoneGroupMap[zoneType];
  const preferredSet = new Set(preferredComponents);
  const knowledgeCompiledGroupMap = Object.fromEntries(
    knowledgeCompiledGroups.map((group) => [group.name, group]),
  ) as Record<ComponentGroupName, CompiledComponentGroup>;
  const orderedComponents = uniqueComponents(groups, knowledgeCompiledGroupMap).sort((left, right) => {
    const leftPreferred = preferredSet.has(left) ? 1 : 0;
    const rightPreferred = preferredSet.has(right) ? 1 : 0;
    return rightPreferred - leftPreferred;
  });

  return orderedComponents
    .map((componentType) => {
      const summary = compiledKnowledgeLevel2Briefs[componentType];
      if (!summary) {
        return null;
      }
      const props = summary.propSummary.length > 0 ? summary.propSummary.join(', ') : 'minimal props';
      const slots = summary.slotSummary.length > 0 ? `; slots=${summary.slotSummary.join(', ')}` : '';
      const hints = summary.parentHints.length > 0 ? `; hints=${summary.parentHints.join('; ')}` : '';
      const preferred = preferredSet.has(componentType) ? 'preferred' : 'knowledge';
      return `${summary.componentType} (${preferred}, ${summary.category}, children=${summary.childrenType}, ${props}${slots}${hints})`;
    })
    .filter(Boolean)
    .join('\n');
}

function getLegacyZoneLevel2ComponentBrief(zoneType: LegacyZoneType, preferredComponents: readonly string[] = []): string {
  const template = legacyZoneTemplates[zoneType];
  const groups = legacyZoneGroupMap[zoneType];
  const preferredSet = new Set(preferredComponents);
  const ordered = uniqueComponents(groups, runtimeCompiledGroupMap)
    .sort((left, right) => {
      const leftPreferred = preferredSet.has(left) ? 1 : 0;
      const rightPreferred = preferredSet.has(right) ? 1 : 0;
      return rightPreferred - leftPreferred;
    })
    .slice(0, Math.max(template.preferredComponents.length + 2, 8));

  return ordered
    .map((componentType) => {
      const summary = compiledLevel2Briefs[componentType];
      if (!summary) {
        return null;
      }
      const props = summary.propSummary.length > 0 ? summary.propSummary.join(', ') : 'none';
      const slots = summary.slotSummary.length > 0 ? summary.slotSummary.join(', ') : 'none';
      const hints = summary.parentHints.length > 0 ? summary.parentHints.join('; ') : 'none';
      const groupsSummary = summary.groups.length > 0 ? summary.groups.join(', ') : 'none';
      return [
        `- ${summary.componentType}`,
        `  category: ${summary.category}`,
        `  groups: ${groupsSummary}`,
        `  children: ${summary.childrenType}`,
        `  props: ${props}`,
        `  slots: ${slots}`,
        `  hints: ${hints}`,
      ].join('\n');
    })
    .filter(Boolean)
    .join('\n');
}

function getKnowledgeLegacyZoneLevel2ComponentBrief(zoneType: LegacyZoneType, preferredComponents: readonly string[] = []): string {
  const template = legacyZoneTemplates[zoneType];
  const groups = legacyKnowledgeZoneGroupMap[zoneType];
  const preferredSet = new Set(preferredComponents);
  const knowledgeCompiledGroupMap = Object.fromEntries(
    knowledgeCompiledGroups.map((group) => [group.name, group]),
  ) as Record<ComponentGroupName, CompiledComponentGroup>;
  const ordered = uniqueComponents(groups, knowledgeCompiledGroupMap)
    .sort((left, right) => {
      const leftPreferred = preferredSet.has(left) ? 1 : 0;
      const rightPreferred = preferredSet.has(right) ? 1 : 0;
      return rightPreferred - leftPreferred;
    })
    .slice(0, Math.max(template.preferredComponents.length + 4, 12));

  return ordered
    .map((componentType) => {
      const summary = compiledKnowledgeLevel2Briefs[componentType];
      if (!summary) {
        return null;
      }
      const props = summary.propSummary.length > 0 ? summary.propSummary.join(', ') : 'none';
      const slots = summary.slotSummary.length > 0 ? summary.slotSummary.join(', ') : 'none';
      const hints = summary.parentHints.length > 0 ? summary.parentHints.join('; ') : 'none';
      const groupsSummary = summary.groups.length > 0 ? summary.groups.join(', ') : 'none';
      return [
        `- ${summary.componentType}`,
        `  category: ${summary.category}`,
        `  groups: ${groupsSummary}`,
        `  children: ${summary.childrenType}`,
        `  props: ${props}`,
        `  slots: ${slots}`,
        `  hints: ${hints}`,
      ].join('\n');
    })
    .filter(Boolean)
    .join('\n');
}

function getLegacyZoneGenerationParameters(zoneType: LegacyZoneType): string {
  const template = legacyZoneTemplates[zoneType];
  return [
    `root should usually be one of: ${template.preferredComponents.slice(0, 3).join(', ')}`,
    `maxDepth=${template.maxDepth}`,
    `maxChildrenPerArray=${template.maxChildrenPerArray}`,
    `layoutPattern=${template.layoutPattern}`,
  ].join('\n');
}

function getLegacyZoneComponentCandidates(zoneType: LegacyZoneType): string[] {
  return uniqueComponents(legacyZoneGroupMap[zoneType], runtimeCompiledGroupMap);
}

export function getZoneGoldenExample(zoneType: LegacyZoneType): string {
  return legacyZoneGoldenExamples[zoneType];
}

function getLegacyZoneTemplate(zoneType: LegacyZoneType): ZoneTemplate {
  return legacyZoneTemplates[zoneType];
}

function getLegacyZoneTemplateSummary(zoneType: LegacyZoneType): string {
  const template = legacyZoneTemplates[zoneType];
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

// ===== Per-Component Schema Contracts =====

/**
 * Mini-skeleton examples keyed by component type.
 * These show the LLM the EXACT JSON shape expected in our schema format,
 * eliminating ambiguity between Ant Design's native API and our schema convention.
 */
const componentMiniSkeletons: Record<string, string> = {
  // Layout
  Row: '{"component":"Row","id":"..","props":{"gutter":[16,16]},"children":[<Col children>]}',
  Col: '{"component":"Col","id":"..","props":{"span":12},"children":[<single child or Container with gap for multiple>]}',
  Container: '{"component":"Container","id":"..","props":{"direction":"column","gap":16},"children":[...]}',
  Space: '{"component":"Space","id":"..","props":{"size":"middle"},"children":[...]}',
  Flex: '{"component":"Flex","id":"..","props":{"gap":16,"justify":"space-between"},"children":[...]}',
  Divider: '{"component":"Divider","id":"..","props":{"type":"horizontal"}}',

  // Typography
  'Typography.Title': '{"component":"Typography.Title","id":"..","props":{"level":2},"children":["标题文字"]}',
  'Typography.Text': '{"component":"Typography.Text","id":"..","props":{"type":"secondary"},"children":["正文文字"]}',
  'Typography.Paragraph': '{"component":"Typography.Paragraph","id":"..","props":{},"children":["段落内容"]}',

  // Actions
  Button: '{"component":"Button","id":"..","props":{"type":"primary"},"children":["按钮文字"]}',

  // Data Display
  Avatar: '{"component":"Avatar","id":"..","props":{"shape":"circle","size":"default"},"children":"李"}',
  'Avatar.Group': '{"component":"Avatar.Group","id":"..","props":{"size":"default"},"children":[{"component":"Avatar","id":"..","children":"李"},{"component":"Avatar","id":"..","children":"王"}]}',
  Card: '{"component":"Card","id":"..","props":{"title":"卡片标题"},"children":[...]}',
  Empty: '{"component":"Empty","id":"..","props":{"description":"暂无数据"},"children":[{"component":"Button","id":"..","props":{"type":"primary"},"children":["立即创建"]}]}',
  Statistic: '{"component":"Statistic","id":"..","props":{"title":"指标名","value":42}}',
  Table: '{"component":"Table","id":"..","props":{"dataSource":[{"key":"1","name":"张三"}],"pagination":{"pageSize":10}},"columns":[{"title":"姓名","dataIndex":"name","key":"name"}]}',
  Pagination: '{"component":"Pagination","id":"..","props":{"current":1,"pageSize":10,"total":120,"showSizeChanger":true}}',
  Breadcrumb: '{"component":"Breadcrumb","id":"..","props":{"items":[{"title":"员工管理"},{"title":"员工详情"}]}}',
  Steps: '{"component":"Steps","id":"..","props":{"current":1,"items":[{"title":"提交申请","description":"员工发起申请"},{"title":"主管审批","description":"等待审批"},{"title":"处理完成","description":"流程完成"}]}}',
  Badge: '{"component":"Badge","id":"..","props":{"status":"processing","text":"审批中"},"children":[{"component":"Typography.Text","id":"..","children":"订单状态"}]}',
  'Badge.Ribbon': '{"component":"Badge.Ribbon","id":"..","props":{"text":"重点","placement":"end"},"children":[{"component":"Card","id":"..","props":{"title":"卡片标题"},"children":[{"component":"Typography.Text","id":"..","children":"缎带卡片内容"}]}]}',

  // Descriptions: use children with Descriptions.Item, NOT props.items
  Descriptions: '{"component":"Descriptions","id":"..","props":{"column":2},"children":[{"component":"Descriptions.Item","id":"..","props":{"label":"字段名"},"children":["字段值"]}]}',
  'Descriptions.Item': '{"component":"Descriptions.Item","id":"..","props":{"label":"字段名"},"children":["字段值"]}',

  // Timeline: use children with Timeline.Item, NOT props.items
  Timeline: '{"component":"Timeline","id":"..","props":{},"children":[{"component":"Timeline.Item","id":"..","props":{},"children":["09:20 事件描述"]}]}',
  'Timeline.Item': '{"component":"Timeline.Item","id":"..","props":{},"children":["事件描述文本"]}',

  // Tabs: use children with Tabs.TabPane, NOT props.items
  Tabs: '{"component":"Tabs","id":"..","props":{},"children":[{"component":"Tabs.TabPane","id":"..","props":{"tab":"标签名","key":"tab1"},"children":[...]}]}',
  'Tabs.TabPane': '{"component":"Tabs.TabPane","id":"..","props":{"tab":"标签名","key":"tab1"},"children":[...]}',

  // Form
  Form: '{"component":"Form","id":"..","props":{"layout":"vertical"},"children":[<Form.Item children>]}',
  'Form.Item': '{"component":"Form.Item","id":"..","props":{"label":"字段名","name":"fieldName"},"children":[<one input child>]}',
  Input: '{"component":"Input","id":"..","props":{"placeholder":"请输入"}}',
  Select: '{"component":"Select","id":"..","props":{"placeholder":"请选择"}}',
  DatePicker: '{"component":"DatePicker","id":"..","props":{}}',
  'DatePicker.RangePicker': '{"component":"DatePicker.RangePicker","id":"..","props":{"allowClear":true}}',
  Drawer: '{"component":"Drawer","id":"..","props":{"title":"详情信息","open":true,"placement":"right","width":420},"children":[...]}',

  // Feedback
  Alert: '{"component":"Alert","id":"..","props":{"type":"info","message":"提示信息","showIcon":true}}',
  Tag: '{"component":"Tag","id":"..","props":{"color":"blue"},"children":["标签"]}',
  Progress: '{"component":"Progress","id":"..","props":{"percent":68,"status":"active","showInfo":true}}',
  Result: '{"component":"Result","id":"..","props":{"status":"success","title":"操作成功","subTitle":"任务已完成","extra":{"component":"Button","id":"..","props":{"type":"primary"},"children":["返回列表"]}}}',

  // Charts (Ant Design Charts)
  'Chart.Line': '{"component":"Chart.Line","id":"..","props":{"data":[{"month":"1月","value":350},{"month":"2月","value":420},{"month":"3月","value":390},{"month":"4月","value":510},{"month":"5月","value":480}],"xField":"month","yField":"value","height":280,"autoFit":true}}',
  'Chart.Column': '{"component":"Chart.Column","id":"..","props":{"data":[{"category":"产品A","sales":350},{"category":"产品B","sales":420},{"category":"产品C","sales":290}],"xField":"category","yField":"sales","height":280,"autoFit":true}}',
  'Chart.Bar': '{"component":"Chart.Bar","id":"..","props":{"data":[{"name":"销售部","value":350},{"name":"技术部","value":280},{"name":"运营部","value":420}],"xField":"value","yField":"name","height":280,"autoFit":true}}',
  'Chart.Area': '{"component":"Chart.Area","id":"..","props":{"data":[{"month":"1月","value":350},{"month":"2月","value":420},{"month":"3月","value":390}],"xField":"month","yField":"value","height":280,"autoFit":true}}',
  'Chart.Pie': '{"component":"Chart.Pie","id":"..","props":{"data":[{"type":"技术部","value":40},{"type":"销售部","value":30},{"type":"运营部","value":20},{"type":"人事部","value":10}],"angleField":"value","colorField":"type","height":280,"autoFit":true}}',
  'Chart.Gauge': '{"component":"Chart.Gauge","id":"..","props":{"data":{"target":75,"total":100},"height":240,"autoFit":true}}',
};

/**
 * Components that commonly confuse LLMs about children vs props.items structure.
 * For these, we add an explicit warning in the contract output.
 */
const childrenVsItemsWarnings: Record<string, string> = {
  Timeline: 'IMPORTANT: Use children Array with Timeline.Item nodes. Do NOT use props.items.',
  Descriptions: 'IMPORTANT: Use children Array with Descriptions.Item nodes. Do NOT use props.items.',
  Tabs: 'IMPORTANT: Use children Array with Tabs.TabPane nodes. Do NOT use props.items.',
  Breadcrumb: 'IMPORTANT: Use props.items with simple text titles. Do NOT use children nodes or itemRender functions.',
  Steps: 'IMPORTANT: Use props.items with plain title/description strings. Do NOT use children nodes.',
};

const baseComponents = ['Container', 'Card', 'Typography.Text'] as const;

const companionMap: Partial<Record<string, string[]>> = {
  Table: ['Tag', 'Button', 'Typography.Text', 'Pagination'],
  Statistic: ['Row', 'Col', 'Typography.Text'],
  Form: ['Form.Item', 'Input', 'Select', 'DatePicker', 'DatePicker.RangePicker', 'Button', 'Space'],
  Timeline: ['Typography.Text'],
  Descriptions: ['Tag', 'Typography.Text'],
  Tabs: ['Card'],
  Steps: ['Card', 'Typography.Text'],
  Progress: ['Card', 'Typography.Text'],
  Breadcrumb: ['Typography.Text', 'Button'],
  Result: ['Button', 'Typography.Text'],
  Empty: ['Button', 'Typography.Text'],
};

const functionPropExamples: Record<string, string> = {
  'Breadcrumb.itemRender': '{"type":"JSFunction","params":["currentRoute","params","items","paths"],"body":"return currentRoute?.title ?? \\"\\";"}',
  'Pagination.showTotal': '{"type":"JSFunction","params":["total","range"],"body":"return `共 ${total} 条`;"}',
  'Progress.format': '{"type":"JSFunction","params":["percent","successPercent"],"body":"return `${percent ?? 0}%`;"}',
  'Statistic.formatter': '{"type":"JSFunction","params":["value"],"body":"return `${value}`;"}',
  'Tabs.renderTabBar': '{"type":"JSFunction","params":["props","DefaultTabBar"],"body":"return DefaultTabBar(props);"}',
};

function formatContractProp(name: string, prop: { type: string; required?: boolean; enum?: unknown[] }): string {
  const required = prop.required ? '!' : '';
  const enumHint = Array.isArray(prop.enum) && prop.enum.length > 0
    ? `=${prop.enum.join('|')}`
    : '';
  const functionHint = prop.type === 'function'
    ? '(MUST use JSFunction JSON)'
    : '';
  return `${name}:${prop.type}${required}${enumHint}${functionHint}`;
}

function buildComponentIndex(
  contracts: readonly ComponentContract[],
  definitions: readonly ComponentGroupDefinition[],
): CompiledLevel0Catalog {
  const byComponent: Record<string, ComponentIndexEntry> = {};
  const byCategory: Record<string, string[]> = {};
  const byGroup = Object.fromEntries(
    definitions.map((group) => [group.name, [...group.components]]),
  ) as Record<ComponentGroupName, string[]>;

  contracts.forEach((contract) => {
    const category = contract.category ?? 'general';
    const groups = collectComponentGroups(contract.componentType, definitions);
    const childComponents = getChildComponentHints(contract.componentType);
    const parentComponent = getParentComponentHint(contract.componentType);
    const entry: ComponentIndexEntry = {
      componentType: contract.componentType,
      category,
      groups,
      childrenType: contract.children?.type ?? 'none',
      parentComponent,
      childComponents,
      isComposite: Boolean(parentComponent || childComponents.length > 0),
    };
    byComponent[contract.componentType] = entry;
    byCategory[category] ??= [];
    byCategory[category].push(contract.componentType);
  });

  Object.values(byCategory).forEach((componentTypes) => componentTypes.sort());
  return { byComponent, byCategory, byGroup };
}

function buildLevel1Groups(groups: readonly CompiledComponentGroup[]): CompiledLevel1GroupSummary[] {
  return groups.map((group) => {
    const typicalZones = (Object.entries(legacyZoneGroupMap) as Array<[LegacyZoneType, ComponentGroupName[]]>)
      .filter(([, groups]) => groups.includes(group.name))
      .map(([zoneType]) => zoneType);
    const parentChildPatterns = [...new Set(group.components.flatMap((componentType) => {
      const childComponents = getChildComponentHints(componentType);
      if (childComponents.length > 0) {
        return [`${componentType} > ${childComponents.join(' | ')}`];
      }
      const parentComponent = getParentComponentHint(componentType);
      return parentComponent ? [`${parentComponent} > ${componentType}`] : [];
    }))];

    return {
      ...group,
      typicalZones,
      parentChildPatterns,
    };
  });
}

function buildSchemaContract(componentType: string): string {
  const contract = builtinContractMap[componentType];
  if (!contract) {
    return '';
  }
  const summary = summarizeContract(contract);
  const skeleton = componentMiniSkeletons[componentType];
  const warning = childrenVsItemsWarnings[componentType];
  const lines: string[] = [
    `## ${componentType}`,
    `  children: ${summary.childrenType}`,
  ];

  if (summary.parentHints.length > 0) {
    lines.push(`  structure: ${summary.parentHints.join('; ')}`);
  }

  if (summary.propSummary.length > 0) {
    lines.push(`  valid-props (use ONLY these): ${summary.propSummary.join(', ')}`);
  }

  const functionPropRules = Object.entries(contract.props ?? {})
    .filter(([, prop]) => prop.type === 'function' && !prop.deprecated)
    .map(([propName]) => {
      const example = functionPropExamples[`${componentType}.${propName}`];
      return example
        ? `  function-prop ${componentType}.${propName}: MUST use {"type":"JSFunction","params":[...],"body":"..."} JSON. Example: ${example}`
        : `  function-prop ${componentType}.${propName}: MUST use {"type":"JSFunction","params":[...],"body":"..."} JSON.`;
    });
  lines.push(...functionPropRules);

  if (skeleton) {
    lines.push(`  schema-example: ${skeleton}`);
  }

  if (warning) {
    lines.push(`  ${warning}`);
  }

  return lines.join('\n');
}

function buildLevel2Briefs(
  contracts: readonly ComponentContract[],
  definitions: readonly ComponentGroupDefinition[],
): Record<string, CompiledLevel2ComponentBrief> {
  return Object.fromEntries(
    contracts.map((contract) => {
      const summary = summarizeContract(contract);
      const brief: CompiledLevel2ComponentBrief = {
        ...summary,
        groups: collectComponentGroups(contract.componentType, definitions),
        parentComponent: getParentComponentHint(contract.componentType),
        childComponents: getChildComponentHints(contract.componentType),
        miniSkeleton: componentMiniSkeletons[contract.componentType],
        itemsWarning: childrenVsItemsWarnings[contract.componentType],
        schemaContract: buildSchemaContract(contract.componentType),
      };
      return [contract.componentType, brief];
    }),
  ) as Record<string, CompiledLevel2ComponentBrief>;
}

export const compiledComponentIndex = buildComponentIndex(
  supportedContracts,
  runtimeComponentGroupDefinitions,
);
export const compiledLevel1Groups = buildLevel1Groups(runtimeCompiledGroups);
export const compiledLevel2Briefs = buildLevel2Briefs(
  supportedContracts,
  runtimeComponentGroupDefinitions,
);
export const compiledKnowledgeComponentIndex = buildComponentIndex(
  builtinContracts,
  knowledgeComponentGroupDefinitions,
);
export const compiledKnowledgeLevel1Groups = buildLevel1Groups(knowledgeCompiledGroups);
export const compiledKnowledgeLevel2Briefs = buildLevel2Briefs(
  builtinContracts,
  knowledgeComponentGroupDefinitions,
);

/**
 * Generate per-component schema contracts for the given component types.
 * These are injected into block generator prompts so the LLM knows the exact
 * JSON structure expected for each component, scoped by the planner's block.components.
 */
export function getComponentSchemaContracts(componentTypes: readonly string[]): string {
  // Expand to include child component types (e.g. Timeline needs Timeline.Item)
  const expanded = new Set(componentTypes);
  for (const comp of componentTypes) {
    if (comp === 'Timeline') expanded.add('Timeline.Item');
    if (comp === 'Descriptions') expanded.add('Descriptions.Item');
    if (comp === 'Tabs') expanded.add('Tabs.TabPane');
    if (comp === 'Form') expanded.add('Form.Item');
  }

  return [...expanded]
    .map((componentType) => {
      const brief = compiledLevel2Briefs[componentType];
      if (!brief) return null;
      return brief.schemaContract;
    })
    .filter(Boolean)
    .join('\n');
}

export function deriveChildComponents(componentType: string): string[] {
  const directHints = getChildComponentHints(componentType);
  if (directHints.length > 0) {
    return directHints;
  }
  if (componentType === 'Form') {
    return ['Form.Item'];
  }
  return [];
}

export function expandComponents(plannerComponents: readonly string[]): string[] {
  const expanded = new Set<string>();

  for (const componentType of plannerComponents) {
    if (!supportedComponentSet.has(componentType)) {
      continue;
    }
    expanded.add(componentType);
    deriveChildComponents(componentType).forEach((child) => {
      if (supportedComponentSet.has(child)) {
        expanded.add(child);
      }
    });
    (companionMap[componentType] ?? []).forEach((companion) => {
      if (supportedComponentSet.has(companion)) {
        expanded.add(companion);
      }
    });
  }

  baseComponents.forEach((componentType) => expanded.add(componentType));
  return [...expanded];
}

export function getFullComponentContracts(componentTypes: readonly string[]): string {
  return expandComponents(componentTypes)
    .map((componentType) => compiledLevel2Briefs[componentType]?.schemaContract ?? null)
    .filter(Boolean)
    .join('\n');
}
