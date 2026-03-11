import {
  buildSelectedNodeHint,
  formatConversationHistory,
  type ModifyResult,
  type ModifySchemaInput,
} from '@shenbi/ai-agents';
import type { AgentOperation } from '@shenbi/ai-contracts';
import { LLMError } from '../adapters/errors.ts';
import {
  writeInvalidJsonDump,
  type InvalidJsonSource,
} from '../adapters/debug-dump.ts';
import { getComponentSchemaContracts } from './component-catalog.ts';
import { loadEnv } from '../adapters/env.ts';
import { logger } from '../adapters/logger.ts';
import {
  OpenAICompatibleClient,
  type OpenAICompatibleMessage,
  type OpenAICompatibleRequestDebugSummary,
  type OpenAICompatibleThinking,
} from '../adapters/openai-compatible.ts';

const env = loadEnv();
const clientCache = new Map<string, OpenAICompatibleClient>();
type JsonSalvageStrategy =
  | 'balanced_object'
  | 'trimmed_trailing_noise'
  | 'appended_missing_braces'
  | 'trimmed_extra_closing_braces';

export interface ModifySchemaTraceEntry {
  requestSummary?: OpenAICompatibleRequestDebugSummary & { provider: string };
  model: string;
  rawOutput: string;
  normalizedResult?: ModifyResult;
  /** Phase 2 per-insertNode execution traces (only present when two-phase is used) */
  executeTraces?: Array<{
    operationIndex: number;
    requestSummary?: OpenAICompatibleRequestDebugSummary & { provider: string };
    rawOutput: string;
    generatedNode?: unknown;
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

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

function resolveProviderConfig(providerName: string | undefined): {
  provider: string;
  baseUrl?: string | undefined;
  apiKey?: string | undefined;
  thinkingModels?: string[] | undefined;
  nonThinkingModels?: string[] | undefined;
  enableThinkingModels?: string[] | undefined;
} {
  const provider = providerName ?? env.AI_PROVIDER;
  if (!provider) {
    throw new LLMError('AI_PROVIDER is not configured. Set AI_PROVIDER in .env.local.', 'MISSING_PROVIDER');
  }

  const matched = env.providers.find((item) => item.provider === provider);
  return {
    provider,
    baseUrl: matched?.baseUrl ?? (provider === env.AI_PROVIDER ? env.AI_OPENAI_COMPAT_BASE_URL : undefined),
    apiKey: matched?.apiKey ?? (provider === env.AI_PROVIDER ? env.AI_OPENAI_COMPAT_API_KEY : undefined),
    thinkingModels: matched?.thinkingModels,
    nonThinkingModels: matched?.nonThinkingModels,
    enableThinkingModels: matched?.enableThinkingModels,
  };
}

function createClient(providerName?: string): OpenAICompatibleClient {
  const config = resolveProviderConfig(providerName);
  const cached = clientCache.get(config.provider);
  if (cached) {
    return cached;
  }
  if (!config.baseUrl) {
    throw new LLMError(`Missing base URL for provider "${config.provider}"`, 'MISSING_PROVIDER_BASE_URL');
  }
  if (!config.apiKey) {
    throw new LLMError(`Missing API key for provider "${config.provider}"`, 'MISSING_PROVIDER_API_KEY');
  }
  const client = new OpenAICompatibleClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    ...(config.thinkingModels ? { thinkingModels: config.thinkingModels } : {}),
    ...(config.nonThinkingModels ? { nonThinkingModels: config.nonThinkingModels } : {}),
    ...(config.enableThinkingModels ? { enableThinkingModels: config.enableThinkingModels } : {}),
  });
  clientCache.set(config.provider, client);
  return client;
}

function requireModel(model: string | undefined): string {
  if (!model) {
    throw new LLMError('Missing block model configuration', 'MISSING_MODEL');
  }
  return model;
}

function getThinking(request: ModifySchemaInput['request']): OpenAICompatibleThinking | undefined {
  return request.thinking ? { type: request.thinking.type } : undefined;
}

