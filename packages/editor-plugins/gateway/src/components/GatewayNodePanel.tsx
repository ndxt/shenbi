// ---------------------------------------------------------------------------
// GatewayNodePanel — draggable component palette for API gateway nodes
// ---------------------------------------------------------------------------

import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { DRAGGABLE_NODE_KINDS, NODE_CONTRACTS, type GatewayNodeKind } from '../types';

type LucideIconName = keyof typeof Icons;

function getIcon(name: string, size = 16, className?: string) {
  const IconComp = Icons[name as LucideIconName] as React.ComponentType<{ size?: number; className?: string }> | undefined;
  if (!IconComp || typeof IconComp !== 'function') {
    return null;
  }
  return <IconComp size={size} {...(className ? { className } : {})} />;
}

export function GatewayNodePanel() {
  const [search, setSearch] = useState('');

  const filteredKinds = DRAGGABLE_NODE_KINDS.filter((kind) => {
    if (!search.trim()) {
      return true;
    }
    const contract = NODE_CONTRACTS[kind];
    const term = search.toLowerCase();
    return (
      contract.label.toLowerCase().includes(term) ||
      contract.description.toLowerCase().includes(term)
    );
  });

  const handleDragStart = (event: React.DragEvent, kind: GatewayNodeKind) => {
    event.dataTransfer.setData('application/gateway-node-kind', kind);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="gateway-node-panel">

      <input
        className="gateway-node-panel__search"
        type="text"
        placeholder="搜索组件..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="gateway-node-panel__list">
        {filteredKinds.map((kind) => {
          const contract = NODE_CONTRACTS[kind];
          return (
            <div
              key={kind}
              className="gateway-node-panel__item"
              draggable
              onDragStart={(e) => handleDragStart(e, kind)}
            >
              <div
                className="gateway-node-panel__item-icon"
                style={{ backgroundColor: contract.color }}
              >
                {getIcon(contract.icon, 16, 'text-white')}
              </div>
              <div className="gateway-node-panel__item-info">
                <span className="gateway-node-panel__item-name">{contract.label}</span>
                <span className="gateway-node-panel__item-desc">{contract.description}</span>
              </div>
            </div>
          );
        })}
        {filteredKinds.length === 0 && (
          <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>
            未找到匹配的组件
          </div>
        )}
      </div>
    </div>
  );
}
