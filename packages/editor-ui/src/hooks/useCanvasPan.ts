import React from 'react';
import type { CanvasSurfaceHandle, CanvasToolMode } from '../canvas/types';

export interface UseCanvasPanOptions {
  /** The scrollable workspace container element ref */
  canvasScrollRef: React.RefObject<HTMLElement | null>;
  /** Canvas surface handle for iframe-aware operations */
  canvasSurface: CanvasSurfaceHandle | null;
  /** The active canvas tool mode */
  activeCanvasTool: CanvasToolMode;
  /** Callback to sync viewport state after panning */
  syncCanvasViewportState: () => void;
  /** Callback to close the zoom preset menu when panning starts */
  closeZoomMenu?: () => void;
}

export interface UseCanvasPanReturn {
  isCanvasPanning: boolean;
  isSpacePressed: boolean;
  spacePressedRef: React.RefObject<boolean>;
  shouldStartCanvasPan: (button: number) => boolean;
  startCanvasPan: (pointerId: number, clientX: number, clientY: number) => boolean;
  moveCanvasPan: (pointerId: number, clientX: number, clientY: number) => void;
  endCanvasPan: (pointerId: number) => boolean;
  handleCanvasPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  handleCanvasPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  handleCanvasPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
}

function isElementTarget(target: EventTarget | null): target is HTMLElement {
  return Boolean(target)
    && (target as Node).nodeType === 1
    && typeof (target as HTMLElement).closest === 'function';
}

