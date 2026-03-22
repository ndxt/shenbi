import React from 'react';
import type { ComponentContract } from '@shenbi/schema';
import { useTranslation } from '@shenbi/i18n';
import { PalettePanel } from './PalettePanel';
import { buildPagePaletteAssets } from './page-palette-assets';

export interface ComponentPanelProps {
  contracts?: ComponentContract[];
  onInsert?: (componentType: string) => void;
  onStartDrag?: (componentType: string) => void;
  onEndDrag?: () => void;
}

export function ComponentPanel({
  contracts = [],
  onInsert,
  onStartDrag,
  onEndDrag,
}: ComponentPanelProps) {
  const { t } = useTranslation('editorUi');
  const assetGroups = React.useMemo(
    () => buildPagePaletteAssets(contracts, t as unknown as (key: string, ...args: any[]) => string),
    [contracts, t],
  );

  return (
    <PalettePanel
      assetGroups={assetGroups}
      layout="grid"
      onInsert={(payload) => onInsert?.(payload.type)}
      onStartDrag={(payload) => onStartDrag?.(payload.type)}
      onEndDrag={onEndDrag}
    />
  );
}
