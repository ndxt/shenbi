import React from 'react';
import { Frame } from 'lucide-react';
import type { DevicePreset } from '../canvas/constants';
import { CANVAS_ZOOM_PRESETS } from '../canvas/constants';

export interface DevicePreviewBarProps {
  presets: DevicePreset[];
  activeDeviceId: string;
  stageWidth: number;
  stageMinHeight: number;
  scale: number;
  showDeviceFrame: boolean;
  hasFrame: boolean;
  onSelectDevice: (id: string) => void;
  onChangeWidth: (w: number) => void;
  onToggleFrame: () => void;
  onSelectScale: (s: number) => void;
  onFit: () => void;
}

/** Device preview bar: device preset switcher + dimensions + frame toggle */
export function DevicePreviewBar({
  presets,
  activeDeviceId,
  stageWidth,
  stageMinHeight,
  scale,
  showDeviceFrame,
  hasFrame,
  onSelectDevice,
  onChangeWidth,
  onToggleFrame,
  onSelectScale,
  onFit,
}: DevicePreviewBarProps) {
  const [editingWidth, setEditingWidth] = React.useState(false);
  const [widthInput, setWidthInput] = React.useState(String(stageWidth));
  const [zoomMenuOpen, setZoomMenuOpen] = React.useState(false);
  const zoomMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!editingWidth) {
      setWidthInput(String(stageWidth));
    }
  }, [stageWidth, editingWidth]);

  const commitWidth = () => {
    const parsed = parseInt(widthInput, 10);
    if (!Number.isNaN(parsed) && parsed >= 200 && parsed <= 3840) {
      onChangeWidth(parsed);
      if (activeDeviceId !== 'custom') {
        onSelectDevice('custom');
      }
    } else {
      setWidthInput(String(stageWidth));
    }
    setEditingWidth(false);
  };

  return (
      <div className="device-preview-bar">
        <div className="device-preview-bar__devices">
          {presets.map((preset) => {
            const Icon = preset.icon;
            return (
              <button
                key={preset.id}
                type="button"
                className={`device-preview-bar__device-btn${activeDeviceId === preset.id ? ' device-preview-bar__device-btn--active' : ''}`}
                title={`${preset.label} (${preset.width}px)`}
                onClick={() => onSelectDevice(preset.id)}
              >
                <Icon size={13} />
              </button>
            );
          })}
        </div>
        <div className="device-preview-bar__sep" />
        <div className="device-preview-bar__dims">
          {editingWidth ? (
            <input
              className="device-preview-bar__dim-input"
              value={widthInput}
              autoFocus
              onChange={(e) => setWidthInput(e.target.value)}
              onBlur={commitWidth}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitWidth();
                if (e.key === 'Escape') {
                  setWidthInput(String(stageWidth));
                  setEditingWidth(false);
                }
              }}
            />
          ) : (
            <span
              style={{ cursor: 'text' }}
              onClick={() => setEditingWidth(true)}
            >
              {stageWidth}
            </span>
          )}
          <span>×</span>
          <span>{stageMinHeight}</span>
          <span
            style={{ marginLeft: 4, opacity: 0.6, cursor: 'pointer', position: 'relative' }}
            onClick={() => setZoomMenuOpen((v) => !v)}
          >
            {Math.round(scale * 100)}%
            {zoomMenuOpen ? (
              <div ref={zoomMenuRef} className="canvas-zoom-hud__menu" role="menu" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 'calc(100% + 8px)', bottom: 'auto', right: 'auto' }}>
                {CANVAS_ZOOM_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="canvas-zoom-hud__menu-item"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onSelectScale(preset); setZoomMenuOpen(false); }}
                  >
                    {Math.round(preset * 100)}%
                  </button>
                ))}
                <button
                  type="button"
                  className="canvas-zoom-hud__menu-item"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onFit(); setZoomMenuOpen(false); }}
                >
                  Fit
                </button>
              </div>
            ) : null}
          </span>
        </div>
        {hasFrame ? (
          <>
            <div className="device-preview-bar__sep" />
            <button
              type="button"
              className={`device-preview-bar__frame-toggle${showDeviceFrame ? ' device-preview-bar__frame-toggle--active' : ''}`}
              onClick={onToggleFrame}
              title="Toggle Device Frame"
            >
              <Frame size={11} />
              <span>Frame</span>
            </button>
          </>
        ) : null}
      </div>
  );
}
