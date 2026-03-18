import { createEditor } from '@shenbi/editor-core';
import type { PageSchema } from '@shenbi/schema';
import { executeAgentOperation } from './operation-executor';
import type { AIClient, ProjectPlan } from './api-types';
import type { EditorAIBridge } from './editor-ai-bridge';
import type { AgentLoopPageProgress } from './agent-loop-types';

export interface ToolDefinition {
  name: string;
  description: string;
}

export interface ToolContext {
  bridge: EditorAIBridge;
  aiClient: AIClient;
  plannerModel: string;
  blockModel: string;
  thinkingEnabled: boolean;
  getCurrentConversationId: () => string | undefined;
  getAvailableComponentsSummary: () => string;
  listWorkspaceFiles: () => Promise<Array<{ id: string; name: string; updatedAt: number }>>;
  readPageSchema: (fileId: string) => Promise<PageSchema>;
  writePageSchema: (fileId: string, schema: PageSchema) => Promise<void>;
  deletePageSchema: (fileId: string) => Promise<void>;
  proposeProjectPlan: (plan: ProjectPlan) => Promise<string>;
  executeCreatePage: (input: { pageId: string; pageName: string; prompt: string; fileId?: string }, page: AgentLoopPageProgress) => Promise<Record<string, unknown>>;
  executeModifyPage: (input: { fileId: string; prompt: string; pageName?: string }, page: AgentLoopPageProgress) => Promise<Record<string, unknown>>;
}

function summarizeSchema(schema: PageSchema): string {
  const nodeCount = Array.isArray(schema.body) ? schema.body.length : schema.body ? 1 : 0;
  return `pageId=${schema.id}; pageName=${schema.name ?? schema.id}; nodeCount=${nodeCount}`;
}

function normalizeOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function toProjectPlan(value: Record<string, unknown>): ProjectPlan {
  const projectName = typeof value.projectName === 'string' && value.projectName.trim().length > 0
    ? value.projectName.trim()
    : '未命名项目';
  const rawPages = Array.isArray(value.pages) ? value.pages : [];
  return {
    projectName,
    pages: rawPages.map((page, index) => {
      const record = (page && typeof page === 'object' ? page : {}) as Record<string, unknown>;
      return {
        pageId: typeof record.pageId === 'string' && record.pageId.trim() ? record.pageId.trim() : `page-${index + 1}`,
        pageName: typeof record.pageName === 'string' && record.pageName.trim() ? record.pageName.trim() : `页面 ${index + 1}`,
        action: record.action === 'modify' || record.action === 'skip' ? record.action : 'create',
        description: typeof record.description === 'string' && record.description.trim() ? record.description.trim() : '',
        ...(normalizeOptionalText(record.group) ? { group: normalizeOptionalText(record.group) } : {}),
        ...(normalizeOptionalText(record.prompt) ? { prompt: normalizeOptionalText(record.prompt) } : {}),
        ...(normalizeOptionalText(record.evidence) ? { evidence: normalizeOptionalText(record.evidence) } : {}),
        ...(typeof record.reason === 'string' && record.reason.trim() ? { reason: record.reason.trim() } : {}),
      };
    }),
  };
}

