// ---------------------------------------------------------------------------
// Gateway Runtime Types — thin adapter over unified ComponentContract
// ---------------------------------------------------------------------------

import { Position, type Node, type Edge } from '@xyflow/react';
import type {
  ComponentContract,
  ContractPort,
  PortDataType,
} from '@shenbi/schema';
import {
  gatewayContractByKind,
  GATEWAY_KIND_TO_COMPONENT_TYPE,
  GATEWAY_COMPONENT_TYPE_TO_KIND,
  PORT_TYPE_COLORS,
} from '@shenbi/schema';

// Re-export shared types and constants so existing consumers keep working
export type { PortDataType, ContractPort };
export { PORT_TYPE_COLORS, GATEWAY_KIND_TO_COMPONENT_TYPE, GATEWAY_COMPONENT_TYPE_TO_KIND };

/** Gateway node kind enum — the runtime identifier used in React Flow */
export type GatewayNodeKind =
  | 'start'
  | 'end'
  | 'data-definition'
  | 'metadata'
  | 'sql-query'
  | 'branch'
  | 'loop-start'
  | 'loop-end'
  | 'loop-break'
  | 'loop-continue';

/** Runtime data stored on each React Flow node */
export interface GatewayNodeData extends Record<string, unknown> {
  kind: GatewayNodeKind;
  label: string;
  config: Record<string, unknown>;
}

/** Typed React Flow node */
export type GatewayNode = Node<GatewayNodeData>;

export const DEFAULT_GATEWAY_NODE_WIDTH = 200;
export const DEFAULT_GATEWAY_NODE_HEIGHT = 60;
export const DEFAULT_GATEWAY_HANDLE_SIZE = 16;

type GatewayNodeHandle = NonNullable<GatewayNode['handles']>[number];

function resolveGatewayHandleOffset(index: number, count: number, nodeHeight: number) {
  const centerY = count === 1
    ? nodeHeight / 2
    : (nodeHeight * (index + 1)) / (count + 1);

  return Math.max(0, centerY - DEFAULT_GATEWAY_HANDLE_SIZE / 2);
}

export function buildGatewayNodeHandles(
  kind: GatewayNodeKind,
  nodeWidth = DEFAULT_GATEWAY_NODE_WIDTH,
  nodeHeight = DEFAULT_GATEWAY_NODE_HEIGHT,
): GatewayNodeHandle[] {
  const contract = getNodeContract(kind);
  const inputs = getContractInputs(contract);
  const outputs = getContractOutputs(contract);

  return [
    ...inputs.map((port, index) => ({
      id: port.id,
      type: 'target' as const,
      position: Position.Left,
      x: 0,
      y: resolveGatewayHandleOffset(index, inputs.length, nodeHeight),
      width: DEFAULT_GATEWAY_HANDLE_SIZE,
      height: DEFAULT_GATEWAY_HANDLE_SIZE,
    })),
    ...outputs.map((port, index) => ({
      id: port.id,
      type: 'source' as const,
      position: Position.Right,
      x: Math.max(0, nodeWidth - DEFAULT_GATEWAY_HANDLE_SIZE),
      y: resolveGatewayHandleOffset(index, outputs.length, nodeHeight),
      width: DEFAULT_GATEWAY_HANDLE_SIZE,
      height: DEFAULT_GATEWAY_HANDLE_SIZE,
    })),
  ];
}

export function withGatewayNodeRuntime<T extends GatewayNode>(node: T): T {
  const width = node.width ?? DEFAULT_GATEWAY_NODE_WIDTH;
  const height = node.height ?? DEFAULT_GATEWAY_NODE_HEIGHT;

  return {
    ...node,
    width,
    height,
    handles: buildGatewayNodeHandles(node.data.kind, width, height),
  };
}

export function withGatewayNodeDimensions<T extends GatewayNode>(node: T): T {
  return withGatewayNodeRuntime(node);
}

/** Typed React Flow edge */
export type GatewayEdge = Edge<{
  sourcePortType?: PortDataType;
}>;

/** Document schema for .api.json files */
export interface GatewayDocumentSchema {
  id: string;
  name: string;
  type: 'api-gateway';
  nodes: Array<{
    id: string;
    kind: GatewayNodeKind;
    label: string;
    position: { x: number; y: number };
    config: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    sourceHandle: string;
    target: string;
    targetHandle: string;
  }>;
  viewport?: { x: number; y: number; zoom: number };
}

// ---------------------------------------------------------------------------
// Contract helpers — thin wrappers over unified contract data
// ---------------------------------------------------------------------------

/**
 * Get the unified contract for a gateway node kind.
 * This replaces the old `NODE_CONTRACTS[kind]` pattern.
 */
export function getNodeContract(kind: GatewayNodeKind): ComponentContract {
  const contract = gatewayContractByKind[kind];
  if (!contract) {
    throw new Error(`Unknown gateway node kind: ${kind}`);
  }
  return contract;
}

/** Convenience: get input ports from a contract */
export function getContractInputs(contract: ComponentContract): ContractPort[] {
  return contract.ports?.inputs ?? [];
}

/** Convenience: get output ports from a contract */
export function getContractOutputs(contract: ComponentContract): ContractPort[] {
  return contract.ports?.outputs ?? [];
}

/**
 * Backward-compatible NODE_CONTRACTS-like lookup object.
 * Uses the unified contracts under the hood.
 */
export const NODE_CONTRACTS: Record<GatewayNodeKind, ComponentContract> =
  gatewayContractByKind as Record<GatewayNodeKind, ComponentContract>;

/** Node kinds that users can drag from the palette (start remains implicit) */
export const DRAGGABLE_NODE_KINDS: GatewayNodeKind[] = (
  Object.keys(gatewayContractByKind) as GatewayNodeKind[]
).filter((kind) => kind !== 'start');
