import React from 'react';
import { PalettePanel } from '@shenbi/editor-ui';
import { buildGatewayPaletteAssets } from './gateway-palette-assets';

export function GatewayNodePanel() {
  const assetGroups = React.useMemo(() => buildGatewayPaletteAssets(), []);

  return (
    <PalettePanel
      assetGroups={assetGroups}
      layout="grid"
      showGroupHeaders
    />
  );
}
