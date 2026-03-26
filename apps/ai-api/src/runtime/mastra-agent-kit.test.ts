import { describe, expect, it } from 'vitest';
import { extractValidatedMastraBlockNode } from './mastra-agent-kit.ts';

describe('extractValidatedMastraBlockNode', () => {
  it('throws a clear error when mastra block output omits the node payload', () => {
    expect(() => extractValidatedMastraBlockNode({}, 'detail-main')).toThrow(
      'Mastra block generator returned an invalid node payload for block "detail-main"',
    );
  });

  it('returns the validated schema node when node payload exists', () => {
    const node = extractValidatedMastraBlockNode({
      node: {
        id: 'detail-card',
        component: 'Card',
        children: [],
      },
    }, 'detail-main');

    expect(node.component).toBe('Card');
    expect(node.id).toBe('detail-card');
  });
});
