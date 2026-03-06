import { describe, expect, it } from 'vitest';
import { createSetterPlugin } from './plugin';

describe('createSetterPlugin', () => {
  it('creates builtin inspector tabs', () => {
    const plugin = createSetterPlugin();

    expect(plugin.id).toBe('shenbi.plugin.setter');
    expect(plugin.contributes?.inspectorTabs?.map((tab) => tab.id)).toEqual([
      'props',
      'style',
      'events',
      'logic',
      'actions',
    ]);
  });
});
