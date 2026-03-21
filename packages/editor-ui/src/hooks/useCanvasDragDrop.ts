import React from 'react';
import type { CanvasSurfaceHandle, CanvasToolMode, CanvasDropTarget } from '../canvas/types';
import { resolveNodeDropIndicator, type CanvasDropIndicator } from '../canvas/drop-indicator';
import { STAGE_MIN_HEIGHT } from '../canvas/constants';
import { readPaletteDragPayload } from '../panels/PalettePanel';

interface CanvasDragSession {
  source: 'component' | 'selected-node';
  componentType?: string;
}

export interface UseCanvasDragDropOptions {
  /** The stage element ref */
  stageRef: React.RefObject<HTMLDivElement | null>;
  /** Canvas surface handle */
  canvasSurface: CanvasSurfaceHandle | null;
  /** Current canvas scale */
  canvasScale: number;
  /** Current stage width */
  stageWidth: number;
  /** Ref to current stage content height */
  stageContentHeightRef: React.RefObject<number>;
  /** Active canvas tool mode */
  activeCanvasTool: CanvasToolMode;
  /** Whether canvas is read-only */
  canvasReadOnly: boolean;
  /** ID of the currently selected node's schema ID */
  selectedNodeSchemaId?: string | undefined;
  /** ID of the currently selected node in the tree */
  selectedNodeTreeId?: string | undefined;
  /** Check if a drop target can accept inside drops */
  canCanvasDropInsideNode?: ((nodeSchemaId: string) => boolean) | undefined;
  /** Callback when a component is inserted via drag-drop */
  onCanvasInsertComponent?: ((componentType: string, target: CanvasDropTarget) => void) | undefined;
  /** Callback when the selected node is moved via drag-drop */
  onCanvasMoveSelectedNode?: ((target: CanvasDropTarget) => void) | undefined;
}

export interface UseCanvasDragDropReturn {
  canvasDragSession: CanvasDragSession | null;
  canvasDropIndicator: CanvasDropIndicator | null;
  clearCanvasDragState: () => void;
  handleCanvasDragOver: (event: React.DragEvent<HTMLElement>) => void;
  handleCanvasDragLeave: (event: React.DragEvent<HTMLElement>) => void;
  handleCanvasDrop: (event: React.DragEvent<HTMLElement>) => void;
  handleSidebarStartDragComponent: (componentType: string) => void;
  handleSidebarEndDragComponent: () => void;
  handleSelectedDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
}

