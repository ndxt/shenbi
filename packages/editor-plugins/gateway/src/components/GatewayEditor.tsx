// ---------------------------------------------------------------------------
// GatewayEditor — top-level component orchestrating canvas + state
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { GatewayCanvas } from './GatewayCanvas';
import type {
  GatewayNode,
  GatewayEdge,
  GatewayDocumentSchema,
  GatewayNodeData,
} from '../types';

/** Default nodes for a new API gateway */
function createDefaultNodes(): GatewayNode[] {
  return [
    {
      id: 'start-1',
      type: 'start',
      position: { x: 100, y: 200 },
      data: { kind: 'start', label: '开始', config: {} } as GatewayNodeData,
    },
    {
      id: 'end-1',
      type: 'end',
      position: { x: 600, y: 200 },
      data: { kind: 'end', label: '返回结果', config: {} } as GatewayNodeData,
    },
  ];
}

export interface GatewayEditorProps {
  /** Document schema from .api.json (if existing file) */
  documentSchema?: GatewayDocumentSchema;
  /** Called when the gateway changes (for dirty tracking) */
  onDirty?: () => void;
  /** Called with updated document schema for persistence */
  onSave?: (schema: GatewayDocumentSchema) => void;
}

export function GatewayEditor({
  documentSchema,
  onDirty,
}: GatewayEditorProps) {
  const [nodes, setNodes] = useState<GatewayNode[]>(() => {
    if (documentSchema?.nodes?.length) {
      return documentSchema.nodes.map((n) => ({
        id: n.id,
        type: n.kind,
        position: n.position,
        data: {
          kind: n.kind,
          label: n.label,
          config: n.config,
        } as GatewayNodeData,
      }));
    }
    return createDefaultNodes();
  });

  const [edges, setEdges] = useState<GatewayEdge[]>(() => {
    if (documentSchema?.edges?.length) {
      return documentSchema.edges.map((e) => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourceHandle,
        target: e.target,
        targetHandle: e.targetHandle,
        type: 'typed',
      }));
    }
    return [];
  });

  const handleNodesChange = useCallback((nextNodes: GatewayNode[]) => {
    setNodes(nextNodes);
  }, []);

  const handleEdgesChange = useCallback((nextEdges: GatewayEdge[]) => {
    setEdges(nextEdges);
  }, []);

  return (
    <ReactFlowProvider>
      <GatewayCanvas
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onDirty={onDirty}
        initialViewport={documentSchema?.viewport}
      />
    </ReactFlowProvider>
  );
}
