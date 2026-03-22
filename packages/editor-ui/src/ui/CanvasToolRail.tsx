import React from 'react';
import {
  Focus,
  Hand,
  LocateFixed,
  MousePointer2,
} from 'lucide-react';
import type { CanvasToolMode } from '../canvas/types';
import { CanvasChromeButton } from './CanvasZoomHud';

export interface CanvasToolRailAction {
  id: string;
  title: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}

export interface CanvasToolRailProps {
  activeTool: CanvasToolMode;
  spacePanActive: boolean;
  focusSelectionDisabled: boolean;
  onSelectTool: () => void;
  onPanTool: () => void;
  onFit: () => void;
  onCenter: () => void;
  onFocusSelection: () => void;
  actions?: CanvasToolRailAction[];
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
  actions,
}: CanvasToolRailProps) {
  const effectivePan = spacePanActive || activeTool === 'pan';
  const effectiveSelect = !spacePanActive && activeTool === 'select';
  const secondaryActions = actions ?? [
    {
      id: 'fit',
      title: 'Fit View (Shift+1)',
      icon: <Focus size={14} />,
      onClick: onFit,
    },
    {
      id: 'center',
      title: 'Center Stage (Shift+2)',
      icon: <LocateFixed size={14} />,
      onClick: onCenter,
    },
    {
      id: 'focus-selection',
      title: 'Focus Selected Node (Shift+3)',
      icon: <span className="canvas-tool-rail__focus-dot" aria-hidden="true" />,
      disabled: focusSelectionDisabled,
      onClick: onFocusSelection,
    },
  ];

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
      {secondaryActions.map((action) => (
        <CanvasChromeButton
          key={action.id}
          title={action.title}
          {...(action.disabled !== undefined ? { disabled: action.disabled } : {})}
          onClick={action.onClick}
        >
          {action.icon}
        </CanvasChromeButton>
      ))}
    </div>
  );
}
