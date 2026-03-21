import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { CANVAS_ZOOM_PRESETS } from '../canvas/constants';
import { CanvasMinimap, type MinimapModel } from './CanvasMinimap';

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
  className?: string;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onToggleMenu: () => void;
  onSelectScale: (nextScale: number) => void;
  onFit: () => void;
  /** Whether to show the minimap visualization (default: true) */
  showMinimap?: boolean;
  minimapModel?: MinimapModel;
}

export function CanvasZoomHud({
  scale,
  menuOpen,
  menuRef,
  className,
  onZoomOut,
  onZoomIn,
  onToggleMenu,
  onSelectScale,
  onFit,
  showMinimap = true,
  minimapModel,
}: CanvasZoomHudProps) {
  const shouldRenderMinimap = showMinimap && Boolean(minimapModel);

  return (
    <div className={className ? `canvas-zoom-hud ${className}` : 'canvas-zoom-hud'} aria-label="Canvas Zoom Controls">
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
      {shouldRenderMinimap ? (
        <div
          className="canvas-zoom-hud__minimap"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <CanvasMinimap model={minimapModel!} />
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
