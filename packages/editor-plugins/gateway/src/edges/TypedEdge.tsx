// ---------------------------------------------------------------------------
// Typed Edge — custom edge with type info
// ---------------------------------------------------------------------------

import React from 'react';
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

export function TypedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        ...style,
        strokeWidth: selected ? 2.5 : 1.5,
        stroke: selected ? '#3b82f6' : '#64748b',
        transition: 'stroke 0.15s, stroke-width 0.15s',
      }}
    />
  );
}
