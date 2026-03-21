import React from 'react';
import {
  PalettePanel,
  type PaletteGroup,
} from '@shenbi/editor-ui';
import { DRAGGABLE_NODE_KINDS, NODE_CONTRACTS } from '../types';

export function GatewayNodePanel() {
  const groups: PaletteGroup[] = [
    {
      id: 'gateway-nodes',
      name: '工作流节点',
      items: DRAGGABLE_NODE_KINDS.map((kind) => {
        const contract = NODE_CONTRACTS[kind];
        return {
          id: kind,
          type: kind,
          name: contract.label,
          description: contract.description,
          icon: contract.icon,
          dragPayload: {
            kind: 'gateway-node',
            type: kind,
            label: contract.label,
            description: contract.description,
            icon: contract.icon,
            meta: {
              color: contract.color,
            },
          },
        };
      }),
    },
  ];

  return (
    <PalettePanel
      groups={groups}
      layout="list"
      showGroupHeaders={false}
    />
  );
}
