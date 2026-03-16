import { createEditor } from '@shenbi/editor-core';
import type { PageSchema } from '@shenbi/schema';
import { executeAgentOperation } from './operation-executor';
import type { AIClient, ProjectPlan } from './api-types';
import type { EditorAIBridge } from './editor-ai-bridge';
import type { AgentLoopBlockProgress, AgentLoopPageProgress } from './agent-loop-types';

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
  executeCreatePage: (input: { pageId: string; pageName: string; prompt: string }, page: AgentLoopPageProgress) => Promise<Record<string, unknown>>;
  executeModifyPage: (input: { fileId: string; prompt: string; pageName?: string }, page: AgentLoopPageProgress) => Promise<Record<string, unknown>>;
}

function summarizeSchema(schema: PageSchema): string {
  const nodeCount = Array.isArray(schema.body) ? schema.body.length : schema.body ? 1 : 0;
  return `pageId=${schema.id}; pageName=${schema.name ?? schema.id}; nodeCount=${nodeCount}`;
}

function toProjectPlan(value: Record<string, unknown>): ProjectPlan {
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
        ...(typeof record.reason === 'string' && record.reason.trim() ? { reason: record.reason.trim() } : {}),
      };
    }),
  };
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
    '你是 Shenbi 低代码平台的 AI 助手。你通过工具完成用户需求。',
    '',
    '## 可用工具',
    tools,
    '',
    '## 输出格式',
    '每次回复必须严格遵循以下格式，不要输出其他内容：',
    '',
    '[可选]',
    'Status: [一句面向用户的当前状态说明]',
    '或',
    'Reasoning Summary: [一句简短原因说明]',
    '',
    '示例（无参工具也必须带空对象）:',
    'Action: listWorkspaceFiles',
    'Action Input: {}',
    '',
    '示例（有参工具）:',
    'Action: readPageSchema',
    'Action Input: {"fileId":"page-1"}',
    '',
    'Action: [工具名称]',
    'Action Input: [JSON 格式参数]',
    '',
    '## 规则',
    '1. 每次只调用一个工具。',
    '2. 涉及多个页面时，先 listWorkspaceFiles / readPageSchema，再 proposeProjectPlan。',
    '3. createPage / modifyPage 的 prompt 必须具体，包含布局、字段、交互和目标用户。',
    '4. Status / Reasoning Summary 是可选字段，但 Action 和 Action Input 必须始终存在。',
    '5. 不要伪造 Observation，必须等待系统返回。',
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
      return context.proposeProjectPlan(plan);
    }
    case 'createPage': {
      const pageId = typeof actionInput.pageId === 'string' && actionInput.pageId.trim()
        ? actionInput.pageId.trim()
        : typeof actionInput.name === 'string' && actionInput.name.trim()
          ? actionInput.name.trim()
          : `page-${pageLookup.size + 1}`;
      const pageName = typeof actionInput.pageName === 'string' && actionInput.pageName.trim()
        ? actionInput.pageName.trim()
        : typeof actionInput.name === 'string' && actionInput.name.trim()
          ? actionInput.name.trim()
          : pageId;
      const prompt = typeof actionInput.prompt === 'string' && actionInput.prompt.trim()
        ? actionInput.prompt.trim()
        : `${pageName} 页面`;
      const page = pageLookup.get(pageId) ?? {
        pageId,
        pageName,
        action: 'create',
        description: prompt,
        status: 'waiting',
        blocks: [] as AgentLoopBlockProgress[],
      };
      return context.executeCreatePage({ pageId, pageName, prompt }, page);
    }
    case 'modifyPage': {
      const fileId = typeof actionInput.fileId === 'string' ? actionInput.fileId.trim() : '';
      if (!fileId) {
        throw new Error('modifyPage requires fileId');
      }
      const prompt = typeof actionInput.prompt === 'string' && actionInput.prompt.trim()
        ? actionInput.prompt.trim()
        : '请按当前需求修改页面';
      const page = pageLookup.get(fileId) ?? {
        pageId: fileId,
        pageName: typeof actionInput.pageName === 'string' && actionInput.pageName.trim() ? actionInput.pageName.trim() : fileId,
        action: 'modify',
        description: prompt,
        status: 'waiting',
        blocks: [] as AgentLoopBlockProgress[],
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
