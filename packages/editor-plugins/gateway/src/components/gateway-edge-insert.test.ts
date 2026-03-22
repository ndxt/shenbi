import { describe, expect, it } from 'vitest';
import type { GatewayNode, GatewayNodeData } from '../types';
import { NODE_CONTRACTS } from '../types';
import { resolveBridgeOutputHandle } from './gateway-edge-insert';

function makeNode(id: string, kind: GatewayNodeData['kind']): GatewayNode {
  return {
    id,
    type: kind,
    position: { x: 0, y: 0 },
    data: { kind, label: kind, config: {} } as GatewayNodeData,
  };
}

describe('resolveBridgeOutputHandle', () => {
  it('uses a compatible sql-query output when bridging to return-result', () => {
    const sqlContract = NODE_CONTRACTS['sql-query'];
    const endNode = makeNode('end-1', 'end');

    expect(resolveBridgeOutputHandle(sqlContract, endNode, 'result')).toBe('rows');
  });

  it('falls back to the first output when no target handle is available', () => {
    const loopContract = NODE_CONTRACTS.loop;

    expect(resolveBridgeOutputHandle(loopContract, null)).toBe('item');
  });
});
