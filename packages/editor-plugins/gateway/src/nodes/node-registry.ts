// ---------------------------------------------------------------------------
// Node Registry — maps node kinds to React components for React Flow
// ---------------------------------------------------------------------------

import type { NodeTypes } from '@xyflow/react';
import { StartNode } from './StartNode';
import { EndNode } from './EndNode';
import { DataDefNode } from './DataDefNode';
import { MetadataNode } from './MetadataNode';
import { SqlQueryNode } from './SqlQueryNode';
import { BranchNode } from './BranchNode';
import { LoopNode } from './LoopNode';

export const nodeTypes: NodeTypes = {
  start: StartNode,
  end: EndNode,
  'data-definition': DataDefNode,
  metadata: MetadataNode,
  'sql-query': SqlQueryNode,
  branch: BranchNode,
  'loop-start': LoopNode,
  'loop-end': LoopNode,
  'loop-break': LoopNode,
  'loop-continue': LoopNode,
};