export function useCanvasPan({
  canvasScrollRef,
  canvasSurface,
  activeCanvasTool,
  syncCanvasViewportState,
  closeZoomMenu,
}: UseCanvasPanOptions): UseCanvasPanReturn {
  const [isCanvasPanning, setIsCanvasPanning] = React.useState(false);
  const spacePressedRef = React.useRef(false);
  const [isSpacePressed, setIsSpacePressed] = React.useState(false);
  const panSessionRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
  } | null>(null);
  const panInteractionCleanupRef = React.useRef<(() => void) | null>(null);

  const clearCanvasPanInteractionGuards = React.useCallback(() => {
    panInteractionCleanupRef.current?.();
    panInteractionCleanupRef.current = null;
  }, []);

  const applyCanvasPanInteractionGuards = React.useCallback(() => {
    clearCanvasPanInteractionGuards();

    const canvasElement = canvasScrollRef.current;
    const ownerDocument = canvasSurface?.ownerDocument ?? null;
    const pageRoot = ownerDocument?.querySelector('[data-shenbi-page-root]') as HTMLElement | null;
    const previousPageRootPointerEvents = pageRoot?.style.pointerEvents ?? '';
    const preventNativeInteraction = (event: Event) => {
      event.preventDefault();
    };

    canvasElement?.classList.add('canvas-surface--panning');
    ownerDocument?.documentElement.classList.add('shenbi-canvas-panning');
    ownerDocument?.body.classList.add('shenbi-canvas-panning');
    if (pageRoot) {
      pageRoot.style.pointerEvents = 'none';
    }
    ownerDocument?.addEventListener('dragstart', preventNativeInteraction, true);
    ownerDocument?.addEventListener('selectstart', preventNativeInteraction, true);

    panInteractionCleanupRef.current = () => {
      canvasElement?.classList.remove('canvas-surface--panning');
      ownerDocument?.documentElement.classList.remove('shenbi-canvas-panning');
      ownerDocument?.body.classList.remove('shenbi-canvas-panning');
      if (pageRoot) {
        pageRoot.style.pointerEvents = previousPageRootPointerEvents;
      }
      ownerDocument?.removeEventListener('dragstart', preventNativeInteraction, true);
      ownerDocument?.removeEventListener('selectstart', preventNativeInteraction, true);
    };
  }, [canvasScrollRef, canvasSurface, clearCanvasPanInteractionGuards]);

  React.useEffect(() => () => {
    clearCanvasPanInteractionGuards();
  }, [clearCanvasPanInteractionGuards]);

  const shouldStartCanvasPan = React.useCallback((button: number) => (
    button === 1
    || (button === 0 && (spacePressedRef.current || activeCanvasTool === 'pan'))
  ), [activeCanvasTool]);

  const startCanvasPan = React.useCallback((
    pointerId: number,
    clientX: number,
    clientY: number,
  ) => {
    const element = canvasScrollRef.current;
    if (!element) {
      return false;
    }
    setIsCanvasPanning(true);
    closeZoomMenu?.();
    applyCanvasPanInteractionGuards();
    panSessionRef.current = {
      pointerId,
      startX: clientX,
      startY: clientY,
      startScrollLeft: element.scrollLeft,
      startScrollTop: element.scrollTop,
    };
    return true;
  }, [applyCanvasPanInteractionGuards, canvasScrollRef, closeZoomMenu]);

  const moveCanvasPan = React.useCallback((pointerId: number, clientX: number, clientY: number) => {
    const session = panSessionRef.current;
    const element = canvasScrollRef.current;
    if (!session || !element || session.pointerId !== pointerId) {
      return;
    }
    element.scrollLeft = session.startScrollLeft - (clientX - session.startX);
    element.scrollTop = session.startScrollTop - (clientY - session.startY);
    syncCanvasViewportState();
  }, [canvasScrollRef, syncCanvasViewportState]);

  const endCanvasPan = React.useCallback((pointerId: number) => {
    if (panSessionRef.current?.pointerId !== pointerId) {
      return false;
    }
    setIsCanvasPanning(false);
    panSessionRef.current = null;
    clearCanvasPanInteractionGuards();
    return true;
  }, [clearCanvasPanInteractionGuards]);

  const handleCanvasPointerDown = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!shouldStartCanvasPan(event.button)) {
      return;
    }
    if (!startCanvasPan(event.pointerId, event.screenX, event.screenY)) {
      return;
    }
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }, [shouldStartCanvasPan, startCanvasPan]);

  const handleCanvasPointerMove = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    moveCanvasPan(event.pointerId, event.screenX, event.screenY);
  }, [moveCanvasPan]);

  const handleCanvasPointerUp = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!endCanvasPan(event.pointerId)) {
      return;
    }
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  }, [endCanvasPan]);

  // Space key detection for temporary pan mode
  React.useEffect(() => {
    const shouldHandleCanvasSpace = (target: EventTarget | null) => {
      const element = isElementTarget(target) ? target : document.activeElement;
      const isTyping = isElementTarget(element)
        && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable);
      return !isTyping;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        if (!shouldHandleCanvasSpace(event.target)) {
          return;
        }
        event.preventDefault();
        if (!event.repeat) {
          spacePressedRef.current = true;
          setIsSpacePressed(true);
        }
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        if (shouldHandleCanvasSpace(event.target)) {
          event.preventDefault();
        }
        spacePressedRef.current = false;
        setIsSpacePressed(false);
      }
    };
    const handleBlur = () => {
      spacePressedRef.current = false;
      setIsSpacePressed(false);
      setIsCanvasPanning(false);
      panSessionRef.current = null;
      clearCanvasPanInteractionGuards();
    };
    const hostDocument = document;
    const hostWindow = window;
    const frameDocument = canvasSurface?.ownerDocument && canvasSurface.ownerDocument !== hostDocument
      ? canvasSurface.ownerDocument
      : null;
    const frameWindow = canvasSurface?.ownerWindow && canvasSurface.ownerWindow !== hostWindow
      ? canvasSurface.ownerWindow
      : null;

    hostDocument.addEventListener('keydown', handleKeyDown, true);
    hostDocument.addEventListener('keyup', handleKeyUp, true);
    hostWindow.addEventListener('keydown', handleKeyDown, true);
    hostWindow.addEventListener('keyup', handleKeyUp, true);
    frameDocument?.addEventListener('keydown', handleKeyDown, true);
    frameDocument?.addEventListener('keyup', handleKeyUp, true);
    frameWindow?.addEventListener('keydown', handleKeyDown, true);
    frameWindow?.addEventListener('keyup', handleKeyUp, true);
    hostWindow.addEventListener('blur', handleBlur, true);
    frameWindow?.addEventListener('blur', handleBlur, true);
    return () => {
      hostDocument.removeEventListener('keydown', handleKeyDown, true);
      hostDocument.removeEventListener('keyup', handleKeyUp, true);
      hostWindow.removeEventListener('keydown', handleKeyDown, true);
      hostWindow.removeEventListener('keyup', handleKeyUp, true);
      frameDocument?.removeEventListener('keydown', handleKeyDown, true);
      frameDocument?.removeEventListener('keyup', handleKeyUp, true);
      frameWindow?.removeEventListener('keydown', handleKeyDown, true);
      frameWindow?.removeEventListener('keyup', handleKeyUp, true);
      hostWindow.removeEventListener('blur', handleBlur, true);
      frameWindow?.removeEventListener('blur', handleBlur, true);
    };
  }, [canvasSurface, clearCanvasPanInteractionGuards]);

  // Iframe pointer pan handling
  React.useEffect(() => {
    if (canvasSurface?.mode !== 'iframe' || !canvasSurface.rootElement) {
      return;
    }
    const rootElement = canvasSurface.rootElement;

    const handlePointerDown = (event: PointerEvent) => {
      if (!shouldStartCanvasPan(event.button)) {
        return;
      }
      if (!startCanvasPan(event.pointerId, event.screenX, event.screenY)) {
        return;
      }
      event.preventDefault();
      rootElement.setPointerCapture(event.pointerId);
    };
    const handlePointerMove = (event: PointerEvent) => {
      moveCanvasPan(event.pointerId, event.screenX, event.screenY);
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (!endCanvasPan(event.pointerId)) {
        return;
      }
      try { rootElement.releasePointerCapture(event.pointerId); } catch { /* noop */ }
    };

    rootElement.addEventListener('pointerdown', handlePointerDown, true);
    rootElement.addEventListener('pointermove', handlePointerMove, true);
    rootElement.addEventListener('pointerup', handlePointerUp, true);
    rootElement.addEventListener('pointercancel', handlePointerUp, true);
    return () => {
      rootElement.removeEventListener('pointerdown', handlePointerDown, true);
      rootElement.removeEventListener('pointermove', handlePointerMove, true);
      rootElement.removeEventListener('pointerup', handlePointerUp, true);
      rootElement.removeEventListener('pointercancel', handlePointerUp, true);
    };
  }, [canvasSurface, endCanvasPan, moveCanvasPan, shouldStartCanvasPan, startCanvasPan]);

  return {
    isCanvasPanning,
    isSpacePressed,
    spacePressedRef,
    shouldStartCanvasPan,
    startCanvasPan,
    moveCanvasPan,
    endCanvasPan,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
  };
}
