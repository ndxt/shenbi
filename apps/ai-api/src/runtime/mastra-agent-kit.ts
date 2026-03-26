import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import {
  expandComponents,
  getDesignPolicySummary,
  getFreeLayoutPatternSummary,
  getFullComponentContracts,
  getPageSkeleton,
  getPageSkeletonSummary,
  getPlannerContractSummary,
  getZoneGoldenExample,
  validateGeneratedBlockNode,
  type AgentMemoryAttachment,
  type AgentRuntimeContext,
  type GenerateBlockInput,
  type GenerateBlockResult,
  type IntentClassification,
  type PagePlan,
  type PlanPageInput,
} from '@shenbi/ai-agents';
import type { PageType, ProjectPlan, ProjectRunRequest, RunRequest } from '@shenbi/ai-contracts';
import type { PageSchema, SchemaNode } from '@shenbi/schema';
import { z } from 'zod';
import { buildPageBlockPromptSpec } from '@shenbi/ai-agents';
import { buildPagePlannerPromptSpec } from '@shenbi/ai-agents';
import { buildProjectPlannerPrompt, normalizeProjectPlan } from '@shenbi/ai-agents';
import { formatConversationHistory } from '@shenbi/ai-agents';
import { loadEnv } from '../adapters/env.ts';
import { getSharedMastraMemory } from './mastra-memory.ts';

const env = loadEnv();

type ModelConfig = {
  providerId: string;
  modelId: string;
  url: string;
  apiKey: string;
  headers?: Record<string, string>;
};

type KnowledgeDocKind =
  | 'design-policy'
  | 'planner-catalog'
  | 'page-skeleton'
  | 'layout-pattern'
  | 'component-contract'
  | 'zone-example'
  | 'project-workflow'
  | 'document-summary';

interface KnowledgeDocument {
  id: string;
  kind: KnowledgeDocKind;
  title: string;
  text: string;
  tags: string[];
}

const pageTypes = ['dashboard', 'list', 'form', 'detail', 'statistics', 'custom'] as const;
const schemaTypesModuleUrl = new URL('../../../../packages/schema/types/index.ts', import.meta.url).href;
const { builtinContracts } = await import(schemaTypesModuleUrl) as {
  builtinContracts: Array<{ componentType: string }>;
};
const supportedComponentTypes = builtinContracts.map((contract) => contract.componentType).sort();
const supportedComponentList = supportedComponentTypes.join(', ');
const plannerContractSummary = getPlannerContractSummary();
const designPolicySummary = getDesignPolicySummary();

function parseProviderModelRef(modelRef: string | undefined): { provider?: string; model?: string } {
  if (!modelRef) {
    return {};
  }
  const separatorIndex = modelRef.indexOf('::');
  if (separatorIndex === -1) {
    return env.AI_PROVIDER
      ? { provider: env.AI_PROVIDER, model: modelRef }
      : { model: modelRef };
  }
  const provider = modelRef.slice(0, separatorIndex);
  const model = modelRef.slice(separatorIndex + 2);
  return {
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
  };
}

function resolveMastraModelConfig(requestedModel: string | undefined, kind: 'planner' | 'block' | 'chat'): ModelConfig {
  const fallbackModel = kind === 'planner'
    ? env.AI_PLANNER_MODEL
    : kind === 'block'
      ? env.AI_BLOCK_MODEL
      : env.AI_PLANNER_MODEL ?? env.AI_BLOCK_MODEL;
  const ref = parseProviderModelRef(requestedModel ?? fallbackModel);
  const provider = ref.provider ?? env.AI_PROVIDER;
  const model = ref.model ?? requestedModel ?? fallbackModel;
  if (!provider) {
    throw new Error('AI_PROVIDER is not configured');
  }
  if (!model) {
    throw new Error(`Missing ${kind} model configuration`);
  }
  const matched = env.providers.find((item) => item.provider === provider);
  const baseUrl = matched?.baseUrl ?? (provider === env.AI_PROVIDER ? env.AI_OPENAI_COMPAT_BASE_URL : undefined);
  const apiKey = matched?.apiKey ?? (provider === env.AI_PROVIDER ? env.AI_OPENAI_COMPAT_API_KEY : undefined);
  if (!baseUrl || !apiKey) {
    throw new Error(`Missing OpenAI-compatible config for provider "${provider}"`);
  }
  return {
    providerId: provider,
    modelId: model,
    url: baseUrl,
    apiKey,
  };
}

