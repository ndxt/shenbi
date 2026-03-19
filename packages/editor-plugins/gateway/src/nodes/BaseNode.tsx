// ---------------------------------------------------------------------------
// BaseNode — shared node shell component for all gateway nodes
// ---------------------------------------------------------------------------

import React, { useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { GatewayNodeData, GatewayNodeKind } from '../types';
import { NODE_CONTRACTS, PORT_TYPE_COLORS } from '../types';
import { Play, Square, Variable, FileJson, Database, GitBranch, Repeat, Plus } from 'lucide-react';

const iconMap = {
  Play,
  Square,
  Variable,
  FileJson,
  Database,
  GitBranch,
  Repeat,
  Plus,
} as const;

type IconName = keyof typeof iconMap;

export interface BaseNodeProps extends NodeProps {
  data: GatewayNodeData;
  children?: React.ReactNode;
  onAddNode?: (sourceNodeId: string, sourceHandle: string) => void;
}

export function BaseNode({ id, data, selected, children, onAddNode }: BaseNodeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [mouseDownTime, setMouseDownTime] = useState<number>(0);
  const contract = NODE_CONTRACTS[data.kind as GatewayNodeKind];
  
  if (!contract) {
    return <div className="gateway-node gateway-node--unknown">Unknown node</div>;
  }

  const hasOutputs = contract.outputs.length > 0;

  const handleMouseDown = () => {
    setMouseDownTime(Date.now());
  };

  const handleMouseUp = (portId: string) => {
    const clickDuration = Date.now() - mouseDownTime;
    // If click duration is less than 200ms, treat as click (not drag)
    if (clickDuration < 200 && onAddNode) {
      onAddNode(id!, portId);
    }
  };

  return (
    <div
      className={`gateway-node ${selected ? 'gateway-node--selected' : ''}`}
      style={{ '--node-color': contract.color } as React.CSSProperties}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Input Handles */}
      {contract.inputs.map((port) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className="gateway-node__handle gateway-node__handle--input"
          style={{ 
            backgroundColor: PORT_TYPE_COLORS[port.dataType],
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
      ))}

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

      {/* Output Handles with Add Button */}
      {contract.outputs.map((port, index) => (
        <div key={port.id} className="gateway-node__handle-wrapper">
          <Handle
            type="source"
            position={Position.Right}
            id={port.id}
            className="gateway-node__handle gateway-node__handle--output"
            style={{ 
              backgroundColor: PORT_TYPE_COLORS[port.dataType],
              top: '50%',
              transform: 'translateY(-50%)',
            }}
            onMouseDown={handleMouseDown}
            onMouseUp={() => handleMouseUp(port.id)}
          >
            {isHovered && index === 0 && (
              <div className="gateway-node__handle-plus">
                <Plus size={12} strokeWidth={3} />
              </div>
            )}
          </Handle>
        </div>
      ))}
    </div>
  );
}