function extractJsonCandidate(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? text).trim();
}

function findBalancedJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) {
    return null;
  }

  const { chars } = normalizeMismatchedClosers(text.slice(start));
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{' || char === '[') {
      stack.push(char);
      continue;
    }
    if (char === '}') {
      if (stack.at(-1) !== '{') {
        return null;
      }
      stack.pop();
      if (stack.length === 0) {
        return chars.slice(0, index + 1).join('');
      }
      continue;
    }
    if (char === ']') {
      if (stack.at(-1) !== '[') {
        return null;
      }
      stack.pop();
    }
  }

  return null;
}

function normalizeMismatchedClosers(text: string): { text: string; chars: string[] } {
  const stack: string[] = [];
  const chars = text.split('');
  let inString = false;
  let escaped = false;

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{' || char === '[') {
      stack.push(char);
      continue;
    }
    if (char === '}') {
      if (stack.at(-1) === '[') {
        chars[index] = ']';
        stack.pop();
        continue;
      }
      if (stack.at(-1) === '{') {
        stack.pop();
      }
      continue;
    }
    if (char === ']') {
      if (stack.at(-1) === '{') {
        chars[index] = '}';
        stack.pop();
        continue;
      }
      if (stack.at(-1) === '[') {
        stack.pop();
      }
    }
  }

  return {
    text: chars.join(''),
    chars,
  };
}

function countOutsideStrings(text: string, target: string): number {
  let count = 0;
  let inString = false;
  let escaped = false;

  for (const char of text) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === target) {
      count += 1;
    }
  }

  return count;
}

function trySalvageJsonCandidate(text: string): { candidate: string; strategy: JsonSalvageStrategy } | null {
  const extracted = findBalancedJsonObject(text);
  if (extracted) {
    return {
      candidate: extracted,
      strategy: 'balanced_object',
    };
  }

  const trimmed = text.trim();
  for (let trimCount = 1; trimCount <= Math.min(24, trimmed.length); trimCount += 1) {
    const candidate = trimmed.slice(0, trimmed.length - trimCount).trimEnd();
    if (!candidate) {
      break;
    }
    try {
      JSON.parse(candidate);
      return {
        candidate,
        strategy: 'trimmed_trailing_noise',
      };
    } catch {
      // continue trimming
    }
  }

  const start = text.indexOf('{');
  if (start < 0) {
    return null;
  }

  const fullBase = normalizeMismatchedClosers(text.slice(start).trim()).text;
  const fullOpenCount = countOutsideStrings(fullBase, '{');
  const fullCloseCount = countOutsideStrings(fullBase, '}');
  if (fullOpenCount > fullCloseCount) {
    if (fullOpenCount - fullCloseCount > 8) {
      return null;
    }
    return {
      candidate: `${fullBase}${'}'.repeat(fullOpenCount - fullCloseCount)}`,
      strategy: 'appended_missing_braces',
    };
  }

  const end = text.lastIndexOf('}');
  const base = text.slice(start, end >= start ? end + 1 : text.length).trim();
  const openCount = countOutsideStrings(base, '{');
  const closeCount = countOutsideStrings(base, '}');
  if (openCount === closeCount) {
    return {
      candidate: base,
      strategy: 'balanced_object',
    };
  }
  if (openCount < closeCount) {
    let trimmedBase = base;
    while (trimmedBase.length > 0) {
      const next = trimmedBase.trimEnd().slice(0, -1);
      if (!next) {
        break;
      }
      const nextOpenCount = countOutsideStrings(next, '{');
      const nextCloseCount = countOutsideStrings(next, '}');
      trimmedBase = next;
      if (nextOpenCount === nextCloseCount) {
        return {
          candidate: trimmedBase.trim(),
          strategy: 'trimmed_extra_closing_braces',
        };
      }
      if (nextCloseCount < nextOpenCount) {
        break;
      }
    }
  }

  return null;
}

