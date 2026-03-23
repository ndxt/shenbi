import { Position } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import {
  createDefaultGatewayDocument,
  gatewayDocumentToGraph,
  gatewayGraphToDocument,
  isGatewayDocumentSchema,
} from './gateway-document';

describe('gateway-document', () => {
  it('creates a default gateway document', () => {
    const document = createDefaultGatewayDocument('api-1', 'Order API');

    expect(document.id).toBe('api-1');
    expect(document.name).toBe('Order API');
    expect(document.type).toBe('api-gateway');
    expect(document.nodes).toHaveLength(2);
    expect(document.edges).toHaveLength(1);
  });

  it('round-trips between graph and document representations', () => {
    const original = createDefaultGatewayDocument('api-2', 'Billing API');
    const graph = gatewayDocumentToGraph(original);
    const next = gatewayGraphToDocument({
      id: original.id,
      name: original.name,
      nodes: graph.nodes,
      edges: graph.edges,
      viewport: { x: 10, y: 20, zoom: 1.5 },
    });

    expect(next.nodes).toHaveLength(original.nodes.length);
    expect(next.edges).toHaveLength(original.edges.length);
    expect(next.viewport).toEqual({ x: 10, y: 20, zoom: 1.5 });
  });

  it('hydrates graph nodes with stable default dimensions for React Flow', () => {
    const graph = gatewayDocumentToGraph(createDefaultGatewayDocument('api-3', 'Visible API'));

    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes.every((node) => node.width === 200 && node.height === 60)).toBe(true);
  });

  it('hydrates fallback handles from unified contract ports', () => {
    const graph = gatewayDocumentToGraph(createDefaultGatewayDocument('api-4', 'Connected API'));
    const startNode = graph.nodes.find((node) => node.id === 'start-1');
    const endNode = graph.nodes.find((node) => node.id === 'end-1');

    expect(startNode?.handles).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'request',
        type: 'source',
        position: Position.Right,
        width: 16,
        height: 16,
      }),
    ]));
    expect(endNode?.handles).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'result',
        type: 'target',
        position: Position.Left,
        width: 16,
        height: 16,
      }),
    ]));
  });

  it('detects gateway document payloads', () => {
    expect(isGatewayDocumentSchema(createDefaultGatewayDocument())).toBe(true);
    expect(isGatewayDocumentSchema({ type: 'page' })).toBe(false);
    expect(isGatewayDocumentSchema(null)).toBe(false);
  });
});
