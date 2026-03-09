import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateGeneratedBlockNode, validateGeneratedBlockNodeWithDiagnostics } from './agent-runtime.ts';

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

  it('reproduces the trace fix for form, tabs, and status summary blocks', () => {
    const tracePath = resolve(process.cwd(), '.ai-debug', 'traces', '2026-03-09T04-55-55-917Z-success.json');
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

  it('drops invalid function props from the pagination trace and records diagnostics', () => {
    const tracePath = resolve(process.cwd(), '.ai-debug', 'traces', '2026-03-09T05-32-28-171Z-success.json');
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

  it('reproduces the table title regression fix from the 2026-03-09 trace', () => {
    const tracePath = resolve(process.cwd(), '.ai-debug', 'traces', '2026-03-09T06-06-00-103Z-success.json');
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

