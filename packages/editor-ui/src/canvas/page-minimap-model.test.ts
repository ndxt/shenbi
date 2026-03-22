import { describe, expect, it } from 'vitest';
import { buildPageMinimapModel } from './page-minimap-model';

describe('buildPageMinimapModel', () => {
  it('builds a stage and viewport minimap model from canvas state', () => {
    const model = buildPageMinimapModel({
      viewportState: {
        scrollLeft: 200,
        scrollTop: 120,
        viewportWidth: 400,
        viewportHeight: 300,
        scale: 1,
      },
      canvasScale: 2,
      stageWidth: 1200,
      stageHeight: 800,
      stageLeft: 100,
      stageTop: 20,
    });

    expect(model.items).toHaveLength(1);
    expect(model.items[0]?.id).toBe('page-stage');
    expect(model.viewport).toEqual({
      x: 50,
      y: 50,
      width: 200,
      height: 150,
    });
    expect(model.bounds).toEqual({
      x: 0,
      y: 0,
      width: 1200,
      height: 800,
    });
  });
});
