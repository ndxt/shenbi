export interface PageBlockPromptInput {
  blockDescription: string;
  pageTitle?: string;
  blockIndex?: number;
  placementSummary?: string;
  suggestedComponents: readonly string[];
  schemaTree?: string;
  conversationHistory: string;
  qualityFeedbackSummary?: string;
  supportedComponentList: string;
  supportedComponentsJsonShape: string;
  expandedComponents: readonly string[];
  designPolicySummary: string;
  componentSchemaContracts: string;
  isDashboardBlock: boolean;
  isMasterListRegion: boolean;
  isHeaderBlock: boolean;
}

export interface PageBlockPromptSpec {
  systemText: string;
  userLines: string[];
}

export function buildPageBlockPromptSpec(input: PageBlockPromptInput): PageBlockPromptSpec {
  return {
    systemText: [
      'You generate one low-code block as valid JSON.',
      `Only use supported components: ${input.supportedComponentList}.`,
      `For this block, prioritize these components: ${input.expandedComponents.join(', ')}.`,
      'Design policy:',
      input.designPolicySummary,
      'Component schema contracts (MUST follow these exact structures):',
      input.componentSchemaContracts,
      'Rules:',
      '- STRICT CONTRACT COMPLIANCE: Only use props that appear in the "Component schema contracts" section above. Do NOT add extra props from memory, from antd v4, or from any other source.',
      '- STRICT ENUM VALUES: For any prop that has a defined enum, use ONLY the exact values listed in the contract. Do not invent or substitute alternative values.',
      '- STRICT FUNCTION PROPS: Any prop whose contract type is function MUST be encoded as JSON-safe {"type":"JSFunction","params":[...],"body":"..."} objects. Never emit raw functions or strings like "(x)=>x".',
      '- The root node component must be one of the supported components.',
      '- Every child schema node must also use only supported components.',
      '- children may contain schema nodes or plain text only.',
      '- Build polished B2B admin blocks with clear hierarchy, balanced spacing, and concise business copy.',
      '- You are generating one visual region only, not a whole page.',
      '- Do NOT output page-level wrappers, page-level titles, page shell, or duplicated sibling regions.',
      '- Do NOT output page-level Row/Col or Tabs split layouts unless the current block description explicitly requires an internal split inside this one block.',
      '- Prefer Card as a self-contained wrapper for data, detail, timeline, result, empty-state, and status regions.',
      '- KPI regions may use Row > Col > Statistic inside a single block.',
      '- For dashboard and list filter regions, prefer one horizontal search bar with at most 3 fields in the same row.',
      '- Use Row + Col for filters. Date range may use a wider column, but should stay in the same horizontal row when possible.',
      '- Only use vertical/two-row filter layouts for advanced search, more than 3 fields, or clearly narrow widths.',
      '- Filter action buttons should be placed in a separate tail action area aligned to the right and kept in the same horizontal band as the fields, not in an empty-label Form.Item mixed with fields.',
      '- Do not generate a left stacked field column plus a far-right isolated button group for normal dashboard/list filters.',
      '- For KPI rows, use at most 4 cards and keep a consistent card structure: title + main value + one secondary line.',
      '- In Tabs trend regions, keep at most one Alert, one short description, and one main data area per tab pane.',
      '- Never use raw HTML tags like div, span, section, header, footer. Use Container instead of div/section/header/footer.',
      '- For Table, include sample data in props.dataSource and props.columns.',
      '- For Statistic, include props.title and props.value.',
      '- For Form.Item, include a label prop and exactly one input-like child when possible.',
      '- For Button, put button text in top-level children. Never put button text inside props.children.',
      '- For filter/action regions, query/reset/export buttons must be normal text buttons with visible children.',
      '- For Alert, use props.message for the main copy and props.description for secondary copy. Do not use props.title for Alert.',
      '- For Descriptions, include props.column and Descriptions.Item children with label props.',
      '- For Timeline, return Timeline.Item children with short text content.',
      '- Use realistic Chinese B-end copy such as 今日出勤率, 本周迟到人数, 最近考勤记录, 审批状态.',
      '- Avoid high-risk callback props unless the block explicitly needs them. If a function prop is unnecessary, omit it.',
      '- CHART v2 RULES: For all Chart.* components use ONLY @ant-design/charts v2 (G2-based) API. Do NOT use G2Plot v1 API.',
      '- CHART tooltip: DO NOT add formatter, showMarkers, domStyles, or any function string inside tooltip. Only use { items, title } or omit tooltip entirely.',
      '- CHART label: DO NOT use { type: "outer"|"inner"|"spider", content: "{name} {percentage}" } — these are v1 API and will break rendering. Omit label or use only { style: { ... } }.',
      '- CHART axis: DO NOT deeply nest label config inside axis. Use only { x: { title: "..." }, y: { title: "..." } } or omit axis.',
      '- Rule of thumb for charts: if unsure whether a sub-prop exists in v2, OMIT IT. Fewer props = correct rendering; wrong props = empty chart.',
      ...(input.isDashboardBlock
        ? [
          '- This request is dashboard-like. Favor clean business workbench rhythm over maximal density.',
          '- Prefer compact side info; do not create a large side card that competes with the main KPI rhythm unless explicitly required.',
        ]
        : []),
      ...(input.isMasterListRegion
        ? [
          '- This request includes a master-detail layout. Keep the left master list region compact and the right detail region visually dominant.',
          '- If tree semantics are supported for this block, prefer a tree-like structure. Otherwise, use compact Container/Card master items instead of multiline text Buttons.',
          '- Do NOT use Button type="text" as a multi-line card wrapper for master list items.',
          '- Each master item should contain at most one title line, one status/meta line, and one short description line.',
        ]
        : []),
      ...(input.isHeaderBlock
        ? [
          '- CRITICAL: This block is the PAGE HEADER only. It must contain ONLY the page title, an optional subtitle/description line, and optional breadcrumb navigation.',
          '- DO NOT generate any data regions, statistics cards, KPI numbers, tables, lists, form fields, tabs, timelines, or any other content in this block.',
          '- The header block should be extremely concise — typically just Typography.Title + Typography.Text + Breadcrumb.',
          '- Ignore the detailed content requirements in the user prompt; those belong to other blocks, not the header.',
        ]
        : []),
      '- Keep braces and brackets balanced. Your answer must be parseable by JSON.parse without any cleanup.',
      '- Return JSON only. No markdown, no explanation, no code fences.',
      'Return exactly this JSON shape:',
      input.supportedComponentsJsonShape,
    ].join('\n'),
    userLines: [
      `Prompt: ${input.blockDescription}`,
      `Page Title: ${input.pageTitle ?? 'Untitled'}`,
      `Block Index: ${input.blockIndex ?? 0}`,
      `Placement: ${input.placementSummary ?? '默认纵向堆叠区域'}`,
      `Block Description: ${input.blockDescription}`,
      `Suggested Components: ${input.suggestedComponents.join(', ')}`,
      'Schema Tree:',
      input.schemaTree ?? '[schema tree unavailable]',
      'Conversation History:',
      input.conversationHistory,
      ...(input.qualityFeedbackSummary ? [input.qualityFeedbackSummary] : []),
      'Your response must start with { and end with }. No other text.',
    ],
  };
}
