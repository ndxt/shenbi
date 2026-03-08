import { describe, expect, it } from 'vitest';

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

// ── resolvePlanConflicts ──

type ZoneType = 'page-header' | 'filter' | 'kpi-row' | 'data-table' | 'detail-info' | 'form-body' | 'form-actions' | 'chart-area' | 'timeline-area' | 'side-info' | 'empty-state' | 'custom';

interface BlockPlan {
  id: string;
  type: ZoneType;
  description: string;
  components: string[];
  priority: number;
  complexity: 'simple' | 'medium' | 'complex';
}

const leafZoneTypes: ReadonlySet<ZoneType> = new Set<ZoneType>([
  'detail-info', 'data-table', 'timeline-area', 'chart-area', 'side-info',
  'kpi-row', 'filter', 'form-body', 'form-actions', 'empty-state',
]);

function resolvePlanConflicts(blocks: BlockPlan[]): BlockPlan[] {
  const customLayoutBlocks = blocks.filter((block) =>
    block.type === 'custom'
    && (block.components.includes('Row') || block.components.includes('Col') || block.components.includes('Tabs')),
  );
  if (customLayoutBlocks.length === 0) {
    return blocks;
  }
  const hasLeafZones = blocks.some((block) => leafZoneTypes.has(block.type));
  if (!hasLeafZones) {
    return blocks;
  }
  return blocks.filter((block) =>
    block.type === 'page-header' || block.type === 'custom',
  );
}

describe('resolvePlanConflicts', () => {
  const header: BlockPlan = {
    id: 'page-header', type: 'page-header', description: '标题',
    components: ['Container', 'Typography.Title'], priority: 1, complexity: 'simple',
  };
  const customLayout: BlockPlan = {
    id: 'main-layout', type: 'custom', description: '双栏布局',
    components: ['Row', 'Col'], priority: 2, complexity: 'medium',
  };
  const detailInfo: BlockPlan = {
    id: 'basic-info', type: 'detail-info', description: '基本信息',
    components: ['Card', 'Descriptions'], priority: 3, complexity: 'medium',
  };
  const dataTable: BlockPlan = {
    id: 'attendance', type: 'data-table', description: '考勤记录',
    components: ['Card', 'Table'], priority: 4, complexity: 'medium',
  };
  const timeline: BlockPlan = {
    id: 'approval', type: 'timeline-area', description: '审批动态',
    components: ['Card', 'Timeline'], priority: 5, complexity: 'medium',
  };
  const customCardOnly: BlockPlan = {
    id: 'info-card', type: 'custom', description: '自定义信息卡',
    components: ['Card', 'Typography.Paragraph'], priority: 2, complexity: 'simple',
  };

  it('drops leaf zones when custom layout block with Row/Col coexists', () => {
    const result = resolvePlanConflicts([header, customLayout, detailInfo, dataTable, timeline]);
    expect(result.map((b) => b.id)).toEqual(['page-header', 'main-layout']);
  });

  it('keeps all blocks when no custom layout is present', () => {
    const result = resolvePlanConflicts([header, detailInfo, dataTable, timeline]);
    expect(result).toHaveLength(4);
    expect(result.map((b) => b.id)).toEqual(['page-header', 'basic-info', 'attendance', 'approval']);
  });

  it('keeps all blocks when only page-header and custom exist (no conflict)', () => {
    const result = resolvePlanConflicts([header, customLayout]);
    expect(result).toHaveLength(2);
    expect(result.map((b) => b.id)).toEqual(['page-header', 'main-layout']);
  });

  it('does not trigger for custom blocks without Row/Col/Tabs', () => {
    const result = resolvePlanConflicts([header, customCardOnly, detailInfo, dataTable]);
    expect(result).toHaveLength(4);
    expect(result.map((b) => b.id)).toEqual(['page-header', 'info-card', 'basic-info', 'attendance']);
  });
});

// ── validateBlockOutput ──

interface SchemaNodeLike {
  component: string;
  id?: string;
  props?: Record<string, unknown>;
  children?: unknown;
  [key: string]: unknown;
}

const rowAllowedZones: ReadonlySet<ZoneType> = new Set<ZoneType>(['custom', 'kpi-row', 'form-actions']);

const zoneSignatureComponents: Partial<Record<ZoneType, ReadonlySet<string>>> = {
  'data-table': new Set(['Table']),
  'timeline-area': new Set(['Timeline']),
  'detail-info': new Set(['Descriptions']),
  'chart-area': new Set(['Statistic']),
  filter: new Set(['Form']),
  'side-info': new Set(['Descriptions', 'Typography.Text']),
};

