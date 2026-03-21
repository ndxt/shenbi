import type { NodeProps } from '@xyflow/react';
import type { GatewayNodeData } from '../types';
import { BaseNode } from './BaseNode';

export function MetadataNode(props: NodeProps) {
  return <BaseNode {...props} data={props.data as GatewayNodeData} />;
}
