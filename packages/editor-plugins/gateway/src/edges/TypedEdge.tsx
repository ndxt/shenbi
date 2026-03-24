// ---------------------------------------------------------------------------
// Typed Edge — custom edge with type info
// ---------------------------------------------------------------------------

import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import type { GatewayEdge } from '../types';
import { useGatewayCanvasCallbacks } from '../components/GatewayCanvasContext';

export interface TypedEdgeAddNodePayload {
  edgeId: string;
  sourceNodeId: string;
  sourceHandle: string | null;
  targetNodeId: string;
  targetHandle: string | null;
  position: { x: number; y: number };
}

export type TypedEdgeProps = EdgeProps<GatewayEdge>;

export function TypedEdge({
  id,
  source,
  sourceHandleId,
  sourceX,
  sourceY,
  target,
  targetHandleId,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
}: TypedEdgeProps) {
  const { onAddNodeFromEdge } = useGatewayCanvasCallbacks();
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        {...(markerEnd ? { markerEnd } : {})}
        style={{
          ...style,
          stroke: selected ? 'var(--color-primary)' : 'var(--color-text-muted)',
          strokeWidth: selected ? 2 : 1,
          transition: 'stroke 0.2s, stroke-width 0.2s',
        }}
      />
      {onAddNodeFromEdge && source && target ? (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="gateway-edge__add-button nodrag nopan"
            style={{
              left: `${labelX}px`,
              top: `${labelY}px`,
            }}
            aria-label="在线路中插入节点"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onAddNodeFromEdge({
                edgeId: id,
                sourceNodeId: source,
                sourceHandle: sourceHandleId ?? null,
                targetNodeId: target,
                targetHandle: targetHandleId ?? null,
                position: {
                  x: event.clientX,
                  y: event.clientY,
                },
              });
            }}
          >
            <span className="gateway-edge__add-plus" aria-hidden="true">+</span>
          </button>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
