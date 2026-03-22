// ---------------------------------------------------------------------------
// Typed Edge — custom edge with type info
// ---------------------------------------------------------------------------

import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

export interface TypedEdgeAddNodePayload {
  edgeId: string;
  sourceNodeId: string;
  sourceHandle: string | null;
  targetNodeId: string;
  targetHandle: string | null;
  position: { x: number; y: number };
}

export interface TypedEdgeProps extends EdgeProps {
  onAddNode?: (payload: TypedEdgeAddNodePayload) => void;
}

export function TypedEdge({
  id,
  source,
  sourceHandle,
  sourceX,
  sourceY,
  target,
  targetHandle,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
  onAddNode,
}: TypedEdgeProps) {
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
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected ? 2 : 1.5,
          stroke: selected ? '#3b82f6' : '#6b7280',
          transition: 'stroke 0.2s, stroke-width 0.2s',
        }}
      />
      {onAddNode && source && target ? (
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
              onAddNode({
                edgeId: id,
                sourceNodeId: source,
                sourceHandle,
                targetNodeId: target,
                targetHandle,
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
