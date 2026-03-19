// ---------------------------------------------------------------------------
// BaseNode — shared node shell component for all gateway nodes
// ---------------------------------------------------------------------------

import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { GatewayNodeData, GatewayNodeKind } from '../types';
import { NODE_CONTRACTS, PORT_TYPE_COLORS } from '../types';
import * as Icons from 'lucide-react';

type LucideIconName = keyof typeof Icons;

function getIcon(name: string, size = 16) {
  const IconComp = Icons[name as LucideIconName] as React.ComponentType<{ size?: number; className?: string }> | undefined;
  if (!IconComp || typeof IconComp !== 'function') {
    return null;
  }
  return <IconComp size={size} className="gateway-node__icon" />;
}

export interface BaseNodeProps extends NodeProps {
  data: GatewayNodeData;
  children?: React.ReactNode;
}

export function BaseNode({ data, selected, children }: BaseNodeProps) {
  const contract = NODE_CONTRACTS[data.kind as GatewayNodeKind];
  if (!contract) {
    return <div className="gateway-node gateway-node--unknown">Unknown node</div>;
  }

  return (
    <div
      className={`gateway-node ${selected ? 'gateway-node--selected' : ''}`}
      style={{ '--node-color': contract.color } as React.CSSProperties}
    >
      {/* Header */}
      <div className="gateway-node__header">
        <div className="gateway-node__icon-wrapper" style={{ backgroundColor: contract.color }}>
          {getIcon(contract.icon)}
        </div>
        <span className="gateway-node__label">{data.label}</span>
      </div>

      {/* Input Handles */}
      {contract.inputs.map((port, index) => (
        <div
          key={port.id}
          className="gateway-node__port gateway-node__port--input"
          style={{ top: `${44 + index * 28}px` }}
        >
          <Handle
            type="target"
            position={Position.Left}
            id={port.id}
            className="gateway-node__handle"
            style={{
              backgroundColor: PORT_TYPE_COLORS[port.dataType],
              top: `${44 + index * 28 + 10}px`,
            }}
          />
          <span className="gateway-node__port-label gateway-node__port-label--left">
            {port.label}
            <span
              className="gateway-node__port-type"
              style={{ color: PORT_TYPE_COLORS[port.dataType] }}
            >
              {port.dataType}
            </span>
          </span>
        </div>
      ))}

      {/* Custom body content */}
      {children ? <div className="gateway-node__body">{children}</div> : null}

      {/* Output Handles */}
      {contract.outputs.map((port, index) => (
        <div
          key={port.id}
          className="gateway-node__port gateway-node__port--output"
          style={{ top: `${44 + index * 28}px` }}
        >
          <span className="gateway-node__port-label gateway-node__port-label--right">
            <span
              className="gateway-node__port-type"
              style={{ color: PORT_TYPE_COLORS[port.dataType] }}
            >
              {port.dataType}
            </span>
            {port.label}
          </span>
          <Handle
            type="source"
            position={Position.Right}
            id={port.id}
            className="gateway-node__handle"
            style={{
              backgroundColor: PORT_TYPE_COLORS[port.dataType],
              top: `${44 + index * 28 + 10}px`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
