import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createInMemoryAgentMemoryStore } from '@shenbi/ai-agents';
import {
  assessBlockQuality,
  attachTraceMemory,
  attachTraceMemoryBestEffort,
  classifyPromptToPageType,
  createAgentRuntime,
  validateGeneratedBlockNode,
  validateGeneratedBlockNodeWithDiagnostics,
} from './agent-runtime.ts';

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
    if (char === '{') {
      stack.push(char);
      continue;
    }
    if (char === '[') {
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

function trySalvageJsonCandidate(text: string): { candidate: string; strategy: string } | null {
  const extracted = findBalancedJsonObject(text);
  if (extracted) {
    return { candidate: extracted, strategy: 'balanced_object' };
  }

  const trimmed = text.trim();
  for (let trimCount = 1; trimCount <= Math.min(24, trimmed.length); trimCount += 1) {
    const candidate = trimmed.slice(0, trimmed.length - trimCount).trimEnd();
    if (!candidate) {
      break;
    }
    try {
      JSON.parse(candidate);
      return { candidate, strategy: 'trimmed_trailing_noise' };
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
    return { candidate: base, strategy: 'balanced_object' };
  }
  if (openCount < closeCount) {
    let truncated = base;
    while (truncated.length > 0) {
      truncated = truncated.trimEnd().slice(0, -1);
      if (!truncated) {
        break;
      }
      const nextOpenCount = countOutsideStrings(truncated, '{');
      const nextCloseCount = countOutsideStrings(truncated, '}');
      if (nextOpenCount === nextCloseCount) {
        return {
          candidate: truncated.trim(),
          strategy: 'trimmed_extra_closing_braces',
        };
      }
      if (nextCloseCount < nextOpenCount) {
        break;
      }
    }
    return null;
  }

  return null;
}

function resolveTracePath(name: string): string {
  const candidates = [
    resolve(process.cwd(), 'src', 'runtime', '__fixtures__', 'traces', name),
    resolve(process.cwd(), '.ai-debug', 'traces', name),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`missing trace fixture: ${name}`);
  }
  return found;
}

function hasTraceFixture(name: string): boolean {
  return existsSync(resolve(process.cwd(), 'src', 'runtime', '__fixtures__', 'traces', name))
    || existsSync(resolve(process.cwd(), '.ai-debug', 'traces', name));
}

function loadTrace(name: string): any {
  const tracePath = resolveTracePath(name);
  return JSON.parse(readFileSync(tracePath, 'utf8'));
}

function listMemoryDumps(): string[] {
  const dumpDir = resolve(process.cwd(), '.ai-debug', 'memory');
  try {
    return readdirSync(dumpDir).filter((name) => name.endsWith('-finalize.json'));
  } catch {
    return [];
  }
}

function findMemoryDump(
  names: string[],
  conversationId: string,
  sessionId: string,
): any {
  const dumpDir = resolve(process.cwd(), '.ai-debug', 'memory');
  const latest = [...names]
    .reverse()
    .map((name) => ({
      name,
      path: resolve(dumpDir, name),
      dump: JSON.parse(readFileSync(resolve(dumpDir, name), 'utf8')),
    }))
    .find((entry) =>
      entry.dump?.memory?.request?.conversationId === conversationId
      && entry.dump?.memory?.request?.sessionId === sessionId);
  if (!latest) {
    throw new Error(`Expected a memory dump for ${conversationId}/${sessionId}`);
  }
  return latest.dump;
}

describe('agent runtime json salvage', () => {
  it('salvages near-valid json with trailing missing braces', () => {
    const raw = '```json\n{"component":"Card","children":[{"component":"Button","children":["确定"]}]\n```';
    const candidate = extractJsonCandidate(raw);
    const salvaged = trySalvageJsonCandidate(candidate);
    expect(salvaged?.strategy).toBe('appended_missing_braces');
    const parsed = JSON.parse(salvaged!.candidate);
    expect(parsed).toMatchObject({ component: 'Card' });
    expect(Array.isArray(parsed.children)).toBe(true);
    expect(parsed.children).toHaveLength(1);
  });

  it('salvages near-valid json with extra trailing closing braces', () => {
    const raw = '{"component":"Card","children":[{"component":"Tag","children":["在职"]}]}]}}]}';
    const salvaged = trySalvageJsonCandidate(raw);
    expect(salvaged?.candidate).toBe('{"component":"Card","children":[{"component":"Tag","children":["在职"]}]}');
    expect(salvaged?.strategy).toBe('balanced_object');
    expect(JSON.parse(salvaged!.candidate)).toMatchObject({ component: 'Card' });
  });

  it('salvages near-valid json with extra trailing mixed brackets', () => {
    const raw = '{"component":"Card","children":[{"component":"Timeline","children":[{"component":"Timeline.Item","children":["持续发展"]}]}]}}]}';
    const salvaged = trySalvageJsonCandidate(raw);
    expect(salvaged?.candidate).toBe('{"component":"Card","children":[{"component":"Timeline","children":[{"component":"Timeline.Item","children":["持续发展"]}]}]}');
    expect(salvaged?.strategy).toBe('balanced_object');
    expect(JSON.parse(salvaged!.candidate)).toMatchObject({ component: 'Card' });
  });

  it('salvages near-valid json with extra trailing tokens after valid object', () => {
    const raw = '{"component":"Container","children":[{"component":"Typography.Text","children":["ok"]}]}]}';
    const salvaged = trySalvageJsonCandidate(raw);
    expect(salvaged?.candidate).toBe('{"component":"Container","children":[{"component":"Typography.Text","children":["ok"]}]}');
    expect(salvaged?.strategy).toBe('balanced_object');
    expect(JSON.parse(salvaged!.candidate)).toMatchObject({ component: 'Container' });
  });

  it('salvages near-valid json with mismatched closing token inside array', () => {
    const raw = '{"component":"Descriptions.Item","props":{"label":"工作地点"},"children":["北京市朝阳区科技园区A座15层"}';
    const salvaged = trySalvageJsonCandidate(raw);
    expect(salvaged?.strategy).toBe('appended_missing_braces');
    const parsed = JSON.parse(salvaged!.candidate);
    expect(parsed).toMatchObject({ component: 'Descriptions.Item' });
    expect(Array.isArray(parsed.children)).toBe(true);
    expect(parsed.children[0]).toBe('北京市朝阳区科技园区A座15层');
  });
});

describe('agent runtime finalize', () => {
  it('patches confirmed schemaDigest onto the matching assistant message on success', async () => {
    const memory = createInMemoryAgentMemoryStore();
    const runtime = createAgentRuntime(memory);
    const conversationId = 'conv-finalize-success';
    const sessionId = 'run-finalize-success';

    await memory.appendConversationMessage(conversationId, {
      role: 'assistant',
      text: 'Planning page structure.',
      meta: {
        sessionId,
        intent: 'schema.create',
      },
    });

    await expect(runtime.finalize({
      conversationId,
      sessionId,
      success: true,
      schemaDigest: 'fnv1a-12345678',
    })).resolves.toEqual({
      memoryDebugFile: expect.stringContaining('.ai-debug'),
    });
    const dump = findMemoryDump(listMemoryDumps(), conversationId, sessionId);

    await expect(memory.getConversation(conversationId)).resolves.toEqual([
      {
        role: 'assistant',
        text: 'Planning page structure.',
        meta: {
          sessionId,
          intent: 'schema.create',
          schemaDigest: 'fnv1a-12345678',
        },
      },
    ]);
    expect(dump.memory).toMatchObject({
      request: {
        conversationId,
        sessionId,
        success: true,
        schemaDigest: 'fnv1a-12345678',
      },
      outcome: 'patched',
      before: {
        assistantMessage: {
          text: 'Planning page structure.',
          meta: {
            intent: 'schema.create',
          },
        },
      },
      after: {
        assistantMessage: {
          text: 'Planning page structure.',
          meta: {
            intent: 'schema.create',
            schemaDigest: 'fnv1a-12345678',
          },
        },
      },
    });
  });

  it('marks the matching assistant message as failed and clears operations on failure', async () => {
    const memory = createInMemoryAgentMemoryStore();
    const runtime = createAgentRuntime(memory);
    const conversationId = 'conv-finalize-failure';
    const sessionId = 'run-finalize-failure';

    await memory.appendConversationMessage(conversationId, {
      role: 'assistant',
      text: '会更新当前卡片标题。',
      meta: {
        sessionId,
        intent: 'schema.modify',
        operations: [{ op: 'schema.patchProps', nodeId: 'card-1', patch: { title: '本月营收' } }],
      },
    });

    await expect(runtime.finalize({
      conversationId,
      sessionId,
      success: false,
      error: 'op 1 failed',
      schemaDigest: 'fnv1a-deadbeef',
    })).resolves.toEqual({
      memoryDebugFile: expect.stringContaining('.ai-debug'),
    });
    const dump = findMemoryDump(listMemoryDumps(), conversationId, sessionId);

    await expect(memory.getConversation(conversationId)).resolves.toEqual([
      {
        role: 'assistant',
        text: '[修改失败] op 1 failed\n会更新当前卡片标题。',
        meta: {
          sessionId,
          intent: 'schema.modify',
          failed: true,
          schemaDigest: 'fnv1a-deadbeef',
        },
      },
    ]);
    expect(dump.memory).toMatchObject({
      request: {
        conversationId,
        sessionId,
        success: false,
        error: 'op 1 failed',
        schemaDigest: 'fnv1a-deadbeef',
      },
      outcome: 'patched',
      before: {
        assistantMessage: {
          meta: {
            operations: [{ op: 'schema.patchProps', nodeId: 'card-1', patch: { title: '本月营收' } }],
          },
        },
      },
      after: {
        assistantMessage: {
          text: '[修改失败] op 1 failed\n会更新当前卡片标题。',
          meta: {
            failed: true,
            schemaDigest: 'fnv1a-deadbeef',
          },
        },
      },
    });
    expect(dump.memory.after.assistantMessage.meta.operations).toBeUndefined();
  });
});

describe('agent runtime trace memory', () => {
  it('writes assistant memory meta into the success trace after run', async () => {
    const sessionId = 'trace-session-1';
    const conversationId = 'trace-memory-conv';
    const memory = {
      async getConversation() {
        return [
          { role: 'user', text: 'hi' },
          {
            role: 'assistant',
            text: 'hello back',
            meta: {
              sessionId,
              intent: 'chat',
            },
          },
        ];
      },
      async appendConversationMessage() {},
      async getLastRunMetadata() {
        return {
          sessionId,
          conversationId,
        };
      },
      async setLastRunMetadata() {},
      async getLastBlockIds() {
        return [];
      },
      async setLastBlockIds() {},
    };
    const trace: {
      request: {
        prompt: string;
        conversationId: string;
        context: {
          schemaSummary: string;
          componentSummary: string;
        };
      };
      blocks: never[];
      memory?: unknown;
    } = {
      request: {
        prompt: 'hi',
        conversationId,
        context: {
          schemaSummary: 'Existing dashboard',
          componentSummary: 'Card',
        },
      },
      blocks: [],
    };

    await attachTraceMemory(trace as never, memory as never, conversationId, sessionId);

    expect(trace.memory).toMatchObject({
      finalAssistantMessage: {
        role: 'assistant',
        meta: {
          sessionId,
          intent: 'chat',
        },
      },
      lastRunMetadata: {
        sessionId,
        conversationId,
      },
      lastBlockIds: [],
    });
    expect(Array.isArray((trace.memory as { conversationTail?: unknown[] }).conversationTail)).toBe(true);
  });

  it('does not throw when trace memory capture fails', async () => {
    const trace: {
      request: {
        prompt: string;
        conversationId: string;
        context: {
          schemaSummary: string;
          componentSummary: string;
        };
      };
      blocks: never[];
      memory?: unknown;
    } = {
      request: {
        prompt: 'hi',
        conversationId: 'trace-memory-fail-conv',
        context: {
          schemaSummary: 'Existing dashboard',
          componentSummary: 'Card',
        },
      },
      blocks: [],
    };
    const memory = {
      async getConversation() {
        throw new Error('memory offline');
      },
      async appendConversationMessage() {},
      async getLastRunMetadata() {
        return undefined;
      },
      async setLastRunMetadata() {},
      async getLastBlockIds() {
        return [];
      },
      async setLastBlockIds() {},
    };

    await expect(
      attachTraceMemoryBestEffort(
        trace as never,
        memory as never,
        'trace-memory-fail-conv',
        'trace-session-fail',
      ),
    ).resolves.toBeUndefined();
    expect(trace.memory).toBeUndefined();
  });
});

// ── stripArrowFunctions ──

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
      if (inBacktick) { if (ch === '`') inBacktick = false; pos++; continue; }
      if (ch === '`') { inBacktick = true; pos++; continue; }
      if (ch === ',' || ch === '}' || ch === ']') break;
      pos++;
    }
    chunks.push(text.slice(lastEnd, colonIdx), ': null');
    lastEnd = pos;
  }
  if (chunks.length === 0) return { text, stripped: false };
  chunks.push(text.slice(lastEnd));
  const result = chunks.join('');
  return { text: result, stripped: true };
}

