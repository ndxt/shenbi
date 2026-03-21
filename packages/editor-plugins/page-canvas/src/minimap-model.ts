import type { CanvasViewportState, MinimapModel } from '@shenbi/editor-ui';

export interface PageMinimapModelOptions {
  viewportState: CanvasViewportState;
  canvasScale: number;
  stageWidth: number;
  stageHeight: number;
  stageLeft: number;
  stageTop: number;
}

function unionBounds(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

export function buildPageMinimapModel({
  viewportState,
  canvasScale,
  stageWidth,
  stageHeight,
  stageLeft,
  stageTop,
}: PageMinimapModelOptions): MinimapModel {
  const safeScale = canvasScale > 0 ? canvasScale : 1;
  const stageRect = {
    x: 0,
    y: 0,
    width: stageWidth,
    height: stageHeight,
  };
  const viewportRect = {
    x: (viewportState.scrollLeft - stageLeft) / safeScale,
    y: (viewportState.scrollTop - stageTop) / safeScale,
    width: viewportState.viewportWidth / safeScale,
    height: viewportState.viewportHeight / safeScale,
  };

  return {
    bounds: unionBounds(stageRect, viewportRect),
    viewport: viewportRect,
    items: [
      {
        id: 'page-stage',
        kind: 'stage',
        ...stageRect,
        style: {
          fill: 'var(--canvas-minimap-stage-bg)',
          stroke: 'var(--canvas-minimap-stage-border)',
          strokeWidth: 1,
          radius: 1,
        },
      },
    ],
  };
}