function createKnowledgeCorpus(): KnowledgeDocument[] {
  const docs: KnowledgeDocument[] = [
    {
      id: 'design-policy',
      kind: 'design-policy',
      title: 'Page design policy',
      text: designPolicySummary,
      tags: ['design-policy', 'layout', 'b2b'],
    },
    {
      id: 'planner-catalog',
      kind: 'planner-catalog',
      title: 'Planner component catalog',
      text: plannerContractSummary,
      tags: ['components', 'catalog', 'planner'],
    },
    {
      id: 'project-workflow',
      kind: 'project-workflow',
      title: 'Project workflow guidance',
      text: [
        'Generate project plans that explicitly distinguish create, modify, and skip actions.',
        'Prefer one page per major user goal or workflow stage.',
        'When document requirements imply API or data dependencies, mention them in page evidence/reason.',
      ].join('\n'),
      tags: ['project', 'workflow'],
    },
  ];

  for (const pageType of pageTypes) {
    docs.push({
      id: `page-skeleton:${pageType}`,
      kind: 'page-skeleton',
      title: `${pageType} page skeleton`,
      text: getPageSkeletonSummary(pageType),
      tags: ['page-skeleton', pageType],
    });
    docs.push({
      id: `layout-pattern:${pageType}`,
      kind: 'layout-pattern',
      title: `${pageType} free layout patterns`,
      text: getFreeLayoutPatternSummary(pageType),
      tags: ['layout-pattern', pageType],
    });
  }

  const zoneTypes = [
    'page-header',
    'filter',
    'kpi-row',
    'data-table',
    'detail-info',
    'form-body',
    'form-actions',
    'chart-area',
    'timeline-area',
    'side-info',
    'empty-state',
    'custom',
  ] as const;

  for (const zoneType of zoneTypes) {
    docs.push({
      id: `zone-example:${zoneType}`,
      kind: 'zone-example',
      title: `${zoneType} golden example`,
      text: getZoneGoldenExample(zoneType),
      tags: ['zone-example', zoneType],
    });
  }

  for (const componentType of supportedComponentTypes) {
    docs.push({
      id: `component-contract:${componentType}`,
      kind: 'component-contract',
      title: `${componentType} contract`,
      text: getFullComponentContracts([componentType]),
      tags: ['component-contract', componentType.toLowerCase()],
    });
  }

  return docs;
}

const knowledgeCorpus = createKnowledgeCorpus();

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5_-]+/u)
    .map((token) => token.trim())
    .filter(Boolean);
}

function searchKnowledge(query: string, limit = 4, kinds?: KnowledgeDocKind[]): KnowledgeDocument[] {
  const tokens = tokenize(query);
  const filtered = kinds && kinds.length > 0
    ? knowledgeCorpus.filter((doc) => kinds.includes(doc.kind))
    : knowledgeCorpus;

  const scored = filtered
    .map((doc) => {
      const haystack = `${doc.title}\n${doc.tags.join(' ')}\n${doc.text}`.toLowerCase();
      const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
      return { doc, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.doc.title.localeCompare(right.doc.title))
    .slice(0, limit)
    .map((entry) => entry.doc);

  if (scored.length > 0) {
    return scored;
  }
  return filtered.slice(0, limit);
}

const searchKnowledgeTool = createTool({
  id: 'searchKnowledge',
  description: 'Search Shenbi design knowledge, component contracts, page skeletons, zone examples, and project workflow guidance.',
  inputSchema: z.object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(8).default(4),
    kinds: z.array(z.enum([
      'design-policy',
      'planner-catalog',
      'page-skeleton',
      'layout-pattern',
      'component-contract',
      'zone-example',
      'project-workflow',
      'document-summary',
    ])).optional(),
  }),
  execute: async (
    { query, limit, kinds }: { query: string; limit?: number | undefined; kinds?: KnowledgeDocKind[] | undefined },
  ) => ({
    results: searchKnowledge(query, limit ?? 4, kinds),
  }),
});

