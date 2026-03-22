import { describe, expect, it } from 'vitest';
import type { ComponentContract } from '@shenbi/schema';
import { buildPagePaletteAssets } from './page-palette-assets';

const t = (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key;

describe('buildPagePaletteAssets', () => {
  it('groups contracts by category and preserves nested component children', () => {
    const contracts = [
      {
        componentType: 'Layout',
        category: 'layout',
        icon: 'Box',
        displayNameKey: 'componentName.layout',
      },
      {
        componentType: 'Layout.Header',
        category: 'layout',
        icon: 'Box',
        displayNameKey: 'componentName.layoutHeader',
      },
      {
        componentType: 'Button',
        category: 'general',
        icon: 'MousePointer2',
        displayNameKey: 'componentName.button',
      },
    ] as ComponentContract[];

    const groups = buildPagePaletteAssets(contracts, t);
    const layoutGroup = groups.find((group) => group.id === 'layout');
    const generalGroup = groups.find((group) => group.id === 'general');

    expect(layoutGroup?.assets).toHaveLength(1);
    expect(layoutGroup?.assets[0]?.id).toBe('Layout');
    expect(layoutGroup?.assets[0]?.children?.[0]?.id).toBe('Layout.Header');
    expect(generalGroup?.assets[0]?.id).toBe('Button');
  });
});
