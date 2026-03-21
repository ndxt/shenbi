import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CanvasMinimap, type MinimapModel } from './CanvasMinimap';

describe('CanvasMinimap', () => {
  it('renders a stage-only model with a viewport frame', () => {
    const model: MinimapModel = {
      bounds: { x: 0, y: 0, width: 1200, height: 800 },
      viewport: { x: 100, y: 120, width: 600, height: 400 },
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

    render(<CanvasMinimap model={model} />);

    expect(screen.getByTestId('canvas-minimap-item-stage')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-minimap-viewport')).toBeInTheDocument();
  });

  it('renders multiple node blocks from a node-list model', () => {
    const model: MinimapModel = {
      bounds: { x: 0, y: 0, width: 900, height: 500 },
      viewport: { x: 50, y: 50, width: 600, height: 300 },
      items: [
        {
          id: 'node-a',
          kind: 'node',
          x: 0,
          y: 0,
          width: 200,
          height: 60,
        },
        {
          id: 'node-b',
          kind: 'node',
          x: 360,
          y: 180,
          width: 220,
          height: 60,
        },
      ],
    };

    render(<CanvasMinimap model={model} />);

    expect(screen.getByTestId('canvas-minimap-item-node-a')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-minimap-item-node-b')).toBeInTheDocument();
  });

  it('keeps viewport dimensions valid for tiny bounds', () => {
    const model: MinimapModel = {
      bounds: { x: 10, y: 10, width: 0.001, height: 0.001 },
      viewport: { x: 10, y: 10, width: 0.0005, height: 0.0005 },
      items: [],
    };

    render(<CanvasMinimap model={model} />);

    const viewport = screen.getByTestId('canvas-minimap-viewport');
    expect(Number(viewport.getAttribute('width'))).toBeGreaterThan(0);
    expect(Number(viewport.getAttribute('height'))).toBeGreaterThan(0);
  });
});