function stripArrowFunctions(text: string): { text: string; stripped: boolean } {
  const arrowPattern = /:\s*\([^)]*\)\s*=>/g;
  let match: RegExpExecArray | null;
  const chunks: string[] = [];
  let lastEnd = 0;
  arrowPattern.lastIndex = 0;
  while ((match = arrowPattern.exec(text)) !== null) {
    const colonIdx = match.index;
    let pos = match.index + match[0].length;
    let inBacktick = false;
    while (pos < text.length) {
      const ch = text[pos];
      if (inBacktick) {
        if (ch === '`') {
          inBacktick = false;
        }
        pos += 1;
        continue;
      }
      if (ch === '`') {
        inBacktick = true;
        pos += 1;
        continue;
      }
      if (ch === ',' || ch === '}' || ch === ']') {
        break;
      }
      pos += 1;
    }
    chunks.push(text.slice(lastEnd, colonIdx), ': null');
    lastEnd = pos;
  }
  if (chunks.length === 0) {
    return { text, stripped: false };
  }
  chunks.push(text.slice(lastEnd));
  return { text: chunks.join(''), stripped: true };
}

function summarizeModelOutput(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > 400 ? `${compact.slice(0, 400)}...` : compact;
}

function extractJson<T>(
  text: string,
  source: InvalidJsonSource,
  request: ModifySchemaInput['request'],
  model: string,
): T {
  let candidate = extractJsonCandidate(text);
  const arrowResult = stripArrowFunctions(candidate);
  if (arrowResult.stripped) {
    candidate = arrowResult.text;
    logger.warn('ai.model.invalid_json_salvaged', {
      source,
      model,
      strategy: 'stripped_arrow_functions',
    });
  }

  try {
    return JSON.parse(candidate.trim()) as T;
  } catch {
    const salvaged = trySalvageJsonCandidate(candidate);
    if (salvaged) {
      try {
        logger.warn('ai.model.invalid_json_salvaged', {
          source,
          model,
          strategy: salvaged.strategy,
        });
        return JSON.parse(salvaged.candidate) as T;
      } catch {
        // fall through to debug dump
      }
    }
    const summarizedOutput = summarizeModelOutput(text);
    const debugFile = writeInvalidJsonDump({
      source,
      rawOutput: text,
      summarizedOutput,
      request,
      model,
    });
    logger.error('ai.model.invalid_json', {
      source,
      rawOutput: text,
      summarizedOutput,
      debugFile,
    });
    throw new LLMError(
      `Model returned invalid JSON (${source}). Debug file: ${debugFile}. Raw output: ${summarizedOutput}`,
      'MODEL_INVALID_JSON',
    );
  }
}

function isModifyResult(value: unknown): value is ModifyResult {
  if (!isRecord(value) || typeof value.explanation !== 'string' || !Array.isArray(value.operations)) {
    return false;
  }
  return value.operations.every((operation) => isRecord(operation) && typeof operation.op === 'string');
}

// ---------------------------------------------------------------------------
//  Plan operation: internal type returned by Phase 1 planner.
//  For insertNode, the planner MAY return a lightweight skeleton with
//  `description` + `components` instead of a full `node`, signalling that
//  Phase 2 should generate the actual node with component contracts.
// ---------------------------------------------------------------------------

interface PlanInsertNodeSkeleton {
  op: 'schema.insertNode';
  parentId?: string;
  container?: 'body' | 'dialogs';
  index?: number;
  /** What to generate – set by planner when it defers to Phase 2 */
  description?: string;
  /** Component types needed – drives contract injection in Phase 2 */
  components?: string[];
  /** If the planner already generated the full node, it lands here */
  node?: unknown;
}

type PlanOperation = AgentOperation | PlanInsertNodeSkeleton;

interface PlanResult {
  explanation: string;
  operations: PlanOperation[];
}

function isPlanResult(value: unknown): value is PlanResult {
  if (!isRecord(value) || typeof value.explanation !== 'string' || !Array.isArray(value.operations)) {
    return false;
  }
  return value.operations.every((operation) => isRecord(operation) && typeof operation.op === 'string');
}