describe('stripArrowFunctions', () => {
  it('strips simple arrow function in render field', () => {
    const input = '{"title":"逾期数","render":(text)=> text > 0}';
    const result = stripArrowFunctions(input);
    expect(result.stripped).toBe(true);
    expect(JSON.parse(result.text)).toMatchObject({ title: '逾期数', render: null });
  });

  it('strips arrow function with template literal', () => {
    const input = '{"render":(text)=> `<Tag>${text}</Tag>`,"next":"ok"}';
    const result = stripArrowFunctions(input);
    expect(result.stripped).toBe(true);
    const parsed = JSON.parse(result.text);
    expect(parsed.render).toBeNull();
    expect(parsed.next).toBe('ok');
  });

  it('does not modify valid JSON without arrow functions', () => {
    const input = '{"title":"test","value":42}';
    const result = stripArrowFunctions(input);
    expect(result.stripped).toBe(false);
    expect(result.text).toBe(input);
  });
});

describe('agent runtime quality guidance', () => {
  it('classifies workbench prompts as dashboard before detail/form', () => {
    const pageType = classifyPromptToPageType(
      '生成一个复杂工作台首页，包含筛选区、指标卡、趋势图、表格列表、右侧详情抽屉和顶部快捷操作。',
    );

    expect(pageType).toBe('dashboard');
  });

  it('classifies master-detail prompts as detail instead of list', () => {
    const pageType = classifyPromptToPageType(
      '生成一个主从详情页面：左侧树或列表，右侧 Tabs 详情区，支持查询、状态标签、操作按钮、表单编辑弹窗和底部时间线。',
    );

    expect(pageType).toBe('detail');
  });

  it('flags cramped inline filters, stacked vertical filters, and fragmented KPI rows for retry', () => {
    const filterNode = validateGeneratedBlockNode({
      component: 'Card',
      id: 'filter-card',
      children: [{
        component: 'Form',
        id: 'filter-form',
        props: { layout: 'inline' },
        children: [
          {
            component: 'Form.Item',
            id: 'range-item',
            props: { label: '日期范围', name: 'range' },
            children: [{ component: 'DatePicker.RangePicker', id: 'range-picker', props: {} }],
          },
          {
            component: 'Form.Item',
            id: 'status-item',
            props: { label: '状态', name: 'status' },
            children: [{ component: 'Select', id: 'status-select', props: {} }],
          },
          {
            component: 'Form.Item',
            id: 'keyword-item',
            props: { label: '关键词', name: 'keyword' },
            children: [{ component: 'Input', id: 'keyword-input', props: {} }],
          },
          {
            component: 'Form.Item',
            id: 'actions-item',
            props: {},
            children: [{ component: 'Button', id: 'query-btn', props: { type: 'primary' }, children: '查询' }],
          },
        ],
      }],
    }, 'filter-block');
    const filterDiagnostics = assessBlockQuality(filterNode, {
      block: {
        id: 'filter-block',
        description: '数据筛选查询区，支持日期、状态等条件',
        components: ['Form', 'Form.Item', 'DatePicker.RangePicker', 'Select', 'Input', 'Button'],
      },
    } as never);

    expect(filterDiagnostics.map((item) => item.rule)).toEqual(expect.arrayContaining([
      'filter-inline-overflow',
      'filter-actions-mixed-with-fields',
    ]));

    const verticalStackedFilterNode = validateGeneratedBlockNode({
      component: 'Card',
      id: 'filter-card-vertical',
      children: [{
        component: 'Form',
        id: 'filter-form-vertical',
        props: { layout: 'vertical' },
        children: [{
          component: 'Row',
          id: 'filter-row-vertical',
          children: [
            {
              component: 'Col',
              id: 'fields-col',
              props: { span: 6 },
              children: [
                {
                  component: 'Form.Item',
                  id: 'range-item-vertical',
                  props: { label: '日期范围', name: 'range' },
                  children: [{ component: 'DatePicker.RangePicker', id: 'range-picker-vertical', props: {} }],
                },
                {
                  component: 'Form.Item',
                  id: 'status-item-vertical',
                  props: { label: '状态', name: 'status' },
                  children: [{ component: 'Select', id: 'status-select-vertical', props: {} }],
                },
                {
                  component: 'Form.Item',
                  id: 'keyword-item-vertical',
                  props: { label: '关键词', name: 'keyword' },
                  children: [{ component: 'Input', id: 'keyword-input-vertical', props: {} }],
                },
              ],
            },
            {
              component: 'Col',
              id: 'actions-col',
              props: { span: 18 },
              children: [{
                component: 'Container',
                id: 'actions-wrap-vertical',
                props: { direction: 'row' },
                children: [{
                  component: 'Button',
                  id: 'query-btn-vertical',
                  props: { type: 'primary' },
                  children: '查询',
                }],
              }],
            },
          ],
        }],
      }],
    }, 'filter-block');
    const verticalStackedDiagnostics = assessBlockQuality(verticalStackedFilterNode, {
      block: {
        id: 'filter-block',
        description: '全宽筛选查询区，包含日期范围、状态选择和关键词搜索',
        components: ['Form', 'Form.Item', 'DatePicker.RangePicker', 'Select', 'Input', 'Button', 'Row', 'Col'],
      },
    } as never);

    expect(verticalStackedDiagnostics.map((item) => item.rule)).toContain('filter-vertical-stacked-layout');

    const horizontalFilterNode = validateGeneratedBlockNode({
      component: 'Card',
      id: 'filter-card-horizontal',
      children: [{
        component: 'Form',
        id: 'filter-form-horizontal',
        props: { layout: 'vertical' },
        children: [{
          component: 'Row',
          id: 'filter-row-horizontal',
          props: { gutter: [16, 16], align: 'bottom' },
          children: [
            {
              component: 'Col',
              id: 'keyword-col',
              props: { span: 5 },
              children: [{
                component: 'Form.Item',
                id: 'keyword-item-horizontal',
                props: { label: '关键词', name: 'keyword' },
                children: [{ component: 'Input', id: 'keyword-input-horizontal', props: {} }],
              }],
            },
            {
              component: 'Col',
              id: 'status-col',
              props: { span: 5 },
              children: [{
                component: 'Form.Item',
                id: 'status-item-horizontal',
                props: { label: '状态', name: 'status' },
                children: [{ component: 'Select', id: 'status-select-horizontal', props: {} }],
              }],
            },
            {
              component: 'Col',
              id: 'range-col',
              props: { span: 8 },
              children: [{
                component: 'Form.Item',
                id: 'range-item-horizontal',
                props: { label: '日期范围', name: 'range' },
                children: [{ component: 'DatePicker.RangePicker', id: 'range-picker-horizontal', props: {} }],
              }],
            },
            {
              component: 'Col',
              id: 'action-col-horizontal',
              props: { span: 6 },
              children: [{
                component: 'Container',
                id: 'actions-wrap-horizontal',
                props: { direction: 'row', justify: 'end' },
                children: [{
                  component: 'Space',
                  id: 'actions-horizontal',
                  children: [{
                    component: 'Button',
                    id: 'query-btn-horizontal',
                    props: { type: 'primary' },
                    children: '查询',
                  }],
                }],
              }],
            },
          ],
        }],
      }],
    }, 'filter-block');
    const horizontalDiagnostics = assessBlockQuality(horizontalFilterNode, {
      block: {
        id: 'filter-block',
        description: '全宽筛选查询区，包含日期范围、状态选择和关键词搜索',
        components: ['Form', 'Form.Item', 'DatePicker.RangePicker', 'Select', 'Input', 'Button', 'Row', 'Col'],
      },
    } as never);

    expect(horizontalDiagnostics.map((item) => item.rule)).not.toContain('filter-vertical-stacked-layout');

    const kpiNode = validateGeneratedBlockNode({
      component: 'Row',
      id: 'kpi-row',
      props: { gutter: [16, 16] },
      children: Array.from({ length: 5 }, (_, index) => ({
        component: 'Col',
        id: `kpi-col-${index + 1}`,
        props: { span: index < 4 ? 6 : 8 },
        children: [{
          component: 'Card',
          id: `kpi-card-${index + 1}`,
          props: { title: `指标 ${index + 1}` },
          children: index === 2
            ? [{ component: 'Progress', id: 'kpi-progress', props: { percent: 78 } }]
            : index === 3
              ? [{ component: 'Tag', id: 'kpi-tag', props: { color: 'red' }, children: '紧急' }]
              : [{ component: 'Statistic', id: `kpi-stat-${index + 1}`, props: { title: `指标 ${index + 1}`, value: index + 1 } }],
        }],
      })),
    }, 'kpi-block');
    const kpiDiagnostics = assessBlockQuality(kpiNode, {
      block: {
        id: 'kpi-block',
        description: '核心业务指标卡片，展示关键数值和趋势',
        components: ['Row', 'Col', 'Card', 'Statistic', 'Progress', 'Tag'],
      },
    } as never);

    expect(kpiDiagnostics.map((item) => item.rule)).toEqual(expect.arrayContaining([
      'kpi-too-many-cards',
      'kpi-tag-only-card',
      'kpi-mixed-card-structures',
    ]));
  });

  it('flags empty alerts in tab panes for retry', () => {
    const tabsNode = validateGeneratedBlockNode({
      component: 'Tabs',
      id: 'trend-tabs',
      children: [{
        component: 'Tabs.TabPane',
        id: 'tab-1',
        props: { label: '趋势' },
        children: [
          { component: 'Alert', id: 'blank-alert', props: { type: 'info' } },
          { component: 'Card', id: 'tiny-card-1', props: { title: '卡片1' } },
          { component: 'Card', id: 'tiny-card-2', props: { title: '卡片2' } },
          { component: 'Card', id: 'tiny-card-3', props: { title: '卡片3' } },
          { component: 'Card', id: 'tiny-card-4', props: { title: '卡片4' } },
          { component: 'Card', id: 'tiny-card-5', props: { title: '卡片5' } },
        ],
      }],
    }, 'tabs-block');

    const diagnostics = assessBlockQuality(tabsNode, {
      block: {
        id: 'tabs-block',
        description: '趋势分析 Tabs 区域',
        components: ['Tabs', 'Alert', 'Card'],
      },
    } as never);

    expect(diagnostics.map((item) => item.rule)).toEqual(expect.arrayContaining([
      'alert-missing-copy',
      'tab-pane-fragmented-layout',
    ]));
  });

  it('flags empty buttons in header and filter action regions', () => {
    const headerNode = validateGeneratedBlockNode({
      component: 'Container',
      id: 'header-actions',
      children: [{
        component: 'Button',
        id: 'settings-btn',
        props: { type: 'text' },
        children: [],
      }],
    }, 'header-block');
    const filterNode = validateGeneratedBlockNode({
      component: 'Form',
      id: 'filter-form',
      props: { layout: 'vertical' },
      children: [{
        component: 'Container',
        id: 'actions-wrap',
        props: { direction: 'row' },
        children: [{
          component: 'Button',
          id: 'search-btn',
          props: { type: 'primary' },
          children: [],
        }],
      }],
    }, 'filter-block');

    const headerDiagnostics = assessBlockQuality(headerNode, {
      block: {
        id: 'header-block',
        description: '页面标题和顶部主操作按钮组',
        components: ['Button', 'Space'],
      },
    } as never);
    const filterDiagnostics = assessBlockQuality(filterNode, {
      block: {
        id: 'filter-block',
        description: '筛选区和查询按钮',
        components: ['Form', 'Button'],
      },
    } as never);

    expect(headerDiagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        rule: 'button-missing-text',
        severity: 'retry',
      }),
    ]));
    expect(filterDiagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        rule: 'button-missing-text',
        severity: 'retry',
      }),
    ]));
  });

  it('flags multiline text buttons and overdense content in narrow master list blocks', () => {
    const masterListNode = validateGeneratedBlockNode({
      component: 'Card',
      id: 'master-list-block',
      props: { title: '主数据列表' },
      children: [{
        component: 'Container',
        id: 'list-container',
        props: { direction: 'column', gap: 8 },
        children: [{
          component: 'Button',
          id: 'master-item-1',
          props: {
            type: 'text',
            block: true,
            style: { textAlign: 'left', padding: '8px 12px' },
          },
          children: [{
            component: 'Space',
            id: 'master-item-space',
            props: { direction: 'vertical', size: 0 },
            children: [
              {
                component: 'Typography.Text',
                id: 'master-item-title',
                props: { strong: true },
                children: '主数据项目 001',
              },
              {
                component: 'Space',
                id: 'master-item-meta',
                props: { size: 'small' },
                children: [
                  { component: 'Tag', id: 'master-tag-1', props: { color: 'green' }, children: '启用' },
                  { component: 'Tag', id: 'master-tag-2', props: { color: 'blue' }, children: '已同步' },
                ],
              },
              {
                component: 'Typography.Text',
                id: 'master-item-desc',
                props: { type: 'secondary' },
                children: '描述信息：这是第一条主数据的详细描述，内容偏长。',
              },
            ],
          }],
        }],
      }],
    }, 'master-list-block');

    const diagnostics = assessBlockQuality(masterListNode, {
      block: {
        id: 'master-list-block',
        description: '左侧主数据列表，支持查询和选中状态',
        components: ['Card', 'Form', 'Form.Item', 'Input', 'Tag', 'Button', 'Container', 'Typography.Text'],
      },
    } as never);

    expect(diagnostics.map((item) => item.rule)).toEqual(expect.arrayContaining([
      'master-list-button-card-layout',
      'side-list-overdense',
    ]));
  });

  it.runIf(hasTraceFixture('2026-03-09T06-20-11-463Z-success.json'))('regresses the 2026-03-09 workbench trace with quality diagnostics', () => {
    const trace = loadTrace('2026-03-09T06-20-11-463Z-success.json');
    const blocks = trace.trace.blocks as Array<{ blockId: string; rawOutput: string; description: string; suggestedComponents: string[] }>;
    const filterBlock = blocks.find((block) => block.blockId === 'filter-block');
    const kpiBlock = blocks.find((block) => block.blockId === 'kpi-block');
    const tabsBlock = blocks.find((block) => block.suggestedComponents.includes('Tabs'));

    expect(filterBlock).toBeTruthy();
    expect(kpiBlock).toBeTruthy();
    expect(tabsBlock).toBeTruthy();

    const normalizedFilter = validateGeneratedBlockNode(JSON.parse(filterBlock!.rawOutput), filterBlock!.blockId);
    const normalizedKpi = validateGeneratedBlockNode(JSON.parse(kpiBlock!.rawOutput), kpiBlock!.blockId);
    const normalizedTabs = validateGeneratedBlockNode(JSON.parse(tabsBlock!.rawOutput), tabsBlock!.blockId);

    const filterDiagnostics = assessBlockQuality(normalizedFilter, {
      block: {
        id: filterBlock!.blockId,
        description: filterBlock!.description,
        components: filterBlock!.suggestedComponents,
      },
    } as never);
    const kpiDiagnostics = assessBlockQuality(normalizedKpi, {
      block: {
        id: kpiBlock!.blockId,
        description: kpiBlock!.description,
        components: kpiBlock!.suggestedComponents,
      },
    } as never);
    const tabsDiagnostics = assessBlockQuality(normalizedTabs, {
      block: {
        id: tabsBlock!.blockId,
        description: tabsBlock!.description,
        components: tabsBlock!.suggestedComponents,
      },
    } as never);

    expect(filterDiagnostics.map((item) => item.rule)).toContain('filter-inline-overflow');
    expect(kpiDiagnostics.map((item) => item.rule)).toContain('kpi-too-many-cards');
    expect(kpiDiagnostics.map((item) => item.rule)).toContain('kpi-mixed-card-structures');

    let alertMessage: string | undefined;
    walkTraceNodes(normalizedTabs, (node) => {
      if (node.component === 'Alert' && typeof node.props?.message === 'string') {
        alertMessage = node.props.message;
      }
    });
    expect(alertMessage).toBeTruthy();
    expect(tabsDiagnostics.map((item) => item.rule)).not.toContain('alert-missing-copy');
  });

  it.runIf(hasTraceFixture('2026-03-09T06-39-06-634Z-success.json'))('regresses the 2026-03-09 filter trace for legacy children and fake form labels', () => {
    const trace = loadTrace('2026-03-09T06-39-06-634Z-success.json');
    const blocks = trace.trace.blocks as Array<{ blockId: string; rawOutput: string; description: string; suggestedComponents: string[] }>;
    const filterBlock = blocks.find((block) => block.blockId === 'filter-block');
    const headerBlock = blocks.find((block) => block.blockId === 'header-block');

    expect(filterBlock).toBeTruthy();
    expect(headerBlock).toBeTruthy();

    const normalizedFilter = validateGeneratedBlockNode(JSON.parse(filterBlock!.rawOutput), filterBlock!.blockId);
    const normalizedHeader = validateGeneratedBlockNode(JSON.parse(headerBlock!.rawOutput), headerBlock!.blockId);

    const labels: string[] = [];
    const buttonTexts: string[] = [];
    walkTraceNodes(normalizedFilter, (node) => {
      if (node.component === 'Form.Item' && typeof node.props?.label === 'string') {
        labels.push(node.props.label);
      }
      if (node.component === 'Button' && typeof node.children === 'string') {
        buttonTexts.push(node.children);
      }
    });

    expect(labels).not.toContain('字段1');
    expect(labels).not.toContain('字段2');
    expect(buttonTexts).toEqual(expect.arrayContaining(['重置', '查询']));

    const headerDiagnostics = assessBlockQuality(normalizedHeader, {
      block: {
        id: headerBlock!.blockId,
        description: headerBlock!.description,
        components: headerBlock!.suggestedComponents,
      },
    } as never);

    expect(headerDiagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        rule: 'button-missing-text',
      }),
    ]));
  });

  it.runIf(hasTraceFixture('2026-03-09T06-56-41-203Z-success.json'))('regresses the 2026-03-09 dashboard filter trace for vertical stacked layout drift', () => {
    const trace = loadTrace('2026-03-09T06-56-41-203Z-success.json');
    const blocks = trace.trace.blocks as Array<{ blockId: string; rawOutput: string; description: string; suggestedComponents: string[] }>;
    const filterBlock = blocks.find((block) => block.blockId === 'filter-block');

    expect(filterBlock).toBeTruthy();

    const normalizedFilter = validateGeneratedBlockNode(JSON.parse(filterBlock!.rawOutput), filterBlock!.blockId);
    const filterDiagnostics = assessBlockQuality(normalizedFilter, {
      block: {
        id: filterBlock!.blockId,
        description: filterBlock!.description,
        components: filterBlock!.suggestedComponents,
      },
    } as never);

    expect(filterDiagnostics.map((item) => item.rule)).toContain('filter-vertical-stacked-layout');
    expect(filterDiagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        rule: 'filter-vertical-stacked-layout',
        severity: 'retry',
      }),
    ]));
  });

  it.runIf(hasTraceFixture('2026-03-09T07-29-56-720Z-success.json'))('regresses the 2026-03-09 master-detail trace for misclassification and left list layout drift', () => {
    const trace = loadTrace('2026-03-09T07-29-56-720Z-success.json');
    const prompt = trace.trace.request.prompt as string;
    const blocks = trace.trace.blocks as Array<{ blockId: string; rawOutput: string; description: string; suggestedComponents: string[] }>;
    const masterListBlock = blocks.find((block) => block.blockId === 'master-list-block');

    expect(classifyPromptToPageType(prompt)).toBe('detail');
    expect(masterListBlock).toBeTruthy();

    const validated = validateGeneratedBlockNodeWithDiagnostics(
      JSON.parse(masterListBlock!.rawOutput),
      masterListBlock!.blockId,
    );
    const diagnostics = assessBlockQuality(validated.node, {
      block: {
        id: masterListBlock!.blockId,
        description: masterListBlock!.description,
        components: masterListBlock!.suggestedComponents,
      },
    } as never);

    expect(validated.diagnostics).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        componentType: 'Button',
        propPath: 'style',
        action: 'drop',
      }),
    ]));
    expect(diagnostics.map((item) => item.rule)).toEqual(expect.arrayContaining([
      'master-list-button-card-layout',
      'side-list-overdense',
    ]));
  });

  it.runIf(hasTraceFixture('2026-03-09T07-48-49-880Z-success.json'))('regresses the 2026-03-09 complex form trace for fake field labels on section nodes', () => {
    const trace = loadTrace('2026-03-09T07-48-49-880Z-success.json');
    const blocks = trace.trace.blocks as Array<{ blockId: string; rawOutput: string; description: string; suggestedComponents: string[] }>;
    const formBlock = blocks.find((block) => block.blockId === 'form-main-block');

    expect(formBlock).toBeTruthy();

    const validated = validateGeneratedBlockNodeWithDiagnostics(
      JSON.parse(formBlock!.rawOutput),
      formBlock!.blockId,
    );

    const labels: string[] = [];
    const textNodes: string[] = [];
    walkTraceNodes(validated.node, (node) => {
      if (node.component === 'Form.Item' && typeof node.props?.label === 'string') {
        labels.push(node.props.label);
      }
      if (node.component === 'Typography.Text' && typeof node.children === 'string') {
        textNodes.push(node.children);
      }
    });

    expect(labels).not.toEqual(expect.arrayContaining(['字段1', '字段2', '字段5', '字段6']));
    expect(textNodes).toEqual(expect.arrayContaining(['基础信息', '日程与分组']));
    expect(validated.diagnostics).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        componentType: 'Form',
        rule: 'preserved-non-field-form-child',
      }),
    ]));
  });
});

