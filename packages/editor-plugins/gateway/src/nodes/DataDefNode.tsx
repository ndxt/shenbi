import type { NodeProps } from '@xyflow/react';
import type { GatewayNodeData } from '../types';
import { BaseNode } from './BaseNode';

export function DataDefNode(props: NodeProps) {
  return <BaseNode {...props} data={props.data as GatewayNodeData} />;
}