/** Returns true when the plan operation needs Phase 2 generation */
function needsPhase2(op: PlanOperation): op is PlanInsertNodeSkeleton {
  if (op.op !== 'schema.insertNode') return false;
  const insert = op as PlanInsertNodeSkeleton;
  // If planner returned description + components but no node, it wants Phase 2
  if (insert.description && Array.isArray(insert.components) && insert.components.length > 0) {
    return true;
  }
  // If the node field is missing or empty, also defer to Phase 2
  if (!insert.node) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
//  Phase 1: Plan prompt
// ---------------------------------------------------------------------------

function createPlanMessages(input: ModifySchemaInput): OpenAICompatibleMessage[] {
  const conversationHistory = formatConversationHistory(input.context.conversation.history, {
    ...(input.context.document.schemaDigest ? { schemaDigest: input.context.document.schemaDigest } : {}),
  });
  const selectedNodeHint = buildSelectedNodeHint(input.request.selectedNodeId);
  const documentTree = input.context.document.tree ?? '[schema tree unavailable]';
  const lastOperations = input.context.conversation.lastOperations?.length
    ? JSON.stringify(input.context.conversation.lastOperations, null, 2)
    : '[]';

  return [
    {
      role: 'system',
      content: [
        'You are a low-code schema modification planner.',
        'Return JSON only.',
        'Return exactly this shape: {"explanation":"string","operations":[...]}',
        'Use the smallest valid set of operations.',
        '',
        'Supported operations:',
        '- schema.patchProps: {"op":"schema.patchProps","nodeId":"node-id","patch":{}}',
        '- schema.patchStyle: {"op":"schema.patchStyle","nodeId":"node-id","patch":{}}',
        '  IMPORTANT for Ant Design components (Timeline, Table, Card, etc.): margin/padding on the component root often has no visible effect because AntD uses internal CSS. Instead, use CSS custom properties (CSS variables). Examples:',
        '  - Timeline label column width: {"--ant-timeline-item-label-width": "40px"}',
        '  - Timeline moving left = shrink label width, not marginLeft',
        '  - Card body padding: {"--ant-card-body-padding": "12px"}',
        '- schema.patchEvents: {"op":"schema.patchEvents","nodeId":"node-id","patch":{}}',
        '- schema.patchLogic: {"op":"schema.patchLogic","nodeId":"node-id","patch":{}}',
        '- schema.patchColumns: {"op":"schema.patchColumns","nodeId":"node-id","columns":[]}',
        '  Each column: {"title":"列名","dataIndex":"field","key":"field"}',
        '  Action columns with render buttons MUST use JSFunction format:',
        '  {"title":"操作","key":"action","render":{"type":"JSFunction","params":["_","record"],"body":"return {component:\'Button\',id:\'btn-\'+record.key,props:{type:\'link\',size:\'small\'},children:[\'查看\']};"}  }',
        '  IMPORTANT: render must be {"type":"JSFunction","params":[...],"body":"..."} – never use plain objects like {"type":"button","text":"查看"}.',
        '- schema.insertNode: for inserting new nodes. Return a SKELETON with description and components:',
        '  {"op":"schema.insertNode","parentId":"node-id","index":0,"description":"插入一个主要操作按钮","components":["Button"]}',
        '  OR for root appends: {"op":"schema.insertNode","container":"body","description":"...","components":[...]}',
        '  The description tells what to generate. The components array lists the component types needed (e.g. ["Button"], ["Form","Input","Select"]).',
        '  A separate step will generate the full node schema with detailed component contracts.',
        '- schema.removeNode: {"op":"schema.removeNode","nodeId":"node-id"}',
        '- schema.replace: {"op":"schema.replace","description":"...","components":[...]}',
        '',
        'Rules:',
        '- nodeId and parentId must reference schema node ids from the provided schema tree.',
        '- Prefer patch operations over schema.replace when a local edit is enough.',
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
    },
    {
      role: 'user',
      content: [
        `Prompt: ${input.request.prompt}`,
        `Schema Summary: ${input.context.document.summary}`,
        ...(selectedNodeHint ? [selectedNodeHint] : []),
        'Schema Tree:',
        documentTree,
        'Conversation History:',
        conversationHistory,
        'Last Successful Operations:',
        lastOperations,
      ].join('\n'),
    },
  ];
}

// ---------------------------------------------------------------------------
//  Phase 2: InsertNode generation prompt (with component contracts)
// ---------------------------------------------------------------------------

function createInsertNodeMessages(
  skeleton: PlanInsertNodeSkeleton,
  input: ModifySchemaInput,
): OpenAICompatibleMessage[] {
  const componentContracts = getComponentSchemaContracts(skeleton.components ?? []);
  const documentTree = input.context.document.tree ?? '';

  const parentInfo = skeleton.parentId
    ? `Parent node: ${skeleton.parentId}`
    : skeleton.container
      ? `Container: ${skeleton.container} (root level)`
      : 'Append to page body';
  const indexInfo = skeleton.index !== undefined ? `Insert position: index=${skeleton.index}` : 'Append at end';

  return [
    {
      role: 'system',
      content: [
        'You are a low-code schema node generator.',
        'Return JSON only: {"node": {...}}',
        'The node MUST follow the component contracts below.',
        '',
        '## Component Contracts',
        componentContracts,
        '',
        '## Rules',
        '- node MUST have "id" (unique kebab-case string) and "component" field.',
        '- Text content goes in top-level "children" (NOT "props.children").',
        '- Use the schema-example format from contracts above.',
        '- Generate realistic Chinese business content when applicable.',
        '- Each nested node MUST have a unique "id".',
        '- Keep the node structure minimal and clean.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Task: ${skeleton.description ?? 'Generate a node'}`,
        parentInfo,
        indexInfo,
        '',
        'Schema Tree (for context):',
        documentTree,
      ].join('\n'),
    },
  ];
}

// ---------------------------------------------------------------------------
//  executeModifySchema: two-phase orchestration
// ---------------------------------------------------------------------------

export async function executeModifySchema(
  input: ModifySchemaInput,
  trace?: { modify?: ModifySchemaTraceEntry },
): Promise<ModifyResult> {
  if (!input.request.context.schemaJson) {
    throw new LLMError('modifySchema requires context.schemaJson', 'MISSING_SCHEMA_CONTEXT');
  }

  const requestedModel = input.request.blockModel ?? env.AI_BLOCK_MODEL;
  const modelRef = parseProviderModelRef(requestedModel);
  const client = createClient(modelRef.provider);
  const model = requireModel(modelRef.model ?? requestedModel);
  const thinking = getThinking(input.request);
  const provider = modelRef.provider ?? env.AI_PROVIDER;

  // ========================
  // Phase 1: Plan
  // ========================
  const planMessages = createPlanMessages(input);
  const planRequestSummary = {
    provider,
    ...client.buildRequestDebugSummary(model, planMessages, thinking, false),
  };
  const { content: planText } = await client.chat(model, planMessages, thinking);
  const planParsed = extractJson<unknown>(planText, 'modify', input.request, model);
  if (!isPlanResult(planParsed)) {
    throw new LLMError('modifySchema planner returned an invalid result shape', 'INVALID_MODIFY_RESULT');
  }

  // Separate simple ops (ready to execute) from complex ops (need Phase 2)
  const simpleOps: AgentOperation[] = [];
  const complexEntries: Array<{ index: number; skeleton: PlanInsertNodeSkeleton }> = [];

  for (const [index, op] of planParsed.operations.entries()) {
    if (needsPhase2(op)) {
      complexEntries.push({ index, skeleton: op as PlanInsertNodeSkeleton });
    } else {
      simpleOps.push(op as AgentOperation);
    }
  }

  // ========================
  // Fast path: no complex ops
  // ========================
  if (complexEntries.length === 0) {
    const result: ModifyResult = {
      explanation: planParsed.explanation,
      operations: simpleOps,
    };
    if (trace) {
      trace.modify = {
        requestSummary: planRequestSummary,
        model,
        rawOutput: planText,
        normalizedResult: result,
      };
    }
    return result;
  }

  // ========================
  // Phase 2: Execute complex insertNode ops with component contracts
  // ========================
  const executeTraces: NonNullable<ModifySchemaTraceEntry['executeTraces']> = [];
  const executedOps: Array<{ index: number; operation: AgentOperation }> = [];

  // Execute Phase 2 calls in parallel
  const phase2Tasks = complexEntries.map(async ({ index, skeleton }) => {
    const insertMessages = createInsertNodeMessages(skeleton, input);
    const insertRequestSummary = {
      provider,
      ...client.buildRequestDebugSummary(model, insertMessages, thinking, false),
    };

    try {
      const { content: insertText } = await client.chat(model, insertMessages, thinking);
      const insertParsed = extractJson<unknown>(insertText, 'modify-insertNode', input.request, model);

      let node: unknown;
      if (isRecord(insertParsed) && 'node' in insertParsed) {
        node = insertParsed.node;
      } else if (isRecord(insertParsed) && 'component' in insertParsed) {
        // LLM returned the node directly instead of wrapped in {node: ...}
        node = insertParsed;
      } else {
        throw new LLMError('Phase 2 insertNode returned invalid shape', 'INVALID_INSERT_NODE_RESULT');
      }

      executeTraces.push({
        operationIndex: index,
        requestSummary: insertRequestSummary,
        rawOutput: insertText,
        generatedNode: node,
      });

      const finalOp: AgentOperation = {
        op: 'schema.insertNode',
        ...(skeleton.parentId ? { parentId: skeleton.parentId } : {}),
        ...(skeleton.container ? { container: skeleton.container } : {}),
        ...(skeleton.index !== undefined ? { index: skeleton.index } : {}),
        node: node as AgentOperation extends { op: 'schema.insertNode'; node: infer N } ? N : never,
      } as AgentOperation;

      executedOps.push({ index, operation: finalOp });
    } catch (error) {
      // Fallback: generate a placeholder Typography.Text node
      logger.error('modify.phase2_insertNode_failed', {
        operationIndex: index,
        error: error instanceof Error ? error.message : String(error),
      });
      executeTraces.push({
        operationIndex: index,
        requestSummary: insertRequestSummary,
        rawOutput: error instanceof Error ? error.message : String(error),
      });

      const fallbackOp: AgentOperation = {
        op: 'schema.insertNode',
        ...(skeleton.parentId ? { parentId: skeleton.parentId } : {}),
        ...(skeleton.container ? { container: skeleton.container } : {}),
        ...(skeleton.index !== undefined ? { index: skeleton.index } : {}),
        node: {
          id: `generated-${index}-${Date.now().toString(36)}`,
          component: 'Typography.Text',
          props: { type: 'secondary' },
          children: skeleton.description ?? '(生成失败，请重试)',
        },
      } as AgentOperation;

      executedOps.push({ index, operation: fallbackOp });
    }
  });

  await Promise.all(phase2Tasks);

  // Merge: rebuild operations array in original order
  const mergedOps: AgentOperation[] = [];
  let simpleIdx = 0;
  for (const [planIdx, planOp] of planParsed.operations.entries()) {
    const executed = executedOps.find((e) => e.index === planIdx);
    if (executed) {
      mergedOps.push(executed.operation);
    } else {
      mergedOps.push(simpleOps[simpleIdx]!);
      simpleIdx += 1;
    }
  }

  const result: ModifyResult = {
    explanation: planParsed.explanation,
    operations: mergedOps,
  };

  if (trace) {
    trace.modify = {
      requestSummary: planRequestSummary,
      model,
      rawOutput: planText,
      normalizedResult: result,
      executeTraces,
    };
  }

  return result;
}
