import { describe, expect, it } from 'vitest';
import type { GatewayNode } from '../types';
import { resolveGatewayInitialViewport } from './gateway-viewport';

describe('resolveGatewayInitialViewport', () => {
  it('keeps a persisted viewport when one exists', () => {
    expect(resolveGatewayInitialViewport({
      nodes: [],
      viewportSize: { width: 1200, height: 800 },
      persistedViewport: { x: 24, y: 48, zoom: 1.2 },
    })).toEqual({ x: 24, y: 48, zoom: 1.2 });
  });

  it('centers gateway nodes at 100% zoom by default', () => {
    const viewport = resolveGatewayInitialViewport({
      nodes: [
        {
          id: 'start-1',
          type: 'start',
          position: { x: 100, y: 200 },
          data: { kind: 'start', label: '开始', config: {} },
        } as GatewayNode,
        {
          id: 'end-1',
          type: 'end',
          position: { x: 600, y: 200 },
          data: { kind: 'end', label: '返回结果', config: {} },
        } as GatewayNode,
      ],
      viewportSize: { width: 1200, height: 800 },
    });

    expect(viewport.zoom).toBe(1);
    expect(viewport.x).toBe(150);
    expect(viewport.y).toBe(170);
  });
});
