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
import { BaseNode } from './BaseNode';

// Specialized node components
const specializedNodes: NodeTypes = {
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

// All gateway node kinds — use BaseNode as default for any kind without a specialized component
const allGatewayKinds = [
  // Endpoints
  'start', 'end', 'data-definition', 'metadata', 'sql-query',
  // Flow Control
  'branch', 'loop-start', 'loop-end', 'loop-break', 'loop-continue',
  // Database
  'query', 'update', 'sql-run', 'sql-write', 'commit',
  // HTTP / Module
  'http', 'call-module',
  // Data Processing
  'define-data', 'map', 'filter', 'append', 'desensitize', 'assignment', 'check', 'stat',
  'inter-line', 'cross-table', 'sort', 'sort-as-tree', 'to-tree', 'join', 'union',
  'intersect', 'minus', 'compare', 'script', 'encrypt', 'decipher', 'signature',
  // ES / Redis
  'es-query', 'es-write', 'redis-read', 'redis-write',
  // File
  'excel-in', 'excel-out', 'zip', 'report', 'mark-shade', 'qr-code', 'file-load',
  'file-save', 'file-delete', 'file-auth', 'chart-image', 'to-pdf', 'ftp-upload',
  'ftp-download', 'file-check', 'file-merge', 'csv-read', 'csv-write', 'obj-read',
  'obj-write', 'sqlite-out', 'sqlite-in',
  // Workflow
  'create-flow', 'submit-flow', 'task-list', 'task-manager', 'flow-runtime',
  'flow-status', 'flow-dispatch',
  // System
  'unit-filter', 'user-filter', 'user-manager', 'unit-manager', 'user-role-m',
  'user-unit-m', 'user-role-q', 'user-unit-q', 'dictionary', 'notice', 'log-write',
  'log-query', 'serial-number', 'session-data', 'work-calendar',
] as const;

export const nodeTypes: NodeTypes = {
  ...specializedNodes,
  // Use BaseNode as fallback for all other gateway kinds
  ...Object.fromEntries(
    allGatewayKinds
      .filter((k) => !(k in specializedNodes))
      .map((k) => [k, BaseNode])
  ),
};
