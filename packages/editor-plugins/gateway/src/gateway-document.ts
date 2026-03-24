import type { GatewayViewport } from './components/gateway-viewport';
import type {
  GatewayDocumentSchema,
  GatewayEdge,
  GatewayNode,
  GatewayNodeData,
} from './types';
import { withGatewayNodeRuntime } from './types';

export interface GatewayGraphState {
  nodes: GatewayNode[];
  edges: GatewayEdge[];
  viewport?: GatewayViewport | undefined;
}

function createDefaultNodes(): GatewayNode[] {
  return [
    withGatewayNodeRuntime({
      id: 'start-1',
      type: 'start',
      position: { x: 100, y: 200 },
      data: { kind: 'start', label: '开始', config: {} } as GatewayNodeData,
    }),
    withGatewayNodeRuntime({
      id: 'end-1',
      type: 'end',
      position: { x: 600, y: 200 },
      data: { kind: 'end', label: '返回结果', config: {} } as GatewayNodeData,
    }),
  ];
}

function createDefaultEdges(): GatewayEdge[] {
  return [
    {
      id: 'edge_default',
      type: 'typed',
      source: 'start-1',
      sourceHandle: 'request',
      target: 'end-1',
      targetHandle: 'result',
    },
  ];
}

export function createDefaultGatewayDocument(
  id = 'gateway',
  name = 'API Workflow',
): GatewayDocumentSchema {
  return gatewayGraphToDocument({
    id,
    name,
    nodes: createDefaultNodes(),
    edges: createDefaultEdges(),
  });
}

export function isGatewayDocumentSchema(value: unknown): value is GatewayDocumentSchema {
  return Boolean(
    value
    && typeof value === 'object'
    && (value as { type?: unknown }).type === 'api-gateway'
    && Array.isArray((value as { nodes?: unknown }).nodes)
    && Array.isArray((value as { edges?: unknown }).edges),
  );
}

export function gatewayDocumentToGraph(
  documentSchema?: GatewayDocumentSchema | null,
): GatewayGraphState {
  if (!documentSchema) {
    return {
      nodes: createDefaultNodes(),
      edges: createDefaultEdges(),
    };
  }

  const rawNodes = Array.isArray(documentSchema.nodes) ? documentSchema.nodes : [];
  const rawEdges = Array.isArray(documentSchema.edges) ? documentSchema.edges : [];

  const nodes = rawNodes.length > 0
    ? rawNodes.map((node) => withGatewayNodeRuntime({
        id: node.id,
        type: node.kind,
        position: node.position,
        data: {
          kind: node.kind,
          label: node.label,
          config: node.config,
        } as GatewayNodeData,
      }))
    : createDefaultNodes();

  const edges = rawEdges.length > 0
    ? rawEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourceHandle,
        target: edge.target,
        targetHandle: edge.targetHandle,
        type: 'typed',
      }))
    : createDefaultEdges();

  return {
    nodes,
    edges,
    ...(documentSchema.viewport ? { viewport: documentSchema.viewport } : {}),
  };
}

export function gatewayGraphToDocument({
  id,
  name,
  nodes,
  edges,
  viewport,
}: {
  id: string;
  name: string;
} & GatewayGraphState): GatewayDocumentSchema {
  return {
    id,
    name,
    type: 'api-gateway',
    nodes: nodes.map((node) => ({
      id: node.id,
      kind: node.data.kind,
      label: node.data.label,
      position: node.position,
      config: node.data.config,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      sourceHandle: edge.sourceHandle ?? '',
      target: edge.target ?? '',
      targetHandle: edge.targetHandle ?? '',
    })),
    ...(viewport ? { viewport } : {}),
  };
}
