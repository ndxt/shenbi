// ---------------------------------------------------------------------------
// BaseNode — shared node shell component for all gateway nodes
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import type { GatewayNodeData, GatewayNodeKind } from '../types';
import { NODE_CONTRACTS, PORT_TYPE_COLORS } from '../types';
import {
  Play,
  Square,
  Variable,
  FileJson,
  Database,
  GitBranch,
  Repeat,
  Plus,
  LogOut,
  SkipForward,
  MoreHorizontal,
  Copy,
  Trash2,
  ArrowLeftRight,
} from 'lucide-react';

const iconMap = {
  Play,
  Square,
  Variable,
  FileJson,
  Database,
  GitBranch,
  Repeat,
  Plus,
  LogOut,
  SkipForward,
} as const;

type IconName = keyof typeof iconMap;

export type NodeMenuAction = 'duplicate' | 'delete' | 'change';

export interface BaseNodeProps extends NodeProps {
  data: GatewayNodeData;
  children?: React.ReactNode;
  onAddNode?: (sourceNodeId: string, sourceHandle: string) => void;
  onNodeMenuAction?: (nodeId: string, action: NodeMenuAction) => void;
}

function getHandleStyle(
  index: number,
  count: number,
  color: string,
): React.CSSProperties {
  if (count === 1) {
    return {
      backgroundColor: color,
      top: '50%',
    };
  }

  return {
    backgroundColor: color,
    top: `${((index + 1) / (count + 1)) * 100}%`,
  };
}

interface NodeContextMenuProps {
  nodeId: string;
  kind: GatewayNodeKind;
  description: string;
  onAction: (nodeId: string, action: NodeMenuAction) => void;
  onClose: () => void;
}

function NodeContextMenu({ nodeId, kind, description, onAction, onClose }: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const isStartNode = kind === 'start';

  return (
    <div
      ref={menuRef}
      className="gateway-node__context-menu nodrag nopan"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="gateway-node__context-menu-item"
        onClick={() => { onAction(nodeId, 'change'); onClose(); }}
      >
        <ArrowLeftRight size={14} />
        <span>替换节点</span>
      </button>

      <button
        type="button"
        className="gateway-node__context-menu-item"
        onClick={() => { onAction(nodeId, 'duplicate'); onClose(); }}
      >
        <Copy size={14} />
        <span>复制</span>
        <kbd className="gateway-node__context-menu-shortcut">Ctrl D</kbd>
      </button>

      <div className="gateway-node__context-menu-separator" />

      <button
        type="button"
        className="gateway-node__context-menu-item gateway-node__context-menu-item--danger"
        disabled={isStartNode}
        onClick={() => { if (!isStartNode) { onAction(nodeId, 'delete'); onClose(); } }}
      >
        <Trash2 size={14} />
        <span>删除</span>
        <kbd className="gateway-node__context-menu-shortcut">Del</kbd>
      </button>

      <div className="gateway-node__context-menu-separator" />

      <div className="gateway-node__context-menu-about">
        <div className="gateway-node__context-menu-about-label">关于</div>
        <p className="gateway-node__context-menu-about-text">{description}</p>
      </div>
    </div>
  );
}

export function BaseNode({ id, data, selected, children, onAddNode, onNodeMenuAction }: BaseNodeProps) {
  const [mouseDownTime, setMouseDownTime] = useState<number>(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const contract = NODE_CONTRACTS[data.kind as GatewayNodeKind];
  const updateNodeInternals = useUpdateNodeInternals();

  if (!contract) {
    return <div className="gateway-node gateway-node--unknown">Unknown node</div>;
  }

  const handleMouseDown = () => {
    setMouseDownTime(Date.now());
  };

  const handleMouseUp = (portId: string) => {
    const clickDuration = Date.now() - mouseDownTime;
    if (clickDuration < 200 && onAddNode) {
      onAddNode(id!, portId);
    }
  };

  const handleMenuAction = useCallback((nodeId: string, action: NodeMenuAction) => {
    onNodeMenuAction?.(nodeId, action);
  }, [onNodeMenuAction]);

  useEffect(() => {
    if (id) {
      updateNodeInternals(id);
    }
  }, [contract.inputs.length, contract.outputs.length, id, updateNodeInternals]);

  return (
    <div
      className={`gateway-node ${selected ? 'gateway-node--selected' : ''}`}
      style={{ '--node-color': contract.color } as React.CSSProperties}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (id && onNodeMenuAction) {
          setMenuOpen(true);
        }
      }}
    >
      {/* Hover toolbar: ▶ ··· */}
      <div className="gateway-node__toolbar nodrag nopan">
        <button
          type="button"
          className="gateway-node__toolbar-btn"
          title="运行此步骤"
          onClick={(e) => { e.stopPropagation(); }}
        >
          <Play size={10} fill="currentColor" />
        </button>
        <button
          type="button"
          className="gateway-node__toolbar-btn"
          title="更多操作"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((prev) => !prev); }}
        >
          <MoreHorizontal size={12} />
        </button>
      </div>

      {menuOpen && id && onNodeMenuAction ? (
        <NodeContextMenu
          nodeId={id}
          kind={data.kind as GatewayNodeKind}
          description={contract.description}
          onAction={handleMenuAction}
          onClose={() => setMenuOpen(false)}
        />
      ) : null}

      {/* Input Handles */}
      {contract.inputs.map((port, index) => {
        const isSingleInput = contract.inputs.length === 1;
        return (
          <Handle
            key={port.id}
            type="target"
            position={Position.Left}
            id={port.id}
            className={`gateway-node__handle gateway-node__handle--input ${isSingleInput ? 'gateway-node__handle--single' : ''}`}
            style={getHandleStyle(index, contract.inputs.length, PORT_TYPE_COLORS[port.dataType])}
          />
        );
      })}

      {/* Node Content */}
      <div className="gateway-node__content">
        <div className="gateway-node__icon-wrapper" style={{ backgroundColor: contract.color }}>
          {(() => {
            const Icon = iconMap[contract.icon as IconName];
            return Icon ? <Icon size={14} className="gateway-node__icon" /> : null;
          })()}
        </div>
        <div className="gateway-node__text">
          <div className="gateway-node__label">{data.label.toUpperCase()}</div>
          {typeof data.config?.description === 'string' && data.config.description && (
            <div className="gateway-node__description">{data.config.description}</div>
          )}
        </div>
      </div>

      {/* Custom body content */}
      {children ? <div className="gateway-node__body">{children}</div> : null}

      {/* Output Handles double as quick-add affordances on click. */}
      {contract.outputs.map((port, index) => {
        const isSingleOutput = contract.outputs.length === 1;
        const showLabel = contract.outputs.length > 1;
        return (
          <Handle
            key={port.id}
            type="source"
            position={Position.Right}
            id={port.id}
            className={`gateway-node__handle gateway-node__handle--output ${isSingleOutput ? 'gateway-node__handle--single' : ''}`}
            style={getHandleStyle(index, contract.outputs.length, PORT_TYPE_COLORS[port.dataType])}
            onMouseDown={handleMouseDown}
            onMouseUp={() => handleMouseUp(port.id)}
          >
            {showLabel ? (
              <span className="gateway-node__handle-label">{port.label}</span>
            ) : null}
            {onAddNode ? (
              <span className="gateway-node__handle-plus" aria-hidden="true">
                <Plus size={10} strokeWidth={3} />
              </span>
            ) : null}
          </Handle>
        );
      })}
    </div>
  );
}
