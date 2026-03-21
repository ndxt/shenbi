import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CanvasZoomHud } from './CanvasZoomHud';
import type { MinimapModel } from './CanvasMinimap';

function createProps() {
  return {
    scale: 1,
    menuOpen: false,
    menuRef: { current: null },
    onZoomOut: vi.fn(),
    onZoomIn: vi.fn(),
    onToggleMenu: vi.fn(),
    onSelectScale: vi.fn(),
    onFit: vi.fn(),
  };
}

describe('CanvasZoomHud', () => {
  it('renders the shared minimap when a minimap model is provided', () => {
    const minimapModel: MinimapModel = {
      bounds: { x: 0, y: 0, width: 1200, height: 800 },
      viewport: { x: 0, y: 0, width: 1200, height: 800 },
      items: [
        {
          id: 'stage',
          kind: 'stage',
          x: 0,
          y: 0,
          width: 1200,
          height: 800,
        },
      ],
    };

    render(
      <CanvasZoomHud
        {...createProps()}
        minimapModel={minimapModel}
      />,
    );

    expect(screen.getByTestId('canvas-minimap')).toBeInTheDocument();
  });

  it('hides the minimap area when no minimap model is provided', () => {
    render(
      <CanvasZoomHud {...createProps()} />,
    );

    expect(screen.queryByTestId('canvas-minimap')).toBeNull();
  });
});
