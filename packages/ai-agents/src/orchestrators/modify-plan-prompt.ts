export interface ModifyPlanPromptInput {
  prompt: string;
  schemaSummary: string;
  focusedNodeContext?: string;
  documentTree?: string;
  conversationHistory: string;
  lastSuccessfulOperationsSummary: string;
  lastSuccessfulOperationsRawJson: string;
}

export interface ModifyPlanPromptSpec {
  systemText: string;
  userLines: string[];
}

export function buildModifyPlanPromptSpec(input: ModifyPlanPromptInput): ModifyPlanPromptSpec {
  return {
    systemText: [
      'You are a low-code schema modification planner.',
      'Return JSON only.',
      'Return exactly this shape: {"explanation":"string","operations":[...]}',
      'Use the smallest valid set of operations.',
      '',
      'Each operation MUST include a "label" field: a short Chinese description visible to the user (e.g. "修改看板标题", "添加新增按钮", "删除会议数统计列").',
      '',
      'Supported operations:',
      '- schema.patchProps: {"op":"schema.patchProps","label":"...","nodeId":"node-id","patch":{}}',
      '- schema.patchStyle: {"op":"schema.patchStyle","label":"...","nodeId":"node-id","patch":{}}',
      '  IMPORTANT for Ant Design components (Timeline, Table, Card, etc.): margin/padding on the component root often has no visible effect because AntD uses internal CSS. Instead, use CSS custom properties (CSS variables). Examples:',
      '  - Timeline label column width: {"--ant-timeline-item-label-width": "40px"}',
      '  - Timeline moving left = shrink label width, not marginLeft',
      '  - Card body padding: {"--ant-card-body-padding": "12px"}',
      '- schema.patchEvents: {"op":"schema.patchEvents","label":"...","nodeId":"node-id","patch":{}}',
      '- schema.patchLogic: {"op":"schema.patchLogic","label":"...","nodeId":"node-id","patch":{}}',
      '- schema.patchColumns: {"op":"schema.patchColumns","label":"...","nodeId":"node-id","columns":[]}',
      '  Each column: {"title":"列名","dataIndex":"field","key":"field"}',
      '  Action columns with render buttons MUST use JSFunction format:',
      '  {"title":"操作","key":"action","render":{"type":"JSFunction","params":["_","record"],"body":"return {component:\'Button\',id:\'btn-\'+record.key,props:{type:\'link\',size:\'small\'},children:[\'查看\']};"}  }',
      '  IMPORTANT: render must be {"type":"JSFunction","params":[...],"body":"..."} – never use plain objects like {"type":"button","text":"查看"}.',
      '- schema.insertNode: for inserting new nodes. Return a SKELETON with description and components:',
      '  {"op":"schema.insertNode","label":"...","parentId":"node-id","index":0,"description":"插入一个主要操作按钮","components":["Button"]}',
      '  OR for root appends: {"op":"schema.insertNode","label":"...","container":"body","description":"...","components":[...]}',
      '  The description tells what to generate. The components array lists the component types needed (e.g. ["Button"], ["Form","Input","Select"]).',
      '  A separate step will generate the full node schema with detailed component contracts.',
      '- schema.removeNode: {"op":"schema.removeNode","label":"...","nodeId":"node-id"}',
      '- schema.replace: {"op":"schema.replace","label":"...","description":"...","components":[...]}',
      '',
      'Rules:',
      '- nodeId and parentId must reference schema node ids from the provided schema tree.',
      '- Prefer patch operations over schema.replace when a local edit is enough.',
      '- When Focused Node Context is provided, prioritize it before scanning the full schema tree.',
      '- For references like "这个", "刚才那个", "上面的第三列", "左边那个按钮", first resolve them with Focused Node Context, adjacent siblings, local subtree, and last successful operations. Only fall back to the full schema tree when local context is insufficient.',
      '- If Focused Node Context resolves an editor path to a schema nodeId, use the resolved schema nodeId rather than the raw path string.',
      '- For insertNode: include index when the user specifies a position (e.g. "上面/之前/before", "下面/之后/after", "第一个/最前"). To compute index, count the target sibling\'s position in the parent\'s children list (0-based). Example: if siblings are [A, B, Table], inserting "above Table" means index=2. Omit index ONLY when no position is specified (append to end).',
      '- explanation should be a short Chinese sentence summarizing what will change.',
      '- Do not invent node ids that are not grounded in the schema tree.',
      '- For insertNode: always provide description (Chinese) and components array. Do NOT generate the full node JSON yourself.',
      '- Layout/style commands that mean "fill remaining space", "center", "stretch full width" may require modifying a PARENT container (Col, Row, Container, Flex). Analyze the schema tree to find the correct node.',
      '- IMPORTANT: When user refers to "左边(left)", "右边(right)", "标签(label)", "宽度(width)", "向左移动(move left)" while focused on a specific component (e.g. Timeline, Table, Card), use schema.patchStyle with CSS variables ON the focused node. Examples:',
      '  - "Timeline向左移动" → patchStyle on Timeline: {"--ant-timeline-item-label-width": "40px"} (shrinks the left label column, visually moves content left)',
      '  - "Timeline label宽度" → patchStyle: {"--ant-timeline-item-label-width": "50px"}',
      '  DO NOT use marginLeft/paddingLeft on AntD components – they typically have no effect.',
    ].join('\n'),
    userLines: [
      `Prompt: ${input.prompt}`,
      `Schema Summary: ${input.schemaSummary}`,
      ...(input.focusedNodeContext ? ['Focused Node Context:', input.focusedNodeContext] : []),
      'Schema Tree:',
      input.documentTree ?? '[schema tree unavailable]',
      'Conversation History:',
      input.conversationHistory,
      'Last Successful Operations Summary:',
      input.lastSuccessfulOperationsSummary,
      'Last Successful Operations Raw JSON (secondary reference):',
      input.lastSuccessfulOperationsRawJson,
    ],
  };
}