function isSchemaNodeLike(value: unknown): value is SchemaNodeLike {
  return Boolean(value) && typeof value === 'object' && 'component' in (value as Record<string, unknown>);
}

function findZoneSubtree(
  node: SchemaNodeLike,
  signatureComponents: ReadonlySet<string>,
): SchemaNodeLike | null {
  const children = Array.isArray(node.children) ? node.children.filter(isSchemaNodeLike) : [];
  if (children.some((child) => signatureComponents.has(child.component))) {
    return node;
  }
  for (const child of children) {
    const found = findZoneSubtree(child, signatureComponents);
    if (found) {
      return found;
    }
  }
  return null;
}

function validateBlockOutput(
  node: SchemaNodeLike,
  zoneType: ZoneType,
  blockId: string,
): SchemaNodeLike {
  if (rowAllowedZones.has(zoneType)) {
    return node;
  }
  const isTopLevelRowLayout =
    node.component === 'Row'
    && Array.isArray(node.children)
    && node.children.filter(isSchemaNodeLike).filter((c) => c.component === 'Col').length > 1;
  const isTopLevelTabs = node.component === 'Tabs';
  if (!isTopLevelRowLayout && !isTopLevelTabs) {
    return node;
  }
  const signature = zoneSignatureComponents[zoneType];
  if (signature) {
    const subtree = findZoneSubtree(node, signature);
    if (subtree && subtree !== node) {
      return subtree;
    }
  }
  if (isTopLevelRowLayout && Array.isArray(node.children)) {
    const cols = node.children.filter(isSchemaNodeLike).filter((c) => c.component === 'Col');
    if (cols.length > 0) {
      const firstCol = cols[0]!;
      const colChildren = Array.isArray(firstCol.children)
        ? firstCol.children.filter(isSchemaNodeLike)
        : [];
      if (colChildren.length === 1) {
        return colChildren[0]!;
      }
      if (colChildren.length > 1) {
        return {
          component: 'Container',
          id: `${blockId}-corrected`,
          props: { direction: 'column', gap: 16 },
          children: colChildren,
        };
      }
    }
  }
  return node;
}

describe('validateBlockOutput (zone ownership)', () => {
  it('extracts Table subtree when data-table zone outputs Row/Col layout', () => {
    // Simulates the real trace: data-table zone generated full page layout
    const violatingNode: SchemaNodeLike = {
      component: 'Row',
      id: 'employee-detail-layout',
      props: { gutter: [16, 16] },
      children: [
        {
          component: 'Col', id: 'left-col', props: { span: 10 },
          children: [
            {
              component: 'Card', id: 'basic-info-card', props: { title: '基本信息' },
              children: [{ component: 'Descriptions', id: 'desc-1', props: {} }],
            },
          ],
        },
        {
          component: 'Col', id: 'right-col', props: { span: 14 },
          children: [
            {
              component: 'Card', id: 'attendance-card', props: { title: '考勤记录' },
              children: [{ component: 'Table', id: 'attendance-table', props: {} }],
            },
          ],
        },
      ],
    };

    const result = validateBlockOutput(violatingNode, 'data-table', 'attendance-records');
    expect(result.component).toBe('Card');
    expect(result.id).toBe('attendance-card');
    expect(Array.isArray(result.children)).toBe(true);
    expect((result.children as SchemaNodeLike[])[0]!.component).toBe('Table');
  });

  it('does not modify a compliant timeline-area block', () => {
    const compliantNode: SchemaNodeLike = {
      component: 'Card',
      id: 'timeline-card',
      props: { title: '审批动态' },
      children: [
        { component: 'Timeline', id: 'timeline-1', props: {}, children: [] },
      ],
    };

    const result = validateBlockOutput(compliantNode, 'timeline-area', 'approval');
    expect(result).toBe(compliantNode); // exact same reference
  });

  it('does not modify a custom zone even if it uses Row/Col', () => {
    const customNode: SchemaNodeLike = {
      component: 'Row',
      id: 'layout',
      props: { gutter: 24 },
      children: [
        { component: 'Col', id: 'col-1', props: { span: 12 }, children: [] },
        { component: 'Col', id: 'col-2', props: { span: 12 }, children: [] },
      ],
    };

    const result = validateBlockOutput(customNode, 'custom', 'main-layout');
    expect(result).toBe(customNode); // exact same reference, untouched
  });
});
