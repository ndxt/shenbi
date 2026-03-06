import { describe, expect, it } from 'vitest';
import { createAIChatPlugin } from './plugin';

describe('createAIChatPlugin', () => {
  it('creates an auxiliary panel contribution', () => {
    const plugin = createAIChatPlugin({});

    expect(plugin.id).toBe('shenbi.plugin.ai-chat');
    expect(plugin.contributes?.auxiliaryPanels?.map((panel) => panel.id)).toEqual(['ai-chat']);
  });
});
