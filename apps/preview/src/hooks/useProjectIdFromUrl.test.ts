import { describe, expect, it } from 'vitest';
import { parseProjectIdFromUrl } from './useProjectIdFromUrl';

describe('parseProjectIdFromUrl', () => {
  it('returns null for root path', () => {
    expect(parseProjectIdFromUrl('/')).toBeNull();
  });

  it('returns null for empty path', () => {
    expect(parseProjectIdFromUrl('')).toBeNull();
  });

  it('extracts project ID from simple path', () => {
    expect(parseProjectIdFromUrl('/local-123')).toBe('local-123');
  });

  it('extracts project ID from path with trailing slash', () => {
    expect(parseProjectIdFromUrl('/gitlab-42/')).toBe('gitlab-42');
  });

  it('extracts project ID ignoring deeper segments', () => {
    expect(parseProjectIdFromUrl('/my-project/some/path')).toBe('my-project');
  });
});
