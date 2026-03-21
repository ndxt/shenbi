import { describe, expect, it } from 'vitest';
import { resolveNodeDropIndicator } from './drop-indicator';

describe('resolveNodeDropIndicator', () => {
  const rect = {
    top: 100,
    left: 80,
    width: 320,
    height: 120,
  };

  it('容器节点在中部命中时返回 inside frame 指示器', () => {
    const indicator = resolveNodeDropIndicator('card-1', rect, 160, true);

    expect(indicator.target).toEqual({
      placement: 'inside',
      targetNodeSchemaId: 'card-1',
    });
    expect(indicator.variant).toBe('frame');
    expect(indicator.top).toBe(100);
    expect(indicator.height).toBe(120);
  });

  it('叶子节点在中部命中时会回退为 before 线指示器', () => {
    const indicator = resolveNodeDropIndicator('button-1', rect, 130, false);

    expect(indicator.target).toEqual({
      placement: 'before',
      targetNodeSchemaId: 'button-1',
    });
    expect(indicator.variant).toBe('line');
    expect(indicator.top).toBe(100);
  });

  it('叶子节点在下半区命中时会回退为 after 线指示器', () => {
    const indicator = resolveNodeDropIndicator('button-1', rect, 190, false);

    expect(indicator.target).toEqual({
      placement: 'after',
      targetNodeSchemaId: 'button-1',
    });
    expect(indicator.variant).toBe('line');
    expect(indicator.top).toBe(220);
  });
});
