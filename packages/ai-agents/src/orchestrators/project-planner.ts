import type {
  ProjectPlan,
  ProjectPlanPage,
  ProjectWorkspaceContext,
} from '@shenbi/ai-contracts';

function normalizeOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeProjectPage(
  value: unknown,
  index: number,
  workspace: ProjectWorkspaceContext,
): ProjectPlanPage {
  const record = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const pageId = normalizeOptionalText(record.pageId) ?? `page-${index + 1}`;
  const pageName = normalizeOptionalText(record.pageName) ?? `页面 ${index + 1}`;
  const requestedAction = record.action === 'modify' || record.action === 'skip'
    ? record.action
    : 'create';
  const description = normalizeOptionalText(record.description) ?? '';
  const fileId = normalizeOptionalText(record.fileId)
    ?? (requestedAction === 'modify'
      ? workspace.files.find((file) => file.fileId === pageId || file.pageName === pageName)?.fileId
      : undefined);

  const normalized: ProjectPlanPage = {
    pageId,
    pageName,
    action: requestedAction,
    description,
  };
  const group = normalizeOptionalText(record.group);
  const prompt = normalizeOptionalText(record.prompt);
  const evidence = normalizeOptionalText(record.evidence);
  const evidenceSourceIds = Array.isArray(record.evidenceSourceIds)
    ? record.evidenceSourceIds.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : undefined;
  const reason = normalizeOptionalText(record.reason);
  if (fileId) {
    normalized.fileId = fileId;
  }
  if (group) {
    normalized.group = group;
  }
  if (prompt) {
    normalized.prompt = prompt;
  }
  if (evidence) {
    normalized.evidence = evidence;
  }
  if (evidenceSourceIds && evidenceSourceIds.length > 0) {
    normalized.evidenceSourceIds = evidenceSourceIds;
  }
  if (reason) {
    normalized.reason = reason;
  }
  return normalized;
}

export function normalizeProjectPlan(
  value: unknown,
  workspace: ProjectWorkspaceContext,
): ProjectPlan {
  const record = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const projectName = normalizeOptionalText(record.projectName) ?? '未命名项目';
  const rawPages = Array.isArray(record.pages) ? record.pages : [];
  return {
    projectName,
    pages: rawPages.map((page, index) => normalizeProjectPage(page, index, workspace)),
  };
}

export function buildProjectPlannerPrompt(input: {
  prompt: string;
  workspace: ProjectWorkspaceContext;
  revisionPrompt?: string;
}): { systemText: string; userText: string } {
  const workspaceLines = input.workspace.files.length > 0
    ? input.workspace.files.map((file, index) => (
      `${index + 1}. fileId=${file.fileId}; pageName=${file.pageName}; summary=${file.schemaSummary}`
    ))
    : ['当前工作区还没有现成页面。'];

  const currentPageLine = input.workspace.currentSchemaSummary
    ? `当前编辑页: ${input.workspace.currentSchemaSummary}`
    : '当前编辑页: 无';

  const revisionLine = input.revisionPrompt
    ? `用户对上一版规划的补充修改意见：${input.revisionPrompt}`
    : '';

  return {
    systemText: [
      '你是 Shenbi 低代码平台的项目规划助手。',
      '请只输出合法 JSON 对象，不要输出 Markdown，不要解释。',
      '返回格式必须是 {"projectName":"string","pages":[...]}。',
      'pages 中每一项都应包含：pageId, pageName, action(create|modify|skip), description。',
      '可选字段：fileId, group, prompt, evidence, reason。',
      '当需求是多页面项目时，要把用户会独立访问的界面拆成独立 page；group 表示导航目录。',
      '当某个已有页面应该被修改而不是新建时，action 必须是 "modify"，并尽量填 fileId。',
      'prompt 要足够详细，后续会直接用于单页生成/修改；description 只写一句短摘要。',
      'evidence 优先保留用户原文关键字段，不要空泛概括。',
      '如果某页不需要生成，只能使用 action="skip"，并在 reason 里说明原因。',
    ].join('\n'),
    userText: [
      `用户需求：${input.prompt}`,
      revisionLine,
      `可用组件摘要：${input.workspace.componentSummary || '未提供'}`,
      currentPageLine,
      '当前工作区页面：',
      ...workspaceLines,
    ].filter(Boolean).join('\n'),
  };
}
