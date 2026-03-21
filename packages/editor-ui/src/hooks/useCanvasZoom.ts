import React from 'react';
import type { CanvasSurfaceHandle, CanvasViewportState } from '../canvas/types';
import {
  STAGE_MIN_HEIGHT,
  MIN_CANVAS_SCALE,
  MAX_CANVAS_SCALE,
  CANVAS_WHEEL_ZOOM_SENSITIVITY,
} from '../canvas/constants';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function resolveWheelZoomScale(currentScale: number, deltaY: number): number {
  const zoomFactor = Math.exp(-deltaY * CANVAS_WHEEL_ZOOM_SENSITIVITY);
  return clamp(currentScale * zoomFactor, MIN_CANVAS_SCALE, MAX_CANVAS_SCALE);
}

export interface UseCanvasZoomOptions {
  /** The scrollable workspace container element ref */
  canvasScrollRef: React.RefObject<HTMLElement | null>;
  /** The stage element ref (the area the user content sits in) */
  stageRef: React.RefObject<HTMLDivElement | null>;
  /** Canvas surface handle for iframe‐aware operations */
  canvasSurface: CanvasSurfaceHandle | null;
  /** Current stage width in design pixels */
  stageWidth: number;
  /** ID of the currently selected node (for focus‐selection) */
  selectedNodeSchemaId?: string;
  /** Base workspace dimension (typically 20000) */
  workspaceBaseSize?: number;
  /** Stage Y offset inside the workspace */
  workspaceStageTop?: number;
}

export interface UseCanvasZoomReturn {
  canvasScale: number;
  canvasScaleRef: React.RefObject<number>;
  canvasViewportState: CanvasViewportState;
  stageContentHeight: number;
  stageContentHeightRef: React.RefObject<number>;
  canvasWorkspaceWidth: number;
  canvasWorkspaceHeight: number;
  canvasStageLeft: number;
  /** Stage Y offset inside the workspace */
  canvasStageTop: number;
  zoomMenuState: { open: boolean };
  setZoomMenuState: React.Dispatch<React.SetStateAction<{ open: boolean }>>;
  zoomMenuRef: React.RefObject<HTMLDivElement | null>;
  canvasChromeRef: React.RefObject<HTMLDivElement | null>;
  updateCanvasScale: (nextScale: number, anchor?: { clientX: number; clientY: number }) => void;
  zoomCanvasIn: () => void;
  zoomCanvasOut: () => void;
  resetCanvasZoom: () => void;
  fitCanvasToViewport: () => void;
  centerCanvasStage: () => void;
  focusCanvasSelection: () => void;
  updateCanvasScalePreset: (nextScale: number) => void;
  syncCanvasViewportState: () => void;
  handleCanvasWheelEvent: (event: {
    ctrlKey: boolean;
    metaKey: boolean;
    deltaY: number;
    clientX: number;
    clientY: number;
    preventDefault: () => void;
    stopPropagation?: () => void;
  }) => void;
}

