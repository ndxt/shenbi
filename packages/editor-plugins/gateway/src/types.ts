// ---------------------------------------------------------------------------
// Gateway Runtime Types — thin adapter over unified ComponentContract
// ---------------------------------------------------------------------------

import type { Node, Edge } from '@xyflow/react';
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
