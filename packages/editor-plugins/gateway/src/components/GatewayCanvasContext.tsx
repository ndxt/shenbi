// ---------------------------------------------------------------------------
// GatewayCanvasContext — provides dynamic callbacks to node/edge components
// without making nodeTypes/edgeTypes unstable.
// ---------------------------------------------------------------------------

import React, { useContext } from 'react';
import type { NodeMenuAction } from '../nodes/BaseNode';
import type { TypedEdgeAddNodePayload } from '../edges/TypedEdge';

export interface GatewayCanvasCallbacks {
  onAddNode?: (sourceNodeId: string, sourceHandle: string) => void;
  onNodeMenuAction?: (nodeId: string, action: NodeMenuAction) => void;
  onAddNodeFromEdge?: (payload: TypedEdgeAddNodePayload) => void;
}

const GatewayCanvasContext = React.createContext<GatewayCanvasCallbacks>({});

export const GatewayCanvasProvider = GatewayCanvasContext.Provider;

export function useGatewayCanvasCallbacks(): GatewayCanvasCallbacks {
  return useContext(GatewayCanvasContext);
}
