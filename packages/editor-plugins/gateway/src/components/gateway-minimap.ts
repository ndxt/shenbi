import type { MinimapBounds, MinimapModel } from '@shenbi/editor-ui';
import type { GatewayNode } from '../types';
import { NODE_CONTRACTS } from '../types';

const DEFAULT_GATEWAY_NODE_WIDTH = 200;
const DEFAULT_GATEWAY_NODE_HEIGHT = 60;

export interface GatewayViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface GatewayMinimapModelOptions {
  nodes: GatewayNode[];
  viewport: GatewayViewportState;
  viewportWidth: number;
  viewportHeight: number;
}

function unionBounds(a: MinimapBounds, b: MinimapBounds): MinimapBounds {
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

function getNodeWidth(node: GatewayNode) {
  const measured = (node as GatewayNode & { measured?: { width?: number } }).measured;
  return measured?.width ?? node.width ?? DEFAULT_GATEWAY_NODE_WIDTH;
}

function getNodeHeight(node: GatewayNode) {
  const measured = (node as GatewayNode & { measured?: { height?: number } }).measured;
  return measured?.height ?? node.height ?? DEFAULT_GATEWAY_NODE_HEIGHT;
}

export function buildGatewayMinimapModel({
  nodes,
  viewport,
  viewportWidth,
  viewportHeight,
}: GatewayMinimapModelOptions): MinimapModel {
  const zoom = viewport.zoom > 0 ? viewport.zoom : 1;
  const viewportRect = {
    x: -viewport.x / zoom,
    y: -viewport.y / zoom,
    width: viewportWidth / zoom,
    height: viewportHeight / zoom,
  };

  const items = nodes.map((node) => {
    const contract = NODE_CONTRACTS[node.data.kind];
    return {
      id: node.id,
      kind: 'node' as const,
      x: node.position.x,
      y: node.position.y,
      width: getNodeWidth(node),
      height: getNodeHeight(node),
      style: {
        fill: contract.color,
        stroke: 'var(--canvas-minimap-stage-border)',
        strokeWidth: 1,
        radius: 4,
        opacity: 0.92,
      },
    };
  });

  const itemBounds = items.reduce<MinimapBounds | null>((current, item) => {
    const next = {
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
    };
    return current ? unionBounds(current, next) : next;
  }, null);

  return {
    bounds: itemBounds ? unionBounds(itemBounds, viewportRect) : viewportRect,
    viewport: viewportRect,
    items,
  };
}