export function useCanvasZoom({
  canvasScrollRef,
  stageRef,
  canvasSurface,
  stageWidth,
  selectedNodeSchemaId,
  workspaceBaseSize = 20000,
  workspaceStageTop = 5000,
}: UseCanvasZoomOptions): UseCanvasZoomReturn {
  const [canvasScale, setCanvasScale] = React.useState(1);
  const canvasScaleRef = React.useRef(1);
  canvasScaleRef.current = canvasScale;

  const [stageContentHeight, setStageContentHeight] = React.useState(STAGE_MIN_HEIGHT);
  const stageContentHeightRef = React.useRef(STAGE_MIN_HEIGHT);

  const [canvasViewportState, setCanvasViewportState] = React.useState<CanvasViewportState>({
    scale: 1,
    scrollLeft: 0,
    scrollTop: 0,
    viewportWidth: 0,
    viewportHeight: 0,
  });

  const [zoomMenuState, setZoomMenuState] = React.useState<{ open: boolean }>({ open: false });
  const zoomMenuRef = React.useRef<HTMLDivElement | null>(null);
  const canvasChromeRef = React.useRef<HTMLDivElement | null>(null);
  const canvasScaleRafRef = React.useRef<number | null>(null);

  const canvasWorkspaceWidth = workspaceBaseSize;
  const canvasStageLeft = Math.round((workspaceBaseSize - stageWidth * canvasScale) / 2);

  const canvasWorkspaceHeight = React.useMemo(() => {
    const stageVisualBottom = workspaceStageTop
      + Math.max(stageContentHeight, STAGE_MIN_HEIGHT) * canvasScale;
    return Math.max(workspaceBaseSize, stageVisualBottom + 5000);
  }, [canvasScale, stageContentHeight, workspaceBaseSize, workspaceStageTop]);

  const syncCanvasViewportState = React.useCallback(() => {
    const element = canvasScrollRef.current;
    if (!element) {
      return;
    }
    setCanvasViewportState({
      scale: canvasScale,
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop,
      viewportWidth: element.clientWidth,
      viewportHeight: element.clientHeight,
    });
  }, [canvasScale, canvasScrollRef]);

  React.useEffect(() => () => {
    if (canvasScaleRafRef.current !== null) {
      cancelAnimationFrame(canvasScaleRafRef.current);
    }
  }, []);

  const centerCanvasOnStage = React.useCallback((nextScale: number) => {
    const element = canvasScrollRef.current;
    if (!element) {
      return;
    }
    const scaledWidth = stageWidth * nextScale;
    const stageHeight = Math.max(stageContentHeightRef.current, STAGE_MIN_HEIGHT);
    const scaledHeight = stageHeight * nextScale;
    const wsStageLeft = Math.round((workspaceBaseSize - scaledWidth) / 2);
    const nextScrollLeft = Math.max(
      0,
      wsStageLeft + scaledWidth / 2 - element.clientWidth / 2,
    );
    const nextScrollTop = Math.max(
      0,
      workspaceStageTop + scaledHeight / 2 - element.clientHeight / 2,
    );
    element.scrollLeft = nextScrollLeft;
    element.scrollTop = nextScrollTop;
    setCanvasViewportState({
      scale: nextScale,
      scrollLeft: nextScrollLeft,
      scrollTop: nextScrollTop,
      viewportWidth: element.clientWidth,
      viewportHeight: element.clientHeight,
    });
  }, [canvasScrollRef, stageWidth, workspaceBaseSize, workspaceStageTop]);

  const updateCanvasScale = React.useCallback((
    nextScaleInput: number,
    anchor?: { clientX: number; clientY: number },
  ) => {
    const element = canvasScrollRef.current;
    const previousScale = canvasScaleRef.current;
    const nextScale = clamp(nextScaleInput, MIN_CANVAS_SCALE, MAX_CANVAS_SCALE);
    if (!element || nextScale === previousScale) {
      canvasScaleRef.current = nextScale;
      setCanvasScale(nextScale);
      return;
    }
    if (canvasScaleRafRef.current !== null) {
      cancelAnimationFrame(canvasScaleRafRef.current);
      canvasScaleRafRef.current = null;
    }

    if (!anchor) {
      canvasScaleRef.current = nextScale;
      setCanvasScale(nextScale);
      canvasScaleRafRef.current = requestAnimationFrame(() => {
        centerCanvasOnStage(nextScale);
        canvasScaleRafRef.current = null;
      });
      return;
    }

    const viewportRect = element.getBoundingClientRect();
    const pointerX = anchor.clientX - viewportRect.left;
    const pointerY = anchor.clientY - viewportRect.top;
    const currentStageLeft = Math.round((workspaceBaseSize - stageWidth * previousScale) / 2);
    const stageRelativeX = element.scrollLeft + pointerX - currentStageLeft;
    const stageRelativeY = element.scrollTop + pointerY - workspaceStageTop;
    const scaledX = (stageRelativeX / previousScale) * nextScale;
    const scaledY = (stageRelativeY / previousScale) * nextScale;

    canvasScaleRef.current = nextScale;
    setCanvasScale(nextScale);
    canvasScaleRafRef.current = requestAnimationFrame(() => {
      const nextStageCenterX = Math.round(
        (workspaceBaseSize - stageWidth * nextScale) / 2,
      );
      const nextScrollLeft = nextStageCenterX + scaledX - pointerX;
      const nextScrollTop = workspaceStageTop + scaledY - pointerY;
      element.scrollLeft = Math.max(0, nextScrollLeft);
      element.scrollTop = Math.max(0, nextScrollTop);
      setCanvasViewportState({
        scale: nextScale,
        scrollLeft: element.scrollLeft,
        scrollTop: element.scrollTop,
        viewportWidth: element.clientWidth,
        viewportHeight: element.clientHeight,
      });
      canvasScaleRafRef.current = null;
    });
  }, [canvasScrollRef, centerCanvasOnStage, stageWidth, workspaceBaseSize, workspaceStageTop]);

  const zoomCanvasIn = React.useCallback(() => {
    updateCanvasScale(canvasScale + 0.1);
  }, [canvasScale, updateCanvasScale]);

  const zoomCanvasOut = React.useCallback(() => {
    updateCanvasScale(canvasScale - 0.1);
  }, [canvasScale, updateCanvasScale]);

  const resetCanvasZoom = React.useCallback(() => {
    updateCanvasScale(1);
  }, [updateCanvasScale]);

  const fitCanvasToViewport = React.useCallback(() => {
    const element = canvasScrollRef.current;
    if (!element) {
      return;
    }
    const availableWidth = Math.max(element.clientWidth - 160, 320);
    const availableHeight = Math.max(element.clientHeight - 160, 240);
    const nextScale = clamp(
      Math.min(availableWidth / stageWidth, availableHeight / STAGE_MIN_HEIGHT),
      MIN_CANVAS_SCALE,
      MAX_CANVAS_SCALE,
    );
    setCanvasScale(nextScale);
    requestAnimationFrame(() => {
      centerCanvasOnStage(nextScale);
    });
  }, [canvasScrollRef, centerCanvasOnStage, stageWidth]);

  const centerCanvasStage = React.useCallback(() => {
    centerCanvasOnStage(canvasScale);
  }, [canvasScale, centerCanvasOnStage]);

  const focusCanvasSelection = React.useCallback(() => {
    const element = canvasScrollRef.current;
    if (!element || !canvasSurface || !selectedNodeSchemaId) {
      return;
    }

    const selectedElement = canvasSurface.findNodeElement(selectedNodeSchemaId);
    if (!selectedElement) {
      return;
    }

    const rect = canvasSurface.getRelativeRect(selectedElement);
    const nextScrollLeft = canvasStageLeft + (rect.left + rect.width / 2) * canvasScale - element.clientWidth / 2;
    const nextScrollTop = workspaceStageTop + (rect.top + rect.height / 2) * canvasScale - element.clientHeight / 2;
    element.scrollLeft = Math.max(0, nextScrollLeft);
    element.scrollTop = Math.max(0, nextScrollTop);
    syncCanvasViewportState();
  }, [canvasScale, canvasScrollRef, canvasStageLeft, canvasSurface, selectedNodeSchemaId, syncCanvasViewportState, workspaceStageTop]);

  const updateCanvasScalePreset = React.useCallback((nextScale: number) => {
    updateCanvasScale(nextScale);
    setZoomMenuState({ open: false });
  }, [updateCanvasScale]);

  const handleCanvasWheelEvent = React.useCallback((event: {
    ctrlKey: boolean;
    metaKey: boolean;
    deltaY: number;
    clientX: number;
    clientY: number;
    preventDefault: () => void;
    stopPropagation?: () => void;
  }) => {
    if (!(event.ctrlKey || event.metaKey)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation?.();
    updateCanvasScale(resolveWheelZoomScale(canvasScale, event.deltaY), {
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }, [canvasScale, updateCanvasScale]);

  // Close zoom menu on outside click
  React.useEffect(() => {
    if (!zoomMenuState.open) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        zoomMenuRef.current?.contains(target)
        || canvasChromeRef.current?.contains(target)
      ) {
        return;
      }
      setZoomMenuState({ open: false });
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setZoomMenuState({ open: false });
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [zoomMenuState.open]);

  // Center canvas on stage when mounted
  React.useEffect(() => {
    const element = canvasScrollRef.current;
    if (!element) {
      return;
    }
    centerCanvasOnStage(canvasScale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerCanvasOnStage]);

  // Sync viewport state on scroll
  React.useEffect(() => {
    const element = canvasScrollRef.current;
    if (!element) {
      return;
    }
    const handleScroll = () => {
      syncCanvasViewportState();
    };
    element.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      element.removeEventListener('scroll', handleScroll);
    };
  }, [canvasScrollRef, syncCanvasViewportState]);

  // Track actual stage content height for dynamic workspace sizing
  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const sync = () => {
      const measured = stage.scrollHeight;
      if (measured !== stageContentHeightRef.current) {
        stageContentHeightRef.current = measured;
        setStageContentHeight(measured);
      }
    };
    sync();
    const observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => { sync(); })
      : null;
    observer?.observe(stage);
    return () => {
      observer?.disconnect();
    };
  }, [canvasSurface, stageRef]);

  // Wheel zoom on main canvas viewport
  React.useEffect(() => {
    const element = canvasScrollRef.current;
    if (!element) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      handleCanvasWheelEvent(event);
    };

    element.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => {
      element.removeEventListener('wheel', handleWheel, true);
    };
  }, [canvasScrollRef, handleCanvasWheelEvent]);

  // Wheel zoom on iframe content
  React.useEffect(() => {
    if (canvasSurface?.mode !== 'iframe' || !canvasSurface.ownerDocument) {
      return;
    }

    const ownerDocument = canvasSurface.ownerDocument;
    const frameElement = canvasSurface.hostElement as HTMLIFrameElement;
    const handleWheel = (event: WheelEvent) => {
      const frameRect = frameElement.getBoundingClientRect();
      handleCanvasWheelEvent({
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        deltaY: event.deltaY,
        clientX: frameRect.left + event.clientX,
        clientY: frameRect.top + event.clientY,
        preventDefault: () => event.preventDefault(),
        stopPropagation: () => event.stopPropagation(),
      });
    };

    ownerDocument.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => {
      ownerDocument.removeEventListener('wheel', handleWheel, true);
    };
  }, [canvasSurface, handleCanvasWheelEvent]);

  return {
    canvasScale,
    canvasScaleRef,
    canvasViewportState,
    stageContentHeight,
    stageContentHeightRef,
    canvasWorkspaceWidth,
    canvasWorkspaceHeight,
    canvasStageLeft,
    canvasStageTop: workspaceStageTop,
    zoomMenuState,
    setZoomMenuState,
    zoomMenuRef,
    canvasChromeRef,
    updateCanvasScale,
    zoomCanvasIn,
    zoomCanvasOut,
    resetCanvasZoom,
    fitCanvasToViewport,
    centerCanvasStage,
    focusCanvasSelection,
    updateCanvasScalePreset,
    syncCanvasViewportState,
    handleCanvasWheelEvent,
  };
}
