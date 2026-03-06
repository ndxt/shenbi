import { describe, expect, it } from 'vitest';
import { mergeContributions, type OrderedContribution } from './contributions';

interface TestContribution extends OrderedContribution {
  label: string;
}

describe('mergeContributions', () => {
  it('按 id 覆盖内置贡献并按 order 排序', () => {
    const builtin: TestContribution[] = [
      { id: 'a', label: 'A', order: 20 },
      { id: 'b', label: 'B', order: 10 },
    ];
    const extensions: TestContribution[] = [
      { id: 'a', label: 'A-override', order: 30 },
      { id: 'c', label: 'C', order: 15 },
    ];

    const merged = mergeContributions(builtin, extensions);

    expect(merged.map((item) => item.id)).toEqual(['b', 'c', 'a']);
    expect(merged.find((item) => item.id === 'a')?.label).toBe('A-override');
  });
});
