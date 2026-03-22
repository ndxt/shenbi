import { describe, expect, it } from 'vitest';
import { filterPaletteAssetGroupsByInsertKind } from '@shenbi/editor-ui';
import { buildGatewayPaletteAssets } from './gateway-palette-assets';

function flattenAssetIds(assets: Array<{ id: string; children?: Array<{ id: string }> }>): string[] {
  return assets.flatMap((asset) => [
    asset.id,
    ...(asset.children ? flattenAssetIds(asset.children) : []),
  ]);
}

function flattenIds(insertKind: 'sidebar' | 'quick-insert' | 'edge-insert') {
  return filterPaletteAssetGroupsByInsertKind(buildGatewayPaletteAssets(), insertKind)
    .flatMap((group) => flattenAssetIds(group.assets));
}

describe('buildGatewayPaletteAssets', () => {
  it('includes start and end in the registry but only exposes return result in the sidebar', () => {
    const registryIds = buildGatewayPaletteAssets().flatMap((group) => flattenAssetIds(group.assets));
    expect(registryIds).toContain('start');
    expect(registryIds).toContain('end');

    const sidebarIds = flattenIds('sidebar');
    expect(sidebarIds).not.toContain('start');
    expect(sidebarIds).toContain('end');
  });

  it('exposes the loop parent and loop subnodes as shared assets', () => {
    const sidebarIds = flattenIds('sidebar');

    expect(sidebarIds).toContain('loop-group');
    expect(sidebarIds).toContain('loop-start');
    expect(sidebarIds).toContain('loop-end');
    expect(sidebarIds).toContain('loop-break');
    expect(sidebarIds).toContain('loop-continue');
  });

  it('only exposes bridgeable nodes in edge insertion mode', () => {
    const edgeInsertIds = flattenIds('edge-insert');

    expect(edgeInsertIds).toContain('data-definition');
    expect(edgeInsertIds).toContain('sql-query');
    expect(edgeInsertIds).toContain('branch');
    expect(edgeInsertIds).toContain('loop-group');
    expect(edgeInsertIds).toContain('loop-start');
    expect(edgeInsertIds).toContain('loop-end');
    expect(edgeInsertIds).toContain('loop-break');
    expect(edgeInsertIds).toContain('loop-continue');
    expect(edgeInsertIds).not.toContain('metadata');
    expect(edgeInsertIds).not.toContain('end');
  });
});
