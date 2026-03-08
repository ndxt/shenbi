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

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
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
      depth += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
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

function trySalvageJsonCandidate(text: string): string | null {
  const extracted = findBalancedJsonObject(text);
  if (extracted) {
    return extracted;
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 && end < 0) {
    return null;
  }

  const base = (start >= 0 ? text.slice(start) : text).trim();
  const openCount = countOutsideStrings(base, '{');
  const closeCount = countOutsideStrings(base, '}');
  if (openCount <= closeCount || openCount - closeCount > 8) {
    return null;
  }

  return `${base}${'}'.repeat(openCount - closeCount)}`;
}

describe('agent runtime json salvage', () => {
  it('salvages near-valid json with trailing missing braces', () => {
    const raw = '```json\n{"component":"Card","children":[{"component":"Button","children":["确定"]}]\n```';
    const candidate = extractJsonCandidate(raw);
    const salvaged = trySalvageJsonCandidate(candidate);
    expect(salvaged).toBe('{"component":"Card","children":[{"component":"Button","children":["确定"]}]}');
    expect(JSON.parse(salvaged!)).toMatchObject({ component: 'Card' });
  });
});