export function buildCreatePagePrompt(actionInput: Record<string, unknown>, pageName: string): string {
  if (typeof actionInput.prompt === 'string' && actionInput.prompt.trim()) {
    return actionInput.prompt.trim();
  }

  const promptParts = [
    `${pageName} 页面`,
  ];
  const description = typeof actionInput.description === 'string' && actionInput.description.trim()
    ? actionInput.description.trim()
    : undefined;
  const layout = typeof actionInput.layout === 'string' && actionInput.layout.trim()
    ? actionInput.layout.trim()
    : undefined;
  const components = typeof actionInput.components === 'string' && actionInput.components.trim()
    ? actionInput.components.trim()
    : undefined;
  const fields = typeof actionInput.fields === 'string' && actionInput.fields.trim()
    ? actionInput.fields.trim()
    : undefined;
  const interactions = typeof actionInput.interactions === 'string' && actionInput.interactions.trim()
    ? actionInput.interactions.trim()
    : undefined;
  const targetUser = typeof actionInput.targetUser === 'string' && actionInput.targetUser.trim()
    ? actionInput.targetUser.trim()
    : undefined;
  const evidence = typeof actionInput.evidence === 'string' && actionInput.evidence.trim()
    ? actionInput.evidence.trim()
    : undefined;

  if (description) {
    promptParts.push(`目标: ${description}`);
  }
  if (layout) {
    promptParts.push(`布局: ${layout}`);
  }
  if (components) {
    promptParts.push(`组件: ${components}`);
  }
  if (fields) {
    promptParts.push(`字段: ${fields}`);
  }
  if (interactions) {
    promptParts.push(`交互: ${interactions}`);
  }
  if (targetUser) {
    promptParts.push(`用户: ${targetUser}`);
  }
  if (evidence) {
    promptParts.push(`原文依据: ${evidence}`);
  }

  return promptParts.join('\n');
}

export function buildModifyPagePrompt(actionInput: Record<string, unknown>): string {
  if (typeof actionInput.prompt === 'string' && actionInput.prompt.trim()) {
    return actionInput.prompt.trim();
  }

  const parts = [
    typeof actionInput.description === 'string' && actionInput.description.trim()
      ? actionInput.description.trim()
      : '请按当前需求修改页面',
  ];
  if (typeof actionInput.fields === 'string' && actionInput.fields.trim()) {
    parts.push(`字段调整: ${actionInput.fields.trim()}`);
  }
  if (typeof actionInput.interactions === 'string' && actionInput.interactions.trim()) {
    parts.push(`交互调整: ${actionInput.interactions.trim()}`);
  }
  if (typeof actionInput.evidence === 'string' && actionInput.evidence.trim()) {
    parts.push(`原文依据: ${actionInput.evidence.trim()}`);
  }
  return parts.join('\n');
}

function normalizeBackgroundFileId(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? normalized : undefined;
}

