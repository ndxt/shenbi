import type { ReactElement } from 'react';
import type { CompiledNode } from '../types/contracts';

export interface NodeRendererProps {
  node: CompiledNode;
  extraContext?: Record<string, any>;
}

export function NodeRenderer(_props: NodeRendererProps): ReactElement | null {
  throw new Error('Not implemented: renderer/node-renderer.tsx');
}