const getComponentContractTool = createTool({
  id: 'getComponentContract',
  description: 'Get the full Shenbi component contract for a specific component.',
  inputSchema: z.object({
    componentType: z.string().min(1),
  }),
  execute: async ({ componentType }: { componentType: string }) => ({
    componentType,
    contract: getFullComponentContracts([componentType]),
  }),
});

const getPageSkeletonTool = createTool({
  id: 'getPageSkeleton',
  description: 'Get the recommended page skeleton, zones, and layout pattern for a page type.',
  inputSchema: z.object({
    pageType: z.enum(pageTypes),
  }),
  execute: async ({ pageType }: { pageType: typeof pageTypes[number] }) => ({
    pageType,
    summary: getPageSkeletonSummary(pageType),
    skeleton: getPageSkeleton(pageType),
  }),
});

const getZoneExampleTool = createTool({
  id: 'getZoneExample',
  description: 'Get a golden JSON example for a Shenbi zone type.',
  inputSchema: z.object({
    zoneType: z.enum([
      'page-header',
      'filter',
      'kpi-row',
      'data-table',
      'detail-info',
      'form-body',
      'form-actions',
      'chart-area',
      'timeline-area',
      'side-info',
      'empty-state',
      'custom',
    ]),
  }),
  execute: async ({ zoneType }: { zoneType: 'page-header' | 'filter' | 'kpi-row' | 'data-table' | 'detail-info' | 'form-body' | 'form-actions' | 'chart-area' | 'timeline-area' | 'side-info' | 'empty-state' | 'custom' }) => ({
    zoneType,
    example: getZoneGoldenExample(zoneType),
  }),
});

const validateSchemaNodeTool = createTool({
  id: 'validateSchemaNode',
  description: 'Validate whether a generated schema node follows Shenbi schema rules.',
  inputSchema: z.object({
    blockId: z.string().min(1),
    node: z.any(),
  }),
  execute: async ({ blockId, node }: { blockId: string; node?: unknown }) => {
    const validated = extractValidatedMastraBlockNode({ node }, blockId);
    return {
      ok: true,
      node: validated,
    };
  },
});

function buildDocumentAttachmentContext(request: RunRequest | ProjectRunRequest): string {
  const internal = (request as RunRequest & { _memoryAttachments?: AgentMemoryAttachment[] })._memoryAttachments;
  const attachments = Array.isArray(internal) ? internal : [];
  const documentAttachments = attachments.filter((attachment) => attachment.kind === 'document');
  if (documentAttachments.length === 0) {
    return '';
  }

  return documentAttachments.map((attachment) => [
    `Document: ${attachment.name}`,
    `MimeType: ${attachment.mimeType}`,
    `Preview: ${attachment.extractedTextPreview ?? ''}`,
  ].join('\n')).join('\n\n');
}

const documentSummarySchema = z.object({
  summary: z.string(),
  roles: z.array(z.string()).optional(),
  entities: z.array(z.string()).optional(),
  requiredPages: z.array(z.string()).optional(),
  keyFields: z.array(z.string()).optional(),
  evidence: z.array(z.string()).optional(),
});