function createEphemeralBridge(schema: PageSchema): EditorAIBridge {
  const editor = createEditor({ initialSchema: schema });
  return {
    getSchema: () => editor.state.getSchema(),
    getSelectedNodeId: () => undefined,
    getAvailableComponents: () => [],
    execute: async (commandId, args) => {
      try {
        const data = await editor.commands.execute(commandId, args);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
    replaceSchema: (nextSchema) => {
      void editor.commands.execute('schema.replace', { schema: nextSchema });
    },
    appendBlock: async (node, parentTreeId) => ({
      success: true,
      data: await editor.commands.execute('node.append', { node, parentTreeId }),
    }),
    removeNode: async (treeId) => ({
      success: true,
      data: await editor.commands.execute('node.remove', { treeId }),
    }),
    subscribe: () => () => undefined,
  };
}

export function getDefaultToolDefinitions(): ToolDefinition[] {
  return [
    { name: 'listWorkspaceFiles', description: 'List all workspace page files with id, name, and updatedAt.' },
    { name: 'readPageSchema', description: 'Read one page schema by fileId and return a compact summary.' },
    { name: 'getCurrentPageSchema', description: 'Inspect the currently opened page schema in the editor.' },
    { name: 'getAvailableComponents', description: 'List currently available component contracts.' },
    { name: 'proposeProjectPlan', description: 'Present a project plan to the user and wait for confirmation or revision.' },
    { name: 'createPage', description: 'Generate a new page schema in background storage without switching editor focus.' },
    { name: 'modifyPage', description: 'Modify an existing page schema in background storage.' },
    { name: 'finish', description: 'Finish the loop and summarize the completed work.' },
  ];
}

export function buildAgentLoopSystemPrompt(): string {
  const tools = getDefaultToolDefinitions()
    .map((tool) => `- ${tool.name}: ${tool.description}`)
    .join('\n');
  return [
    '你是 Shenbi 低代码平台的 Agent。你只能通过工具推进任务。',
    '你的回复会被程序直接 JSON.parse。必须输出合法 JSON 对象，不要输出额外文字。',
    '',
    '## 可用工具',
    tools,
    '',
    '## 回复协议',
    '每次回复必须是一个 JSON 对象，包含以下字段：',
    '',
    '必填字段：',
    '- "action": 工具名称（必须从上面的可用工具中选择）',
    '- "actionInput": 工具参数（JSON 对象，无参工具写 {}）',
    '',
    '可选字段（最多选一个）：',
    '- "status": 一句简短状态说明',
    '- "reasoningSummary": 一句简短原因说明',
    '',
    '## 平台概念',
    '在 Shenbi 低代码平台中：',
    '- page（页面）= 一个独立的路由界面，用户通过左侧导航菜单点击进入。',
    '- group（分组）= 导航菜单中的目录/文件夹，包含若干 page。',
    '如果一个业务模块下有多个可独立操作的功能界面，每个功能界面应拆为独立 page，放在同一个 group 下。',
    '',
    '## 正确示例',
    '{"action":"listWorkspaceFiles","actionInput":{}}',
    '',
    '// 简单项目（2 个页面）',
    '{"reasoningSummary":"根据用户需求规划项目","action":"proposeProjectPlan","actionInput":{"projectName":"订单管理后台","pages":[{"pageId":"order-list","pageName":"订单列表页","action":"create","group":"订单管理","description":"展示订单列表、筛选和分页","prompt":"订单列表页。\\n目标：展示订单列表，支持搜索、筛选、分页和导出。\\n筛选：订单状态、日期范围、客户关键词。\\n表格列：订单编号、客户名称、订单金额、下单时间、订单状态、操作。\\n操作：新建订单、查看详情、编辑、删除。","evidence":"订单列表：支持订单状态筛选、日期筛选、导出和行内编辑。"},{"pageId":"order-detail","pageName":"订单详情页","action":"create","group":"订单管理","description":"展示订单基础信息、商品明细和物流信息","prompt":"订单详情页。\\n展示订单基础信息、商品明细、金额汇总、物流信息和操作记录。","evidence":"订单详情：展示基础信息、商品信息、物流信息和操作日志。"}]}}',
    '',
    '// 复杂项目（一个大模块拆为多个页面 + 多个 group）',
    '{"reasoningSummary":"文档描述了内容管理中心，包含采集、编辑、AI辅助、发布、政策比对等独立功能，各自对应独立界面","action":"proposeProjectPlan","actionInput":{"projectName":"内容管理中心","pages":[{"pageId":"content-collect","pageName":"信息采集管理","action":"create","group":"内容管理","description":"WEB采集、接口对接、文件导入的统一管理","prompt":"信息采集管理页。\\n支持多种采集方式：WEB网页采集、标准接口对接、文件导入、数据库对接。\\n表格列：采集任务名称、采集方式、来源地址、状态、最近采集时间、操作。\\n操作：新建采集任务、启动/暂停、查看采集日志、删除。","evidence":"信息采集（WEB 网页采集、标准接口、文件导入、数据库对接）"},{"pageId":"content-edit","pageName":"信息录入与编辑","action":"create","group":"内容管理","description":"内容的录入、编辑和富文本排版","prompt":"信息录入与编辑页。\\n提供富文本编辑器，支持图文混排、附件上传、多媒体嵌入。\\n左侧内容列表，右侧编辑区域，支持草稿保存和版本历史。","evidence":"信息录入与编辑"},{"pageId":"ai-assist","pageName":"AI智能辅助","action":"create","group":"内容管理","description":"标签提取、摘要生成、查重、校对等AI功能面板","prompt":"AI智能辅助页。\\n功能面板：标签提取、摘要生成、辅助写作、内容查重、文本校对、关键词比对。\\n每个功能以卡片形式展示，点击进入对应工作台。","evidence":"AI 智能辅助（标签提取、摘要生成、辅助写作、内容查重、文本校对、关键词比对等）"},{"pageId":"content-publish","pageName":"内容发布管理","action":"create","group":"内容管理","description":"多渠道发布和发布状态追踪","prompt":"内容发布管理页。\\n支持多渠道发布（网站、APP、微信公众号）。\\n发布列表：内容标题、目标渠道、发布状态、发布时间、操作。","evidence":"内容发布管理"},{"pageId":"policy-compare","pageName":"政策比对分析","action":"create","group":"政策管理","description":"跨省份、跨地市政策对比与可视化展现","prompt":"政策比对分析页。\\n运用AI对本省和其他省份同类政策进行比对分析，对辖区内13个设区市同类政策进行横向对比。\\n以可视化表格和图解展现差异，支持按政策类别、时间范围筛选。","evidence":"政策比对分析（运用 AI 等技术，对本省和其他省份同类政策、对辖区内 13 个设区市同类政策进行比对分析，以可视化的表格或图解进行展现）"}]}}',
    '',
    '{"action":"createPage","actionInput":{"pageId":"order-list","pageName":"订单列表页","prompt":"订单列表页。\\n目标：展示订单列表，支持搜索、筛选、分页和导出。\\n筛选：订单状态、日期范围、客户关键词。\\n表格列：订单编号、客户名称、订单金额、下单时间、订单状态、操作。\\n操作：新建订单、查看详情、编辑、删除。"}}',
    '',
    '## 规则',
    '1. 每次只调用一个工具，输出一个 JSON 对象。',
    '2. 不要返回数组、字符串、数字等非对象类型。不要返回 Markdown 代码块。',
    '3. 除 status 和 reasoningSummary 外不要输出其他解释字段。',
    '4. action 必须从上面的可用工具中选择，actionInput 必须是合法 JSON 对象。',
    '5. 多页面需求必须先 proposeProjectPlan。proposeProjectPlan 的 actionInput 必须包含 projectName 和非空 pages。',
    '6. 项目规划一旦确认，后续按已确认计划继续执行，不要重新规划，不要回显文件元数据或 Observation 内容。',
    '7. createPage / modifyPage 的 actionInput 必须包含 pageId 或 fileId、pageName，以及足够具体的 description 或 prompt。',
    '8. 所有计划页面完成后，直接 finish。',
    '',
    '## 文档分析规则',
    '当用户上传了需求文档时：',
    '1. 先通读文档，识别文档的层级结构：一级标题/章节通常对应 group（导航目录），编号子功能或二级标题通常各自对应独立 page。',
    '2. 对每个子功能，判断它是否是用户会独立访问的界面。如果是，拆为独立 page；如果只是另一个界面的附属功能（如弹窗、侧栏），不单独拆。',
    '3. 再生成项目计划。proposeProjectPlan 的每个页面应尽量包含：group（所属模块）、description（短摘要）、prompt（详细建页说明）、evidence（文档关键摘录）。',
    'description 只能是一句简明摘要，用于展示，不要把 description 写成完整需求。',
    'evidence 必须尽量逐字引用文档原文，优先保留编号、括号、冒号、分号和关键字段名，禁止把 evidence 写成概括性改写。',
    '如果原文过长，可以截取最关键的连续原文片段，并用省略号表示裁剪，但不要改变原句含义。',
    'prompt 用于后续 createPage / modifyPage 执行，必须吸收 evidence 中的原文细节，而不是只重复 description。',
    '如果用户在多轮里继续修改或补充文档要求，新的页面 prompt 必须保留这些新增细节，不要退化成一句笼统描述。',
  ].join('\n');
}

export async function executeAgentTool(
  context: ToolContext,
  action: string,
  actionInput: Record<string, unknown>,
  pageLookup: Map<string, AgentLoopPageProgress>,
): Promise<Record<string, unknown> | string | Array<unknown>> {
  switch (action) {
    case 'listWorkspaceFiles':
      return context.listWorkspaceFiles();
    case 'readPageSchema': {
      const fileId = typeof actionInput.fileId === 'string' ? actionInput.fileId : '';
      if (!fileId) {
        throw new Error('readPageSchema requires fileId');
      }
      const schema = await context.readPageSchema(fileId);
      return {
        fileId,
        summary: summarizeSchema(schema),
      };
    }
    case 'getCurrentPageSchema': {
      const schema = context.bridge.getSchema();
      return {
        fileId: schema.id,
        summary: summarizeSchema(schema),
      };
    }
    case 'getAvailableComponents':
      return {
        summary: context.getAvailableComponentsSummary(),
      };
    case 'proposeProjectPlan': {
      const plan = toProjectPlan(actionInput);
      if (plan.pages.length === 0) {
        throw new Error('proposeProjectPlan requires a non-empty pages array');
      }
      return context.proposeProjectPlan(plan);
    }
    case 'createPage': {
      const pageId = typeof actionInput.pageId === 'string' && actionInput.pageId.trim()
        ? actionInput.pageId.trim()
        : typeof actionInput.fileId === 'string' && actionInput.fileId.trim()
          ? actionInput.fileId.trim()
          : typeof actionInput.name === 'string' && actionInput.name.trim()
            ? actionInput.name.trim()
          : `page-${pageLookup.size + 1}`;
      const pageName = typeof actionInput.pageName === 'string' && actionInput.pageName.trim()
        ? actionInput.pageName.trim()
        : typeof actionInput.name === 'string' && actionInput.name.trim()
          ? actionInput.name.trim()
          : pageId;
      const fileId = normalizeBackgroundFileId(pageId)
        ?? normalizeBackgroundFileId(typeof actionInput.fileId === 'string' ? actionInput.fileId : undefined)
        ?? normalizeBackgroundFileId(pageName)
        ?? `页面-${pageLookup.size + 1}`;
      const prompt = buildCreatePagePrompt(actionInput, pageName);
      const page = pageLookup.get(pageId) ?? {
        pageId,
        pageName,
        action: 'create',
        description: prompt,
        ...(normalizeOptionalText(actionInput.group) ? { group: normalizeOptionalText(actionInput.group) } : {}),
        ...(normalizeOptionalText(actionInput.prompt) ? { prompt: normalizeOptionalText(actionInput.prompt) } : {}),
        ...(normalizeOptionalText(actionInput.evidence) ? { evidence: normalizeOptionalText(actionInput.evidence) } : {}),
        status: 'waiting',
      };
      return context.executeCreatePage({ pageId, pageName, prompt, fileId }, page);
    }
    case 'modifyPage': {
      const fileId = typeof actionInput.fileId === 'string' ? actionInput.fileId.trim() : '';
      if (!fileId) {
        throw new Error('modifyPage requires fileId');
      }
      const prompt = buildModifyPagePrompt(actionInput);
      const page = pageLookup.get(fileId) ?? {
        pageId: fileId,
        pageName: typeof actionInput.pageName === 'string' && actionInput.pageName.trim() ? actionInput.pageName.trim() : fileId,
        action: 'modify',
        description: prompt,
        ...(normalizeOptionalText(actionInput.group) ? { group: normalizeOptionalText(actionInput.group) } : {}),
        ...(normalizeOptionalText(actionInput.prompt) ? { prompt: normalizeOptionalText(actionInput.prompt) } : {}),
        ...(normalizeOptionalText(actionInput.evidence) ? { evidence: normalizeOptionalText(actionInput.evidence) } : {}),
        status: 'waiting',
      };
      return context.executeModifyPage({ fileId, prompt, pageName: page.pageName }, page);
    }
    case 'finish':
      return {
        summary: typeof actionInput.summary === 'string' ? actionInput.summary : '完成',
      };
    default:
      throw new Error(`Unsupported tool: ${action}`);
  }
}

export async function applyModifyOperationsToSchema(
  initialSchema: PageSchema,
  operations: Array<{ op: string; [key: string]: unknown }>,
): Promise<PageSchema> {
  const bridge = createEphemeralBridge(initialSchema);
  for (const operation of operations) {
    const result = await executeAgentOperation(bridge, operation as Parameters<typeof executeAgentOperation>[1]);
    if (!result.success) {
      throw new Error(result.error ?? `Failed to apply ${operation.op}`);
    }
  }
  return bridge.getSchema();
}
