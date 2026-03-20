export interface CanvasRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface CanvasViewportState {
  scale: number;
  scrollLeft: number;
  scrollTop: number;
  viewportWidth: number;
  viewportHeight: number;
}

export type CanvasToolMode = 'select' | 'pan';

export type CanvasDropPlacement = 'before' | 'after' | 'inside' | 'root';

export interface CanvasDropTarget {
  placement: CanvasDropPlacement;
  targetNodeSchemaId?: string;
}

export interface CanvasSurfaceHandle {
  mode: 'direct' | 'iframe';
  hostElement: HTMLElement | HTMLIFrameElement | null;
  rootElement: HTMLElement | null;
  ownerWindow: Window | null;
  ownerDocument: Document | null;
  getRelativeRect: (target: Element) => CanvasRect;
  findNodeElement: (nodeId: string) => Element | null;
  elementFromPoint: (clientX: number, clientY: number) => Element | null;
}
