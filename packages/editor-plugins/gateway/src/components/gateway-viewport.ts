import {
  DEFAULT_GATEWAY_NODE_HEIGHT,
  DEFAULT_GATEWAY_NODE_WIDTH,
  type GatewayNode,
} from '../types';

export interface GatewayViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface GatewayViewportSize {
  width: number;
  height: number;
}

export interface ResolveGatewayInitialViewportOptions {
  nodes: GatewayNode[];
  viewportSize: GatewayViewportSize;
  persistedViewport?: GatewayViewport;
}

function getNodeWidth(node: GatewayNode) {
  const measured = (node as GatewayNode & { measured?: { width?: number } }).measured;
  return measured?.width ?? node.width ?? DEFAULT_GATEWAY_NODE_WIDTH;
}

function getNodeHeight(node: GatewayNode) {
  const measured = (node as GatewayNode & { measured?: { height?: number } }).measured;
  return measured?.height ?? node.height ?? DEFAULT_GATEWAY_NODE_HEIGHT;
}

export function resolveGatewayInitialViewport({
  nodes,
  viewportSize,
  persistedViewport,
}: ResolveGatewayInitialViewportOptions): GatewayViewport {
  if (persistedViewport) {
    return persistedViewport;
  }

  if (viewportSize.width <= 0 || viewportSize.height <= 0 || nodes.length === 0) {
    return { x: 0, y: 0, zoom: 1 };
  }

  const bounds = nodes.reduce((current, node) => {
    const width = getNodeWidth(node);
    const height = getNodeHeight(node);
    const next = {
      left: node.position.x,
      top: node.position.y,
      right: node.position.x + width,
      bottom: node.position.y + height,
    };

    if (!current) {
      return next;
    }

    return {
      left: Math.min(current.left, next.left),
      top: Math.min(current.top, next.top),
      right: Math.max(current.right, next.right),
      bottom: Math.max(current.bottom, next.bottom),
    };
  }, null as null | { left: number; top: number; right: number; bottom: number });

  if (!bounds) {
    return { x: 0, y: 0, zoom: 1 };
  }

  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;

  return {
    x: viewportSize.width / 2 - centerX,
    y: viewportSize.height / 2 - centerY,
    zoom: 1,
  };
}
