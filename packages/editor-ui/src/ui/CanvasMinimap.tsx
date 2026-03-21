import React from 'react';

export interface MinimapBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MinimapViewport extends MinimapBounds {}

export interface MinimapItemStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  opacity?: number;
}

export interface MinimapRect extends MinimapBounds {
  id: string;
  kind: 'stage' | 'region';
  style?: MinimapItemStyle;
}

export interface MinimapNode extends MinimapBounds {
  id: string;
  kind: 'node';
  style?: MinimapItemStyle;
}

export type MinimapItem = MinimapRect | MinimapNode;

export interface MinimapModel {
  bounds: MinimapBounds;
  viewport: MinimapViewport;
  items: MinimapItem[];
}

export interface CanvasMinimapProps {
  model: MinimapModel;
  width?: number;
  height?: number;
}

function clampDimension(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function projectBounds(
  rect: MinimapBounds,
  frame: MinimapBounds,
  scale: number,
  offsetX: number,
  offsetY: number,
): MinimapBounds {
  return {
    x: rect.x * scale + offsetX,
    y: rect.y * scale + offsetY,
    width: Math.max(rect.width * scale, 2),
    height: Math.max(rect.height * scale, 2),
  };
}

export function CanvasMinimap({
  model,
  width = 120,
  height = 72,
}: CanvasMinimapProps) {
  const safeBoundsWidth = clampDimension(model.bounds.width, 1);
  const safeBoundsHeight = clampDimension(model.bounds.height, 1);
  const padding = Math.max(safeBoundsWidth, safeBoundsHeight) * 0.3;

  const frame = React.useMemo<MinimapBounds>(() => ({
    x: model.bounds.x - padding,
    y: model.bounds.y - padding,
    width: safeBoundsWidth + padding * 2,
    height: safeBoundsHeight + padding * 2,
  }), [model.bounds.x, model.bounds.y, padding, safeBoundsWidth, safeBoundsHeight]);

  const scale = Math.min(width / frame.width, height / frame.height);
  const offsetX = (width - frame.width * scale) / 2 - frame.x * scale;
  const offsetY = (height - frame.height * scale) / 2 - frame.y * scale;

  const projectedItems = model.items.map((item) => ({
    ...item,
    projected: projectBounds(item, frame, scale, offsetX, offsetY),
  }));
  const projectedViewport = projectBounds(model.viewport, frame, scale, offsetX, offsetY);

  const maskPath = [
    `M0,0H${width}V${height}H0Z`,
    `M${projectedViewport.x},${projectedViewport.y}`,
    `H${projectedViewport.x + projectedViewport.width}`,
    `V${projectedViewport.y + projectedViewport.height}`,
    `H${projectedViewport.x}Z`,
  ].join('');

  return (
    <svg
      className="canvas-minimap"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Canvas minimap"
      data-testid="canvas-minimap"
    >
      {projectedItems.map((item) => (
        <rect
          key={item.id}
          className={`canvas-minimap__item canvas-minimap__item--${item.kind}`}
          data-testid={`canvas-minimap-item-${item.id}`}
          x={item.projected.x}
          y={item.projected.y}
          width={item.projected.width}
          height={item.projected.height}
          rx={item.style?.radius ?? (item.kind === 'node' ? 4 : 1)}
          fill={item.style?.fill}
          stroke={item.style?.stroke}
          strokeWidth={item.style?.strokeWidth}
          opacity={item.style?.opacity}
        />
      ))}
      <path
        className="canvas-minimap__mask"
        d={maskPath}
        fillRule="evenodd"
        pointerEvents="none"
      />
      <rect
        className="canvas-minimap__viewport"
        data-testid="canvas-minimap-viewport"
        x={projectedViewport.x}
        y={projectedViewport.y}
        width={projectedViewport.width}
        height={projectedViewport.height}
        rx={1}
      />
    </svg>
  );
}
