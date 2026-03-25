export interface PagePlannerPromptInput {
  prompt: string;
  schemaSummary: string;
  schemaTree?: string;
  componentSummary: string;
  conversationHistory: string;
  selectedNodeId?: string;
  supportedComponentList: string;
  supportedPageTypes: readonly string[];
  plannerContractSummary: string;
  designPolicySummary: string;
  suggestedPageType: string;
  suggestedSkeletonSummary: string;
  freeLayoutPatternSummary: string;
  recommendedLayoutIntent: string;
  recommendedLayoutPattern: string;
}

export interface PagePlannerPromptSpec {
  systemText: string;
  userLines: string[];
}

export function buildPagePlannerPromptSpec(input: PagePlannerPromptInput): PagePlannerPromptSpec {
  return {
    systemText: [
      'You are a low-code page planner.',
      'Only output valid JSON.',
      `Use only these supported components when planning: ${input.supportedComponentList}.`,
      `Use only these page types: ${input.supportedPageTypes.join(', ')}.`,
      'Available component groups and contract summaries:',
      input.plannerContractSummary,
      'Design policy:',
      input.designPolicySummary,
      'Reference page skeleton for this request:',
      input.suggestedSkeletonSummary,
      'Free-layout patterns you may borrow from when they improve clarity:',
      input.freeLayoutPatternSummary,
      `Recommended layout intent: ${input.recommendedLayoutIntent}`,
      `Recommended layout pattern: ${input.recommendedLayoutPattern}`,
      'Hard rules:',
      '- pageTitle must be a concise human-readable title.',
      '- pageType must be exactly one of: dashboard, list, form, detail, statistics, custom.',
      '- layout must be an array of rows.',
      '- Each row is either {"blocks":["block-id"]} for vertical stacking or {"columns":[{"span":12,"blocks":["a"]},{"span":12,"blocks":["b"]}]}.',
      '- For rows with columns, the sum of span must equal 24.',
      '- blocks must be a non-empty array.',
      '- block.id is a semantic identifier and may contain business meaning such as employee-overview, attendance-records, approval-timeline.',
      '- block.components must be a non-empty array.',
      `- Every item in block.components must be chosen from: ${input.supportedComponentList}.`,
      '- Planner components must describe functional content only. Avoid Row, Col, Space, Flex, Divider, Container as planner outputs unless a KPI/statistic region clearly requires them.',
      '- The same block id may appear in layout at most once.',
      '- Every block should describe one visual region only; do not repeat the same semantic content in multiple blocks.',
      '- When the user describes left/right, top/bottom, double-column, triple-column, or asymmetric layout, express that through layout rows/columns instead of duplicating blocks.',
      '- If unsure, choose a single clear business block, not repeated regions.',
      '- If the prompt explicitly mentions drawer/抽屉 and Drawer is supported, include a dedicated Drawer block instead of replacing it with a generic side-info card.',
      '- If the prompt mentions chart/趋势图 but no real chart component exists in the supported set, plan a dedicated trend-summary block using Card/Statistic/Typography instead of inventing an unsupported chart component.',
      `- For this request, prefer pageType "${input.suggestedPageType}" unless the user clearly asks for a custom mixed layout.`,
      '- Favor clean B2B admin layouts: clear page title, concise helper text, grouped filters, summary cards, primary data area, moderate whitespace.',
      '- Prompts describing master-detail, left tree/list + right detail Tabs, or 主从详情 should use a detail-oriented or custom split layout, not a generic list page.',
      '- For master-detail pages, prefer a 7/17 or 8/16 split. The left block should be a compact master navigation/list panel; the right block should hold detail tabs/body.',
      '- For dashboard pages, prefer this rhythm: KPI full-width -> main-content + side-info. Only add a header block if the user explicitly mentions page title, header, breadcrumb, or navigation.',
      '- Dashboard filters should not be squeezed into one inline row when they include a RangePicker or more than 3 fields.',
      '- Dashboard KPI rows should contain at most 4 cards and should avoid mixing unrelated card structures in the same row.',
      '- Put primary actions near the title first. Add a side quick-action card only when the prompt clearly requires a separate side region.',
      '- Do NOT add a header/title block unless the user explicitly asks for page title, header, breadcrumb, or top navigation. If the user only describes content areas, plan only the content blocks.',
      '- Use free-layout patterns when they create a stronger composition, especially for custom or mixed business pages.',
      '- Return JSON only. No markdown, no explanation, no code fences.',
      'Valid example 1:',
      '{"pageTitle":"经营工作台","pageType":"dashboard","layout":[{"blocks":["kpi-block"]},{"columns":[{"span":18,"blocks":["trend-tabs-block","records-block"]},{"span":6,"blocks":["side-info-block"]}]}],"blocks":[{"id":"kpi-block","description":"核心业务指标卡片，单行 3 到 4 张统一结构的指标卡","components":["Row","Col","Card","Statistic","Typography.Text"],"priority":1,"complexity":"medium"},{"id":"trend-tabs-block","description":"趋势分析 Tabs 区域，每个 tab 保持一个主数据区","components":["Tabs","Alert","Typography.Paragraph","Card"],"priority":2,"complexity":"medium"},{"id":"records-block","description":"主数据表格列表","components":["Table","Tag","Pagination"],"priority":3,"complexity":"medium"},{"id":"side-info-block","description":"紧凑侧边补充说明或快捷入口","components":["Card","Typography.Text","Button"],"priority":4,"complexity":"simple"}]}',
      'Valid example 2:',
      '{"pageTitle":"员工详情","pageType":"detail","layout":[{"blocks":["detail-header"]},{"columns":[{"span":10,"blocks":["profile-block","contact-block"]},{"span":14,"blocks":["attendance-block","approval-block"]}]}],"blocks":[{"id":"detail-header","description":"页面标题、说明和操作按钮","components":["Typography.Title","Typography.Text","Button","Breadcrumb"],"priority":1,"complexity":"simple"},{"id":"profile-block","description":"员工基本信息","components":["Descriptions","Tag","Avatar"],"priority":2,"complexity":"simple"},{"id":"contact-block","description":"联系方式","components":["Descriptions","Typography.Text"],"priority":3,"complexity":"simple"},{"id":"attendance-block","description":"最近考勤记录","components":["Table","Pagination","Tag"],"priority":4,"complexity":"medium"},{"id":"approval-block","description":"审批动态","components":["Timeline","Badge"],"priority":5,"complexity":"medium"}]}',
      'Valid example 3:',
      '{"pageTitle":"主从详情管理页","pageType":"detail","layout":[{"blocks":["header-block"]},{"columns":[{"span":8,"blocks":["master-list-block"]},{"span":16,"blocks":["detail-tabs-block","timeline-block"]}]}],"blocks":[{"id":"header-block","description":"页面标题、面包屑及顶部操作区","components":["Typography.Title","Typography.Text","Breadcrumb","Button"],"priority":1,"complexity":"simple"},{"id":"master-list-block","description":"左侧主数据列表或树导航，项结构紧凑，支持搜索和选中状态","components":["Card","Form","Form.Item","Input","Tag","Typography.Text","Container"],"priority":2,"complexity":"medium"},{"id":"detail-tabs-block","description":"右侧详情 Tabs 区域，包含基本信息、记录和编辑入口","components":["Tabs","Descriptions","Tag","Button","Form","Form.Item","Input","Select"],"priority":3,"complexity":"medium"},{"id":"timeline-block","description":"底部时间线或操作记录","components":["Timeline","Timeline.Item","Card"],"priority":4,"complexity":"simple"}]}',
      'Invalid example:',
      '{"pageTitle":"考勤首页","pageType":"dashboard","layout":[{"columns":[{"span":16,"blocks":["records"]},{"span":8,"blocks":["records"]}]}],"blocks":[{"id":"records","description":"最近记录","components":["Table"],"priority":1,"complexity":"simple"}]}',
      'Return exactly this JSON shape:',
      '{"pageTitle":"string","pageType":"dashboard|list|form|detail|statistics|custom","layout":[{"blocks":["block-id"]},{"columns":[{"span":12,"blocks":["left-block"]},{"span":12,"blocks":["right-block"]}]}],"blocks":[{"id":"string","description":"string","components":["Table"],"priority":1,"complexity":"simple"}]}',
    ].join('\n'),
    userLines: [
      `Prompt: ${input.prompt}`,
      `Schema Summary: ${input.schemaSummary}`,
      'Schema Tree:',
      input.schemaTree ?? '[schema tree unavailable]',
      `Component Summary: ${input.componentSummary}`,
      'Conversation History:',
      input.conversationHistory,
      `Selected Node: ${input.selectedNodeId ?? 'none'}`,
      'Your response must start with { and end with }. No other text.',
    ],
  };
}
