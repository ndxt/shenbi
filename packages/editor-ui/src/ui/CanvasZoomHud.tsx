import React from 'react';
import { Minus, Plus } from 'lucide-react';
import type { CanvasViewportState } from '../canvas/types';
import { CANVAS_ZOOM_PRESETS } from '../canvas/constants';

export interface CanvasChromeButtonProps {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export function CanvasChromeButton({
  title,
  active = false,
  disabled = false,
  onClick,
  children,
}: CanvasChromeButtonProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      className={`canvas-chrome-button${active ? ' canvas-chrome-button--active' : ''}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export interface CanvasZoomHudProps {
  scale: number;
  menuOpen: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onToggleMenu: () => void;
  onSelectScale: (nextScale: number) => void;
  onFit: () => void;
  /** Whether to show the minimap visualization (default: true) */
  showMinimap?: boolean;
  /** Minimap-related props — only required when showMinimap is true */
  viewportState?: CanvasViewportState;
  stageWidth?: number;
  stageHeight?: number;
  stageLeft?: number;
  stageTop?: number;
  workspaceWidth?: number;
  workspaceHeight?: number;
}

export function CanvasZoomHud({
  scale,
  menuOpen,
  menuRef,
  onZoomOut,
  onZoomIn,
  onToggleMenu,
  onSelectScale,
  onFit,
  showMinimap = true,
  viewportState,
  stageWidth = 0,
  stageHeight = 0,
  stageLeft = 0,
  stageTop = 0,
}: CanvasZoomHudProps) {
  // Minimap calculations — focus on a region around stage + viewport,
  // not the entire 20000px workspace, so the stage is actually visible.
  const MINIMAP_W = 120;
  const MINIMAP_H = 72;

  let mmStage = { left: 0, top: 0, width: 0, height: 0 };
  let mmViewport = { left: 0, top: 0, width: 0, height: 0 };

  if (showMinimap && viewportState) {
    const stageVisualW = stageWidth * scale;
    const stageVisualH = stageHeight * scale;

    // Viewport rect in workspace coordinates
    const vpX = viewportState.scrollLeft;
    const vpY = viewportState.scrollTop;
    const vpW = viewportState.viewportWidth ?? 1200;
    const vpH = viewportState.viewportHeight ?? 800;

    // Compute bounding box that contains both stage and viewport, with padding
    const regionLeft = Math.min(stageLeft, vpX);
    const regionTop = Math.min(stageTop, vpY);
    const regionRight = Math.max(stageLeft + stageVisualW, vpX + vpW);
    const regionBottom = Math.max(stageTop + stageVisualH, vpY + vpH);
    const regionW = regionRight - regionLeft;
    const regionH = regionBottom - regionTop;
    // Add 30% padding so content doesn't sit at minimap edges
    const pad = Math.max(regionW, regionH) * 0.3;
    const focusX = regionLeft - pad;
    const focusY = regionTop - pad;
    const focusW = regionW + pad * 2;
    const focusH = regionH + pad * 2;

    const mmScale = Math.min(MINIMAP_W / focusW, MINIMAP_H / focusH);
    const mmOffsetX = (MINIMAP_W - focusW * mmScale) / 2 - focusX * mmScale;
    const mmOffsetY = (MINIMAP_H - focusH * mmScale) / 2 - focusY * mmScale;

    mmStage = {
      left: stageLeft * mmScale + mmOffsetX,
      top: stageTop * mmScale + mmOffsetY,
      width: Math.max(stageVisualW * mmScale, 2),
      height: Math.max(stageVisualH * mmScale, 2),
    };

    mmViewport = {
      left: vpX * mmScale + mmOffsetX,
      top: vpY * mmScale + mmOffsetY,
      width: Math.max(vpW * mmScale, 4),
      height: Math.max(vpH * mmScale, 4),
    };
  }

  return (
    <div className="canvas-zoom-hud" aria-label="Canvas Zoom Controls">
      {menuOpen ? (
        <div ref={menuRef} className="canvas-zoom-hud__menu" role="menu" aria-label="Canvas Zoom Presets">
          {CANVAS_ZOOM_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="canvas-zoom-hud__menu-item"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onSelectScale(preset)}
            >
              {Math.round(preset * 100)}%
            </button>
          ))}
          <button
            type="button"
            className="canvas-zoom-hud__menu-item"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onFit}
          >
            Fit
          </button>
        </div>
      ) : null}
      {showMinimap && viewportState ? (
        <div className="canvas-zoom-hud__minimap">
          <div
            className="canvas-zoom-hud__minimap-stage"
            style={{ left: mmStage.left, top: mmStage.top, width: mmStage.width, height: mmStage.height }}
          />
          <div
            className="canvas-zoom-hud__minimap-viewport"
            style={{ left: mmViewport.left, top: mmViewport.top, width: mmViewport.width, height: mmViewport.height }}
          />
        </div>
      ) : null}
      <div className="canvas-zoom-hud__controls">
        <CanvasChromeButton title="Zoom Out" onClick={onZoomOut}>
          <Minus size={14} />
        </CanvasChromeButton>
        <button
          type="button"
          className="canvas-zoom-hud__scale"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onToggleMenu}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          {Math.round(scale * 100)}%
        </button>
        <CanvasChromeButton title="Zoom In" onClick={onZoomIn}>
          <Plus size={14} />
        </CanvasChromeButton>
      </div>
    </div>
  );
}

