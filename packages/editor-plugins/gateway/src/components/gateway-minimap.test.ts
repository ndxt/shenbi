import { describe, expect, it } from 'vitest';
import { buildGatewayMinimapModel } from './gateway-minimap';
import type { GatewayNode } from '../types';

describe('buildGatewayMinimapModel', () => {
  it('maps nodes into shared minimap items and computes viewport in flow coordinates', () => {
    const model = buildGatewayMinimapModel({
      nodes: [
        {
          id: 'node-1',
          type: 'sql-query',
          position: { x: 120, y: 80 },
          data: {
            kind: 'sql-query',
            label: 'SQL 查询',
            config: {},
          },
          measured: {
            width: 240,
            height: 72,
          },
        } as GatewayNode,
      ],
      viewport: { x: -60, y: -40, zoom: 2 },
      viewportWidth: 800,
      viewportHeight: 600,
    });

    expect(model.viewport).toEqual({
      x: 30,
      y: 20,
      width: 400,
      height: 300,
    });
    expect(model.items[0]).toMatchObject({
      id: 'node-1',
      kind: 'node',
      x: 120,
      y: 80,
      width: 240,
      height: 72,
    });
  });

  it('falls back to default node dimensions when runtime measurements are missing', () => {
    const model = buildGatewayMinimapModel({
      nodes: [
        {
          id: 'node-2',
          type: 'branch',
          position: { x: 0, y: 0 },
          data: {
            kind: 'branch',
            label: '条件分支',
            config: {},
          },
        } as GatewayNode,
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
      viewportWidth: 600,
      viewportHeight: 400,
    });

    expect(model.items[0]).toMatchObject({
      width: 200,
      height: 60,
    });
  });
});
