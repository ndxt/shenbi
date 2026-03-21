import type React from 'react';

export const STAGE_DEFAULT_WIDTH = 1200;
export const STAGE_MIN_HEIGHT = 800;
export const MIN_CANVAS_SCALE = 0.25;
export const MAX_CANVAS_SCALE = 2;
export const CANVAS_ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2] as const;
export const CANVAS_WHEEL_ZOOM_SENSITIVITY = 0.0015;

export interface DevicePreset {
  id: string;
  label: string;
  width: number;
  icon: React.FC<{ size?: number }>;
  frame?: 'phone' | 'tablet' | 'monitor';
}

/** Frame padding: [top, right, bottom, left] */
export const DEVICE_FRAME_PADDING: Record<string, [number, number, number, number]> = {
  phone: [48, 12, 40, 12],
  tablet: [28, 20, 28, 20],
  monitor: [20, 20, 56, 20],
};