function walkTraceNodes(
  value: any,
  visitor: (node: any) => void,
): void {
  if (!value) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => walkTraceNodes(item, visitor));
    return;
  }
  if (typeof value !== 'object' || !('component' in value)) {
    return;
  }
  visitor(value);
  walkTraceNodes(value.children, visitor);
}

describe('validateGeneratedBlockNode', () => {
  it('wraps array roots into a valid container block', () => {
    const normalized = validateGeneratedBlockNode([
      { component: 'Card', props: { title: '状态概览' } },
      { component: 'Card', props: { title: '快捷入口' } },
    ] as any, 'status-summary');

    expect(normalized.component).toBe('Container');
    expect(Array.isArray(normalized.children)).toBe(true);
    expect((normalized.children as Array<{ component: string }>).map((child) => child.component)).toEqual(['Card', 'Card']);
  });

  it.runIf(hasTraceFixture('2026-03-09T04-55-55-917Z-success.json'))('reproduces the trace fix for form, tabs, and status summary blocks', () => {
    const tracePath = resolveTracePath('2026-03-09T04-55-55-917Z-success.json');
    const trace = JSON.parse(readFileSync(tracePath, 'utf8')) as {
      trace: {
        blocks: Array<{
          blockId: string;
          rawOutput: string;
        }>;
      };
    };

    const blockMap = Object.fromEntries(trace.trace.blocks.map((block) => [block.blockId, block.rawOutput]));
    const filterNode = validateGeneratedBlockNode(JSON.parse(blockMap['filter-bar']!), 'filter-bar');
    const tabsNode = validateGeneratedBlockNode(JSON.parse(blockMap['data-tabs']!), 'data-tabs');
    const statusNode = validateGeneratedBlockNode(JSON.parse(blockMap['status-summary']!), 'status-summary');

    const form = (filterNode.children as any[])[0];
    const formChildren = form?.children as Array<{ component: string; children?: any[] }>;
    expect(formChildren.some((child) => child.component === 'Form.Item')).toBe(true);
    expect(formChildren.some((child) => child.component === 'FormItem')).toBe(false);
    expect(JSON.stringify(filterNode)).toContain('DatePicker.RangePicker');

    expect(tabsNode.component).toBe('Tabs');
    expect(Array.isArray(tabsNode.children)).toBe(true);
    expect(((tabsNode.children as any[])[0]?.component)).toBe('Tabs.TabPane');

    expect(statusNode.component).toBe('Container');
    expect(Array.isArray(statusNode.children)).toBe(true);
    expect(JSON.stringify(statusNode)).not.toContain('[[{');
  });

  it.runIf(hasTraceFixture('2026-03-09T05-32-28-171Z-success.json'))('drops invalid function props from the pagination trace and records diagnostics', () => {
    const tracePath = resolveTracePath('2026-03-09T05-32-28-171Z-success.json');
    const trace = JSON.parse(readFileSync(tracePath, 'utf8')) as {
      trace: {
        blocks: Array<{
          blockId: string;
          rawOutput: string;
        }>;
      };
    };

    const paginationBlock = trace.trace.blocks.find((block) => block.blockId === 'main-data-block');
    expect(paginationBlock).toBeDefined();
    const parsedNode = JSON.parse(paginationBlock!.rawOutput);
    const result = validateGeneratedBlockNodeWithDiagnostics(parsedNode, 'pagination-block');

    expect(JSON.stringify(result.node)).not.toContain('"showTotal":"(total => `共 ${total} 条`)"');
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        componentType: 'Pagination',
        propPath: 'showTotal',
        action: 'drop',
      }),
    ]));
  });

  it.runIf(hasTraceFixture('2026-03-09T06-06-00-103Z-success.json'))('reproduces the table title regression fix from the 2026-03-09 trace', () => {
    const tracePath = resolveTracePath('2026-03-09T06-06-00-103Z-success.json');
    const trace = JSON.parse(readFileSync(tracePath, 'utf8')) as {
      trace: {
        blocks: Array<{
          blockId: string;
          rawOutput: string;
        }>;
      };
    };

    const tabsBlock = trace.trace.blocks.find((block) => block.blockId === 'main-content-tabs');
    expect(tabsBlock).toBeDefined();
    const parsedNode = JSON.parse(tabsBlock!.rawOutput);
    const result = validateGeneratedBlockNodeWithDiagnostics(parsedNode, 'main-content-tabs');
    const serialized = JSON.stringify(result.node);

    expect(serialized).not.toContain('"title":"订单列表"');
    expect(serialized).toContain('"pagination":false');
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        componentType: 'Table',
        propPath: 'title',
        action: 'drop',
        rule: 'unknown prop',
      }),
    ]));
  });
});

