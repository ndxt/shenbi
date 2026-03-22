// ---------------------------------------------------------------------------
// BaseNode — shared node shell component for all gateway nodes
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
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

export interface BaseNodeProps extends NodeProps {
  data: GatewayNodeData;
  children?: React.ReactNode;
  onAddNode?: (sourceNodeId: string, sourceHandle: string) => void;
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

export function BaseNode({ id, data, selected, children, onAddNode }: BaseNodeProps) {
  const [mouseDownTime, setMouseDownTime] = useState<number>(0);
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
    // If click duration is less than 200ms, treat as click (not drag)
    if (clickDuration < 200 && onAddNode) {
      onAddNode(id!, portId);
    }
  };

  useEffect(() => {
    if (id) {
      updateNodeInternals(id);
    }
  }, [contract.inputs.length, contract.outputs.length, id, updateNodeInternals]);

  return (
    <div
      className={`gateway-node ${selected ? 'gateway-node--selected' : ''}`}
      style={{ '--node-color': contract.color } as React.CSSProperties}
    >
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
