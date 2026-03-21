import React from 'react';
import {
  Focus,
  Hand,
  LocateFixed,
  MousePointer2,
} from 'lucide-react';
import type { CanvasToolMode } from '../canvas/types';
import { CanvasChromeButton } from './CanvasZoomHud';

export interface CanvasToolRailProps {
  activeTool: CanvasToolMode;
  spacePanActive: boolean;
  focusSelectionDisabled: boolean;
  onSelectTool: () => void;
  onPanTool: () => void;
  onFit: () => void;
  onCenter: () => void;
  onFocusSelection: () => void;
}

export function CanvasToolRail({
  activeTool,
  spacePanActive,
  focusSelectionDisabled,
  onSelectTool,
  onPanTool,
  onFit,
  onCenter,
  onFocusSelection,
}: CanvasToolRailProps) {
  const effectivePan = spacePanActive || activeTool === 'pan';
  const effectiveSelect = !spacePanActive && activeTool === 'select';
  return (
    <div className="canvas-tool-rail" role="toolbar" aria-label="Canvas Tools">
      <CanvasChromeButton
        title="Selection Tool (V)"
        active={effectiveSelect}
        onClick={onSelectTool}
      >
        <MousePointer2 size={14} />
      </CanvasChromeButton>
      <CanvasChromeButton
        title="Hand Tool (H)"
        active={effectivePan}
        onClick={onPanTool}
      >
        <Hand size={14} />
      </CanvasChromeButton>
      <div className="canvas-tool-rail__divider" />
      <CanvasChromeButton title="Fit View (Shift+1)" onClick={onFit}>
        <Focus size={14} />
      </CanvasChromeButton>
      <CanvasChromeButton title="Center Stage (Shift+2)" onClick={onCenter}>
        <LocateFixed size={14} />
      </CanvasChromeButton>
      <CanvasChromeButton
        title="Focus Selected Node (Shift+3)"
        disabled={focusSelectionDisabled}
        onClick={onFocusSelection}
      >
        <span className="canvas-tool-rail__focus-dot" aria-hidden="true" />
      </CanvasChromeButton>
    </div>
  );
}
