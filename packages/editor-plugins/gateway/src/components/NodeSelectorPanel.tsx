// ---------------------------------------------------------------------------
// NodeSelectorPanel — floating panel for quick node addition
// ---------------------------------------------------------------------------

import React, { useState, useEffect, useRef } from 'react';
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

export interface NodeSelectorPanelProps {
  position: { x: number; y: number };
  onSelectNode: (kind: GatewayNodeKind) => void;
  onClose: () => void;
}

export function NodeSelectorPanel({ position, onSelectNode, onClose }: NodeSelectorPanelProps) {
  const [search, setSearch] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

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

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Use capture phase to ensure we catch the event before React Flow
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [onClose]);

  // Close on Escape
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
      className="node-selector-panel"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000,
      }}
    >
      <div className="node-selector-panel__header">
        <button className="node-selector-panel__tab node-selector-panel__tab--active">
          Nodes
        </button>
        <button className="node-selector-panel__tab">Tools</button>
        <button 
          className="node-selector-panel__close"
          onClick={onClose}
          title="关闭"
        >
          ×
        </button>
      </div>

      <input
        className="node-selector-panel__search"
        type="text"
        placeholder="Search node"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />

      <div className="node-selector-panel__list">
        {filteredKinds.map((kind) => {
          const contract = NODE_CONTRACTS[kind];
          return (
            <div
              key={kind}
              className="node-selector-panel__item"
              onClick={() => {
                onSelectNode(kind);
                onClose();
              }}
            >
              <div
                className="node-selector-panel__item-icon"
                style={{ backgroundColor: contract.color }}
              >
                {getIcon(contract.icon, 16, 'text-white')}
              </div>
              <div className="node-selector-panel__item-info">
                <span className="node-selector-panel__item-name">{contract.label}</span>
                <span className="node-selector-panel__item-desc">{contract.description}</span>
              </div>
            </div>
          );
        })}
        {filteredKinds.length === 0 && (
          <div className="node-selector-panel__empty">
            未找到匹配的节点
          </div>
        )}
      </div>
    </div>
  );
}