const intentClassificationSchema = z.object({
  intent: z.enum(['schema.create', 'schema.modify', 'chat']),
  confidence: z.number().min(0).max(1),
  scope: z.enum(['single-page', 'multi-page']),
  routeKind: z.enum(['single-page', 'project', 'chat']),
  reason: z.string().optional(),
});

const pagePlanSchema = z.object({
  pageTitle: z.string(),
  pageType: z.enum(pageTypes),
  layout: z.array(z.union([
    z.object({
      blocks: z.array(z.string().min(1)).min(1),
    }),
    z.object({
      columns: z.array(z.object({
        span: z.number().int().min(1).max(24),
        blocks: z.array(z.string().min(1)).min(1),
      })).min(1),
    }),
  ])).optional(),
  blocks: z.array(z.object({
    id: z.string().min(1),
    description: z.string().min(1),
    components: z.array(z.string().min(1)).min(1),
    priority: z.number().int().min(1),
    complexity: z.enum(['simple', 'medium', 'complex']),
  })).min(1),
});

const blockResultSchema = z.object({
  node: z.any(),
  summary: z.string().optional(),
});

const projectPlanSchema = z.object({
  projectName: z.string(),
  pages: z.array(z.object({
    pageId: z.string(),
    pageName: z.string(),
    action: z.enum(['create', 'modify', 'skip']),
    description: z.string(),
    fileId: z.string().optional(),
    group: z.string().optional(),
    prompt: z.string().optional(),
    evidence: z.string().optional(),
    reason: z.string().optional(),
  })).min(1),
});

export function buildProjectAgentInstructions(input: {
  baseSystemText: string;
  hasDocumentContext: boolean;
}): string {
  return [
    input.baseSystemText,
    'You plan multi-page low-code projects.',
    'Use searchKnowledge when document requirements imply page type, workflow stage, or system decomposition questions.',
    'Prefer explicit create/modify/skip actions and preserve evidence from the source requirement.',
    ...(input.hasDocumentContext
      ? [
        'When uploaded documents are present, every generated page should include group, description, prompt, and evidence whenever the page is not skipped.',
        'evidence must quote continuous original wording from the uploaded document as much as possible; preserve numbering, punctuation, parentheses, colons, semicolons, and key field names.',
        'Do not rewrite evidence into abstract summaries. If the source excerpt is long, keep the most informative continuous fragment and use ellipsis only for safe trimming.',
        'prompt is for downstream page generation, so it must absorb the concrete requirements, fields, workflow steps, and UI constraints from evidence instead of repeating description.',
      ]
      : []),
  ].join('\n');
}

export function buildProjectAgentPrompt(input: {
  baseUserText: string;
  documentSummary?: z.infer<typeof documentSummarySchema>;
  documentContext: string;
}): string {
  return [
    input.baseUserText,
    `Document Summary: ${input.documentSummary ? JSON.stringify(input.documentSummary) : 'none'}`,
    ...(input.documentContext
      ? [
        'Document previews:',
        input.documentContext,
      ]
      : []),
  ].join('\n\n');
}

