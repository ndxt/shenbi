// ---------------------------------------------------------------------------
// NodeSelectorPanel — floating panel for quick node addition
// ---------------------------------------------------------------------------

import React, { useEffect, useRef } from 'react';
import {
  PalettePanel,
  filterPaletteAssetGroupsByInsertKind,
  type PaletteAssetGroup,
  type PaletteAssetInsertKind,
} from '@shenbi/editor-ui';
import type { GatewayNodeKind } from '../types';

export interface NodeSelectorPanelProps {
  position: { x: number; y: number };
  assetGroups: PaletteAssetGroup[];
  insertKind: PaletteAssetInsertKind;
  onSelectNode: (kind: GatewayNodeKind) => void;
  onClose: () => void;
}

export function NodeSelectorPanel({
  position,
  assetGroups,
  insertKind,
  onSelectNode,
  onClose,
}: NodeSelectorPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const filteredAssetGroups = React.useMemo(
    () => filterPaletteAssetGroupsByInsertKind(assetGroups, insertKind),
    [assetGroups, insertKind],
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [onClose]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="gateway-node-selector"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000,
        width: '360px',
        height: '440px',
      }}
    >
      <PalettePanel
        assetGroups={filteredAssetGroups}
        layout="grid"
        insertKind={insertKind}
        variant="overlay"
        dragEnabled={false}
        onInsert={(payload) => {
          onSelectNode(payload.type as GatewayNodeKind);
          onClose();
        }}
      />
    </div>
  );
}
