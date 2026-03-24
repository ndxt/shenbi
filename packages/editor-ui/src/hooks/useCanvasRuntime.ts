// ---------------------------------------------------------------------------
// useCanvasRuntime — manages canvas runtime state, zoom, pan controls
// Extracted from AppShell to reduce its size and improve testability.
// ---------------------------------------------------------------------------

import { useCallback, useRef, useState } from 'react';
import type { CanvasRendererHostRuntime } from '@shenbi/editor-plugin-api';
import type { CanvasSurfaceHandle, CanvasToolMode } from '../canvas/types';

export interface CanvasRuntimeState {
  canvasSurface: CanvasSurfaceHandle | null;
  setCanvasSurface: (surface: CanvasSurfaceHandle | null) => void;
  canvasRuntime: CanvasRendererHostRuntime | null;
  canvasRuntimeRef: React.RefObject<CanvasRendererHostRuntime | null>;
  handleCanvasRuntimeReady: (runtime: CanvasRendererHostRuntime | null) => void;
  activeCanvasTool: CanvasToolMode;
  setActiveCanvasTool: React.Dispatch<React.SetStateAction<CanvasToolMode>>;
  canvasScale: number;
  isCanvasPanning: boolean;
  isSpacePressed: boolean;
  canvasDragSession: boolean;
  zoomCanvasIn: () => void;
  zoomCanvasOut: () => void;
  resetCanvasZoom: () => void;
  fitCanvasToViewport: () => void;
  centerCanvasStage: () => void;
  focusCanvasSelection: () => void;
  handleSidebarStartDragComponent: (componentType: string) => void;
  handleSidebarEndDragComponent: () => void;
}

export function useCanvasRuntime(): CanvasRuntimeState {
  const [canvasSurface, setCanvasSurface] = useState<CanvasSurfaceHandle | null>(null);
  const [canvasRuntime, setCanvasRuntime] = useState<CanvasRendererHostRuntime | null>(null);
  const canvasRuntimeRef = useRef<CanvasRendererHostRuntime | null>(null);
  canvasRuntimeRef.current = canvasRuntime;

  const handleCanvasRuntimeReady = useCallback((runtime: CanvasRendererHostRuntime | null) => {
    setCanvasRuntime((current) => (current === runtime ? current : runtime));
  }, []);

  const [activeCanvasTool, setActiveCanvasTool] = useState<CanvasToolMode>('select');

  const zoomCanvasIn = useCallback(() => {
    canvasRuntimeRef.current?.zoomIn?.();
  }, []);
  const zoomCanvasOut = useCallback(() => {
    canvasRuntimeRef.current?.zoomOut?.();
  }, []);
  const resetCanvasZoom = useCallback(() => {
    canvasRuntimeRef.current?.resetZoom?.();
  }, []);
  const fitCanvasToViewport = useCallback(() => {
    canvasRuntimeRef.current?.fitCanvas?.();
  }, []);
  const centerCanvasStage = useCallback(() => {
    canvasRuntimeRef.current?.centerCanvas?.();
  }, []);
  const focusCanvasSelection = useCallback(() => {
    canvasRuntimeRef.current?.focusSelection?.();
  }, []);
  const handleSidebarStartDragComponent = useCallback((componentType: string) => {
    canvasRuntimeRef.current?.startSidebarDragComponent?.(componentType);
  }, []);
  const handleSidebarEndDragComponent = useCallback(() => {
    canvasRuntimeRef.current?.endSidebarDragComponent?.();
  }, []);

  const canvasScale = canvasRuntime?.getScale?.() ?? 1;
  const isCanvasPanning = canvasRuntime?.isCanvasPanning?.() ?? false;
  const isSpacePressed = canvasRuntime?.isSpacePanActive?.() ?? false;
  const canvasDragSession = canvasRuntime?.hasCanvasDragSession?.() ?? false;

  return {
    canvasSurface,
    setCanvasSurface,
    canvasRuntime,
    canvasRuntimeRef,
    handleCanvasRuntimeReady,
    activeCanvasTool,
    setActiveCanvasTool,
    canvasScale,
    isCanvasPanning,
    isSpacePressed,
    canvasDragSession,
    zoomCanvasIn,
    zoomCanvasOut,
    resetCanvasZoom,
    fitCanvasToViewport,
    centerCanvasStage,
    focusCanvasSelection,
    handleSidebarStartDragComponent,
    handleSidebarEndDragComponent,
  };
}
