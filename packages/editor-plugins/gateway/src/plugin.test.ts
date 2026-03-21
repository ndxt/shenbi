import { describe, expect, it } from 'vitest';
import { createGatewayPlugin } from './plugin';

describe('createGatewayPlugin', () => {
  it('creates manifest with correct id', () => {
    const plugin = createGatewayPlugin();
    expect(plugin.id).toBe('shenbi.plugin.gateway');
    expect(plugin.name).toBe('API 工作流编辑器');
  });

  it('registers fileContextPanels for api file type', () => {
    const plugin = createGatewayPlugin();
    const panels = plugin.contributes?.fileContextPanels;
    expect(panels).toHaveLength(1);
    expect(panels?.[0].id).toBe('components');
    expect(panels?.[0].fileTypes).toEqual(['api']);
  });

  it('registers canvasRenderers for api file type', () => {
    const plugin = createGatewayPlugin();
    const renderers = plugin.contributes?.canvasRenderers;
    expect(renderers).toHaveLength(1);
    expect(renderers?.[0].id).toBe('gateway-canvas');
    expect(renderers?.[0].fileTypes).toEqual(['api']);
  });
});
