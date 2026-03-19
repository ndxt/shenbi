import type { CanvasRect, CanvasDropTarget } from './types';

export interface CanvasDropIndicator {
  target: CanvasDropTarget;
  top: number;
  left: number;
  width: number;
  height: number;
  variant: 'line' | 'frame';
}

export function resolveNodeDropIndicator(
  nodeId: string,
  rect: CanvasRect,
  localY: number,
  canDropInside: boolean,
): CanvasDropIndicator {
  const beforeAfterThreshold = Math.min(Math.max(rect.height * 0.25, 16), 40);
  const offsetY = localY - rect.top;
  const placement = offsetY <= beforeAfterThreshold
    ? 'before'
    : offsetY >= rect.height - beforeAfterThreshold
      ? 'after'
      : 'inside';

  const normalizedPlacement = placement === 'inside' && !canDropInside
    ? (offsetY < rect.height / 2 ? 'before' : 'after')
    : placement;

  if (normalizedPlacement === 'inside') {
    return {
      target: { placement: normalizedPlacement, targetNodeSchemaId: nodeId },
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      variant: 'frame',
    };
  }

  return {
    target: { placement: normalizedPlacement, targetNodeSchemaId: nodeId },
    top: normalizedPlacement === 'before' ? rect.top : rect.top + rect.height,
    left: rect.left,
    width: rect.width,
    height: 0,
    variant: 'line',
  };
}