export function useCanvasDragDrop({
  stageRef,
  canvasSurface,
  canvasScale,
  stageWidth,
  stageContentHeightRef,
  activeCanvasTool,
  canvasReadOnly,
  selectedNodeSchemaId,
  selectedNodeTreeId,
  canCanvasDropInsideNode,
  onCanvasInsertComponent,
  onCanvasMoveSelectedNode,
}: UseCanvasDragDropOptions): UseCanvasDragDropReturn {
  const [canvasDragSession, setCanvasDragSession] = React.useState<CanvasDragSession | null>(null);
  const [canvasDropIndicator, setCanvasDropIndicator] = React.useState<CanvasDropIndicator | null>(null);

  const resolvePaletteComponentType = React.useCallback((dataTransfer: DataTransfer | null): string | null => {
    const payload = readPaletteDragPayload(dataTransfer);
    if (!payload || payload.kind !== 'component') {
      return null;
    }
    return payload.type;
  }, []);

  const clearCanvasDragState = React.useCallback(() => {
    setCanvasDragSession(null);
    setCanvasDropIndicator(null);
  }, []);

  // Clear drag state when switching to pan tool
  React.useEffect(() => {
    if (activeCanvasTool === 'pan') {
      clearCanvasDragState();
    }
  }, [activeCanvasTool, clearCanvasDragState]);

  const resolveCanvasDropIndicator = React.useCallback((
    clientX: number,
    clientY: number,
  ): CanvasDropIndicator | null => {
    const stageElement = stageRef.current;
    const surface = canvasSurface;
    if (!stageElement || !surface) {
      return null;
    }

    const stageRect = stageElement.getBoundingClientRect();
    if (
      clientX < stageRect.left
      || clientX > stageRect.right
      || clientY < stageRect.top
      || clientY > stageRect.bottom
    ) {
      return null;
    }

    const localX = (clientX - stageRect.left) / canvasScale;
    const localY = (clientY - stageRect.top) / canvasScale;
    const nodeElements = [...(surface.rootElement?.querySelectorAll('[data-shenbi-node-id]') ?? [])];

    const candidates = nodeElements
      .map((element) => {
        const rect = surface.getRelativeRect(element);
        const contains = (
          localX >= rect.left
          && localX <= rect.left + rect.width
          && localY >= rect.top
          && localY <= rect.top + rect.height
        );
        return { element, rect, area: rect.width * rect.height, contains };
      })
      .filter((item) => item.contains && item.rect.width > 0 && item.rect.height > 0)
      .sort((left, right) => left.area - right.area);

    if (candidates.length === 0) {
      return {
        target: { placement: 'root' },
        top: 0,
        left: 0,
        width: stageWidth,
        height: Math.max(stageContentHeightRef.current, STAGE_MIN_HEIGHT),
        variant: 'frame',
      };
    }

    const hit = candidates[0];
    if (!hit) {
      return null;
    }
    const nodeId = hit.element.getAttribute('data-shenbi-node-id') ?? undefined;
    if (!nodeId) {
      return null;
    }

    return resolveNodeDropIndicator(
      nodeId,
      hit.rect,
      localY,
      canCanvasDropInsideNode?.(nodeId) ?? true,
    );
  }, [canCanvasDropInsideNode, canvasScale, canvasSurface, stageRef, stageWidth, stageContentHeightRef]);

  const updateCanvasDropIndicator = React.useCallback((clientX: number, clientY: number) => {
    setCanvasDropIndicator(resolveCanvasDropIndicator(clientX, clientY));
  }, [resolveCanvasDropIndicator]);

  const handleSidebarStartDragComponent = React.useCallback((componentType: string) => {
    if (canvasReadOnly || activeCanvasTool === 'pan') {
      return;
    }
    setCanvasDragSession({
      source: 'component',
      componentType,
    });
  }, [activeCanvasTool, canvasReadOnly]);

  const handleSidebarEndDragComponent = React.useCallback(() => {
    clearCanvasDragState();
  }, [clearCanvasDragState]);

  const startSelectedNodeDrag = React.useCallback((dataTransfer: DataTransfer | null): boolean => {
    if (canvasReadOnly || activeCanvasTool === 'pan' || !selectedNodeTreeId || !dataTransfer) {
      return false;
    }
    dataTransfer.effectAllowed = 'move';
    dataTransfer.setData('text/plain', selectedNodeTreeId);
    dataTransfer.setData('application/x-shenbi-selected-node', selectedNodeTreeId);
    setCanvasDragSession({
      source: 'selected-node',
    });
    return true;
  }, [activeCanvasTool, canvasReadOnly, selectedNodeTreeId]);

  const handleSelectedDragStart = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!startSelectedNodeDrag(event.dataTransfer)) {
      event.preventDefault();
    }
  }, [startSelectedNodeDrag]);

  // Attach drag handlers to selected node element in iframe mode
  React.useEffect(() => {
    if (!canvasSurface || !selectedNodeSchemaId) {
      return;
    }

    const selectedElement = canvasSurface.findNodeElement(selectedNodeSchemaId);
    if (!(selectedElement instanceof HTMLElement)) {
      return;
    }

    const previousDraggableAttr = selectedElement.getAttribute('draggable');
    const handleDragStart = (event: DragEvent) => {
      if (!startSelectedNodeDrag(event.dataTransfer)) {
        event.preventDefault();
      }
    };
    const handleDragEnd = () => {
      clearCanvasDragState();
    };

    selectedElement.setAttribute('draggable', (!canvasReadOnly && activeCanvasTool !== 'pan' && selectedNodeTreeId) ? 'true' : 'false');
    selectedElement.addEventListener('dragstart', handleDragStart);
    selectedElement.addEventListener('dragend', handleDragEnd);

    return () => {
      selectedElement.removeEventListener('dragstart', handleDragStart);
      selectedElement.removeEventListener('dragend', handleDragEnd);
      if (previousDraggableAttr === null) {
        selectedElement.removeAttribute('draggable');
      } else {
        selectedElement.setAttribute('draggable', previousDraggableAttr);
      }
    };
  }, [
    activeCanvasTool,
    canvasReadOnly,
    canvasSurface,
    clearCanvasDragState,
    selectedNodeSchemaId,
    selectedNodeTreeId,
    startSelectedNodeDrag,
  ]);

  const handleCanvasDragOver = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    if (canvasReadOnly || activeCanvasTool === 'pan') {
      return;
    }
    const draggedComponentType = resolvePaletteComponentType(event.dataTransfer);
    const resolvedSession = canvasDragSession ?? (
      draggedComponentType
        ? { source: 'component' as const, componentType: draggedComponentType }
        : null
    );
    if (!resolvedSession) {
      return;
    }
    event.preventDefault();
    if (
      resolvedSession.source === 'component'
      && resolvedSession.componentType
      && canvasDragSession?.componentType !== resolvedSession.componentType
    ) {
      setCanvasDragSession(resolvedSession);
    }
    event.dataTransfer.dropEffect = resolvedSession.source === 'component' ? 'copy' : 'move';
    updateCanvasDropIndicator(event.clientX, event.clientY);
  }, [activeCanvasTool, canvasDragSession, canvasReadOnly, resolvePaletteComponentType, updateCanvasDropIndicator]);

  const handleCanvasDragLeave = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setCanvasDropIndicator(null);
  }, []);

  const handleCanvasDrop = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    if (canvasReadOnly || activeCanvasTool === 'pan') {
      clearCanvasDragState();
      return;
    }
    const draggedComponentType = resolvePaletteComponentType(event.dataTransfer);
    const resolvedSession = canvasDragSession ?? (
      draggedComponentType
        ? { source: 'component' as const, componentType: draggedComponentType }
        : null
    );
    if (!resolvedSession) {
      clearCanvasDragState();
      return;
    }
    event.preventDefault();
    const indicator = resolveCanvasDropIndicator(event.clientX, event.clientY);
    if (!indicator) {
      clearCanvasDragState();
      return;
    }
    if (resolvedSession.source === 'component' && resolvedSession.componentType) {
      onCanvasInsertComponent?.(resolvedSession.componentType, indicator.target);
    } else if (resolvedSession.source === 'selected-node') {
      onCanvasMoveSelectedNode?.(indicator.target);
    }
    clearCanvasDragState();
  }, [
    activeCanvasTool,
    canvasDragSession,
    canvasReadOnly,
    clearCanvasDragState,
    onCanvasInsertComponent,
    onCanvasMoveSelectedNode,
    resolvePaletteComponentType,
    resolveCanvasDropIndicator,
  ]);

  return {
    canvasDragSession,
    canvasDropIndicator,
    clearCanvasDragState,
    handleCanvasDragOver,
    handleCanvasDragLeave,
    handleCanvasDrop,
    handleSidebarStartDragComponent,
    handleSidebarEndDragComponent,
    handleSelectedDragStart,
  };
}