async function generateStructuredObject<Output>(input: {
  agentId: string;
  agentName: string;
  model: ModelConfig;
  instructions: string;
  prompt: string;
  schema: z.ZodType<Output>;
  activeTools?: string[];
  threadId?: string;
}): Promise<{ object: Output; text: string; usage?: { totalTokens?: number } }> {
  const agent = new Agent({
    id: input.agentId,
    name: input.agentName,
    instructions: input.instructions,
    model: input.model as never,
    tools: {
      searchKnowledge: searchKnowledgeTool,
      getComponentContract: getComponentContractTool,
      getPageSkeleton: getPageSkeletonTool,
      getZoneExample: getZoneExampleTool,
      validateSchemaNode: validateSchemaNodeTool,
    },
    memory: getSharedMastraMemory(),
  });

  const result = await agent.generate(input.prompt, {
    structuredOutput: {
      schema: input.schema,
    },
    ...(input.activeTools ? { activeTools: input.activeTools } : {}),
    ...(input.threadId ? { memory: { thread: input.threadId, resource: input.threadId } } : {}),
    maxSteps: input.activeTools && input.activeTools.length > 0 ? 8 : 1,
  });

  return {
    object: result.object as Output,
    text: result.text,
    ...(
      result.totalUsage?.totalTokens !== undefined
        ? { usage: { totalTokens: result.totalUsage.totalTokens } }
        : {}
    ),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function extractValidatedMastraBlockNode(blockResult: unknown, blockId: string): SchemaNode {
  if (!isRecord(blockResult) || !('node' in blockResult) || !isRecord(blockResult.node)) {
    throw new Error(`Mastra block generator returned an invalid node payload for block "${blockId}"`);
  }
  return validateGeneratedBlockNode(blockResult.node as SchemaNode, blockId);
}

export async function summarizeDocumentsWithMastra(
  request: RunRequest | ProjectRunRequest,
  threadId: string,
  modelRef?: string,
): Promise<z.infer<typeof documentSummarySchema> | undefined> {
  const documentContext = buildDocumentAttachmentContext(request);
  if (!documentContext) {
    return undefined;
  }

  const result = await generateStructuredObject({
    agentId: 'doc-understanding-agent',
    agentName: 'Doc Understanding Agent',
    model: resolveMastraModelConfig(modelRef, 'planner'),
    instructions: [
      'You read uploaded product, requirement, and business documents for a low-code generation system.',
      'Summarize only facts that help page, project, API, or table generation.',
      'Prefer field names, roles, workflow stages, and explicit page requirements.',
      'Return concise Chinese summaries.',
    ].join('\n'),
    prompt: [
      `User Prompt: ${request.prompt}`,
      'Document previews:',
      documentContext,
    ].join('\n\n'),
    schema: documentSummarySchema,
    threadId,
  });

  return result.object;
}

export async function classifyIntentWithMastraAgent(input: {
  request: RunRequest;
  context: AgentRuntimeContext;
  modelRef?: string;
}): Promise<IntentClassification & { routeKind: 'single-page' | 'project' | 'chat'; reason?: string }> {
  const documentSummary = await summarizeDocumentsWithMastra(
    input.request,
    input.request.conversationId ?? 'classify',
    input.modelRef,
  );

  const result = await generateStructuredObject({
    agentId: 'intent-router-agent',
    agentName: 'Intent Router Agent',
    model: resolveMastraModelConfig(input.modelRef, 'planner'),
    instructions: [
      'You route low-code assistant requests into single-page generation, page modification, free chat, or multi-page project generation.',
      'Use project routing when the request clearly asks for multiple pages, a project, a module set, or a complete system.',
      'Use schema.modify only when the existing page/schema context indicates the user is editing an existing page.',
      'If unsure between single-page create and project generation, prefer project when the request references document-driven system requirements.',
      'You may call searchKnowledge to inspect design and project workflow guidance before deciding.',
    ].join('\n'),
    prompt: [
      `Prompt: ${input.request.prompt}`,
      `Document Summary: ${documentSummary ? JSON.stringify(documentSummary) : 'none'}`,
      `Schema Summary: ${input.context.document.summary}`,
      `Component Summary: ${input.context.componentSummary}`,
      `Selected Node: ${input.context.selectedNodeId ?? 'none'}`,
      `Conversation Turn Count: ${input.context.conversation.turnCount}`,
      'Return the best route for this request.',
    ].join('\n'),
    schema: intentClassificationSchema,
    activeTools: ['searchKnowledge'],
    threadId: input.request.conversationId ?? 'classify',
  });

  return result.object as IntentClassification & { routeKind: 'single-page' | 'project' | 'chat'; reason?: string };
}

export async function planPageWithMastraAgent(
  input: PlanPageInput,
  modelRef?: string,
): Promise<PagePlan> {
  const suggestedPageType = (() => {
    const normalized = input.request.prompt.toLowerCase();
    if (/dashboard|首页|工作台|看板/.test(normalized)) return 'dashboard';
    if (/detail|详情|主从/.test(normalized)) return 'detail';
    if (/form|表单|录入|创建/.test(normalized)) return 'form';
    if (/list|列表|table|管理/.test(normalized)) return 'list';
    if (/统计|analysis|report/.test(normalized)) return 'statistics';
    return 'custom';
  })() satisfies PageType;

  const documentSummary = await summarizeDocumentsWithMastra(
    input.request,
    input.request.conversationId ?? 'page-plan',
    modelRef,
  );
  const conversationHistory = formatConversationHistory(input.context.conversation.history, {
    ...(input.context.document.schemaDigest ? { schemaDigest: input.context.document.schemaDigest } : {}),
  });
  const skeleton = getPageSkeleton(suggestedPageType);
  const promptSpec = buildPagePlannerPromptSpec({
    prompt: input.request.prompt,
    schemaSummary: input.context.document.summary,
    schemaTree: input.context.document.tree ?? '[schema tree unavailable]',
    componentSummary: input.context.componentSummary,
    conversationHistory,
    ...(input.context.selectedNodeId ? { selectedNodeId: input.context.selectedNodeId } : {}),
    supportedComponentList,
    supportedPageTypes: pageTypes,
    plannerContractSummary,
    designPolicySummary,
    suggestedPageType,
    suggestedSkeletonSummary: getPageSkeletonSummary(suggestedPageType),
    freeLayoutPatternSummary: getFreeLayoutPatternSummary(suggestedPageType),
    recommendedLayoutIntent: skeleton.intent,
    recommendedLayoutPattern: skeleton.layoutPattern,
  });

  const result = await generateStructuredObject({
    agentId: 'single-page-agent',
    agentName: 'Single Page Agent',
    model: resolveMastraModelConfig(modelRef ?? input.request.plannerModel, 'planner'),
    instructions: [
      promptSpec.systemText,
      'Before finalizing the layout, call getPageSkeleton and searchKnowledge when the page type, layout, or zone composition is ambiguous.',
      'If the prompt is document-driven, factor Document Summary into page planning.',
      'Use component contracts and examples to avoid unsupported components.',
    ].join('\n'),
    prompt: [
      ...promptSpec.userLines,
      `Document Summary: ${documentSummary ? JSON.stringify(documentSummary) : 'none'}`,
    ].join('\n'),
    schema: pagePlanSchema,
    activeTools: ['searchKnowledge', 'getPageSkeleton', 'getComponentContract'],
    threadId: input.request.conversationId ?? 'page-plan',
  });

  const pagePlan = result.object as z.infer<typeof pagePlanSchema>;
  const normalizedPlan: PagePlan = {
    pageTitle: pagePlan.pageTitle,
    pageType: pagePlan.pageType,
    blocks: pagePlan.blocks,
  };
  if (pagePlan.layout) {
    normalizedPlan.layout = pagePlan.layout;
  }
  return normalizedPlan;
}

export async function generateBlockWithMastraAgent(
  input: GenerateBlockInput,
  modelRef?: string,
): Promise<GenerateBlockResult> {
  const expandedComponents = expandComponents(input.block.components);
  const conversationHistory = formatConversationHistory(input.context.conversation.history, {
    ...(input.context.document.schemaDigest ? { schemaDigest: input.context.document.schemaDigest } : {}),
  });
  const promptSpec = buildPageBlockPromptSpec({
    blockDescription: input.block.description,
    ...(input.pageTitle ? { pageTitle: input.pageTitle } : {}),
    ...(input.blockIndex !== undefined ? { blockIndex: input.blockIndex } : {}),
    ...(input.placementSummary ? { placementSummary: input.placementSummary } : {}),
    suggestedComponents: input.block.components,
    schemaTree: input.context.document.tree ?? '[schema tree unavailable]',
    conversationHistory,
    supportedComponentList,
    supportedComponentsJsonShape: `{"component":"${supportedComponentTypes.join('|')}","id":"string","props":{},"children":[]}`,
    expandedComponents,
    designPolicySummary,
    componentSchemaContracts: getFullComponentContracts(expandedComponents),
    isDashboardBlock: /dashboard|工作台|看板/.test(input.request.prompt.toLowerCase()),
    isMasterListRegion: /master|主从|左侧/.test(input.block.description.toLowerCase()),
    isHeaderBlock: /header|title|hero|banner|标题|页头/.test(`${input.block.id} ${input.block.description}`.toLowerCase()),
  });
  const documentSummary = await summarizeDocumentsWithMastra(
    input.request,
    input.request.conversationId ?? `block-${input.block.id}`,
    modelRef,
  );

  const result = await generateStructuredObject({
    agentId: 'block-generator-agent',
    agentName: 'Block Generator Agent',
    model: resolveMastraModelConfig(modelRef ?? input.request.blockModel, 'block'),
    instructions: [
      promptSpec.systemText,
      'Use getComponentContract and getZoneExample whenever the correct props, children structure, or zone composition is uncertain.',
      'Call validateSchemaNode before finalizing the block output.',
      'Do not invent unsupported props or components.',
    ].join('\n'),
    prompt: [
      ...promptSpec.userLines,
      `Document Summary: ${documentSummary ? JSON.stringify(documentSummary) : 'none'}`,
    ].join('\n'),
    schema: blockResultSchema,
    activeTools: ['searchKnowledge', 'getComponentContract', 'getZoneExample', 'validateSchemaNode'],
    threadId: input.request.conversationId ?? `block-${input.block.id}`,
  });

  const blockObject = result.object as z.infer<typeof blockResultSchema>;
  const node = extractValidatedMastraBlockNode(blockObject, input.block.id);
  return {
    blockId: input.block.id,
    node,
    summary: blockObject.summary ?? `Generated ${input.block.description} via Mastra Agent`,
    ...(result.usage?.totalTokens !== undefined ? { tokensUsed: result.usage.totalTokens } : {}),
  };
}

export async function planProjectWithMastraAgent(
  request: ProjectRunRequest,
  revisionPrompt?: string,
): Promise<ProjectPlan> {
  const promptSpec = buildProjectPlannerPrompt({
    prompt: request.prompt,
    workspace: request.workspace,
    ...(revisionPrompt ? { revisionPrompt } : {}),
  });
  const documentSummary = await summarizeDocumentsWithMastra(
    request,
    request.conversationId ?? 'project-plan',
    request.plannerModel,
  );
  const documentContext = buildDocumentAttachmentContext(request);
  const result = await generateStructuredObject({
    agentId: 'project-agent',
    agentName: 'Project Agent',
    model: resolveMastraModelConfig(request.plannerModel, 'planner'),
    instructions: buildProjectAgentInstructions({
      baseSystemText: promptSpec.systemText,
      hasDocumentContext: documentContext.length > 0,
    }),
    prompt: buildProjectAgentPrompt({
      baseUserText: promptSpec.userText,
      ...(documentSummary ? { documentSummary } : {}),
      documentContext,
    }),
    schema: projectPlanSchema,
    activeTools: ['searchKnowledge', 'getPageSkeleton', 'getComponentContract'],
    threadId: request.conversationId ?? 'project-plan',
  });

  return normalizeProjectPlan(result.object as z.infer<typeof projectPlanSchema>, request.workspace);
}

export async function chatWithMastraAgent(request: unknown): Promise<{ text: string }> {
  const chatModel = (() => {
    if (request && typeof request === 'object') {
      const candidate = request as { model?: unknown; plannerModel?: unknown; blockModel?: unknown };
      if (typeof candidate.model === 'string' && candidate.model) {
        return candidate.model;
      }
      if (typeof candidate.plannerModel === 'string' && candidate.plannerModel) {
        return candidate.plannerModel;
      }
      if (typeof candidate.blockModel === 'string' && candidate.blockModel) {
        return candidate.blockModel;
      }
    }
    return undefined;
  })();

  const prompt = (() => {
    if (request && typeof request === 'object' && 'messages' in request && Array.isArray((request as { messages?: unknown }).messages)) {
      return ((request as { messages: Array<{ role: string; content: string }> }).messages)
        .map((message) => `${message.role}: ${message.content}`)
        .join('\n');
    }
    if (request && typeof request === 'object' && 'prompt' in request) {
      return String((request as { prompt: unknown }).prompt);
    }
    return 'No prompt';
  })();

  const agent = new Agent({
    id: 'chat-agent',
    name: 'Chat Agent',
    instructions: [
      'You are a helpful Shenbi low-code assistant.',
      'When needed, search design knowledge and component contracts before answering.',
      'Prefer concise Chinese answers with concrete implementation guidance.',
    ].join('\n'),
    model: resolveMastraModelConfig(chatModel, 'chat') as never,
    tools: {
      searchKnowledge: searchKnowledgeTool,
      getComponentContract: getComponentContractTool,
      getPageSkeleton: getPageSkeletonTool,
    },
    memory: getSharedMastraMemory(),
  });

  const result = await agent.generate(prompt, {
    activeTools: ['searchKnowledge', 'getComponentContract', 'getPageSkeleton'],
    maxSteps: 6,
  });
  return { text: result.text };
}

export async function* streamChatWithMastraAgent(request: unknown): AsyncIterable<{ text: string }> {
  const chatModel = (() => {
    if (request && typeof request === 'object') {
      const candidate = request as { model?: unknown; plannerModel?: unknown; blockModel?: unknown };
      if (typeof candidate.model === 'string' && candidate.model) {
        return candidate.model;
      }
      if (typeof candidate.plannerModel === 'string' && candidate.plannerModel) {
        return candidate.plannerModel;
      }
      if (typeof candidate.blockModel === 'string' && candidate.blockModel) {
        return candidate.blockModel;
      }
    }
    return undefined;
  })();

  const prompt = (() => {
    if (request && typeof request === 'object' && 'messages' in request && Array.isArray((request as { messages?: unknown }).messages)) {
      return ((request as { messages: Array<{ role: string; content: string }> }).messages)
        .map((message) => `${message.role}: ${message.content}`)
        .join('\n');
    }
    if (request && typeof request === 'object' && 'prompt' in request) {
      return String((request as { prompt: unknown }).prompt);
    }
    return 'No prompt';
  })();

  const agent = new Agent({
    id: 'chat-agent-stream',
    name: 'Chat Agent Stream',
    instructions: [
      'You are a helpful Shenbi low-code assistant.',
      'When needed, search design knowledge and component contracts before answering.',
      'Prefer concise Chinese answers with concrete implementation guidance.',
    ].join('\n'),
    model: resolveMastraModelConfig(chatModel, 'chat') as never,
    tools: {
      searchKnowledge: searchKnowledgeTool,
      getComponentContract: getComponentContractTool,
      getPageSkeleton: getPageSkeletonTool,
    },
    memory: getSharedMastraMemory(),
  });

  const output = await agent.stream(prompt, {
    activeTools: ['searchKnowledge', 'getComponentContract', 'getPageSkeleton'],
    maxSteps: 6,
  });
  const reader = output.textStream.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) {
        break;
      }
      const chunk = typeof next.value === 'string' ? next.value : decoder.decode(next.value);
      if (chunk) {
        yield { text: chunk };
      }
    }
  } finally {
    reader.releaseLock();
  }
}
