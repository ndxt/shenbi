// ---------------------------------------------------------------------------
// Connection Validation — ensures only type-compatible ports can connect
// ---------------------------------------------------------------------------

import type { Connection } from '@xyflow/react';
import {
  type PortDataType,
  type PortSchema,
  type GatewayNodeData,
  type GatewayNode,
  type GatewayEdge,
  NODE_CONTRACTS,
} from './types';

/**
 * Check if two port data types are compatible for connection.
 *
 * Rules:
 * - `any` is compatible with everything
 * - Same types are compatible
 * - `object` and `array` can connect to `any`
 * - `void` can only connect to `void` or `any`
 */
export function isPortTypeCompatible(
  sourceType: PortDataType,
  targetType: PortDataType,
): boolean {
  if (sourceType === 'any' || targetType === 'any') {
    return true;
  }
  if (sourceType === targetType) {
    return true;
  }
  // void cannot connect to non-any types
  if (sourceType === 'void' || targetType === 'void') {
    return false;
  }
  return false;
}

/**
 * Find a port schema by handle id from a node contract.
 */
function findPort(
  nodeKind: string,
  handleId: string,
  direction: 'input' | 'output',
): PortSchema | undefined {
  const contract = NODE_CONTRACTS[nodeKind as keyof typeof NODE_CONTRACTS];
  if (!contract) {
    return undefined;
  }
  const ports = direction === 'input' ? contract.inputs : contract.outputs;
  return ports.find((port) => port.id === handleId);
}

/**
 * React Flow `isValidConnection` callback.
 *
 * Validates:
 * 1. Source and target are different nodes
 * 2. Source has a valid output port, target has a valid input port
 * 3. Port data types are compatible
 * 4. Target input port doesn't already have an incoming edge
 * 5. No self-loops
 */
export function isValidConnection(
  connection: Connection,
  nodes: GatewayNode[],
  edges: GatewayEdge[],
): boolean {
  const { source, target, sourceHandle, targetHandle } = connection;

  // 1. No self-loops
  if (source === target) {
    return false;
  }

  if (!source || !target || !sourceHandle || !targetHandle) {
    return false;
  }

  // 2. Find the source and target nodes
  const sourceNode = nodes.find((n) => n.id === source);
  const targetNode = nodes.find((n) => n.id === target);

  if (!sourceNode || !targetNode) {
    return false;
  }

  const sourceData = sourceNode.data as GatewayNodeData;
  const targetData = targetNode.data as GatewayNodeData;

  // 3. Find port schemas
  const sourcePort = findPort(sourceData.kind, sourceHandle, 'output');
  const targetPort = findPort(targetData.kind, targetHandle, 'input');

  if (!sourcePort || !targetPort) {
    return false;
  }

  // 4. Check type compatibility
  if (!isPortTypeCompatible(sourcePort.dataType, targetPort.dataType)) {
    return false;
  }

  // 5. Target input port can only have one incoming edge
  const existingEdge = edges.find(
    (e) => e.target === target && e.targetHandle === targetHandle,
  );
  if (existingEdge) {
    return false;
  }

  return true;
}
