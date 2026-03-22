// ---------------------------------------------------------------------------
// Gateway Node Type System & Port Definitions
// ---------------------------------------------------------------------------

import type { Node, Edge } from '@xyflow/react';

/** Data types for ports — determines connection compatibility */
export type PortDataType = 'any' | 'string' | 'number' | 'boolean' | 'object' | 'array' | 'void';

/** A single input or output port on a node */
export interface PortSchema {
  id: string;
  label: string;
  dataType: PortDataType;
  required?: boolean;
}

/** Gateway node kind enum */
export type GatewayNodeKind =
  | 'start'
  | 'end'
  | 'data-definition'
  | 'metadata'
  | 'sql-query'
  | 'branch'
  | 'loop-start'
  | 'loop-end'
  | 'loop-break'
  | 'loop-continue';

/** Contract describing a node's capabilities and ports */
export interface GatewayNodeContract {
  kind: GatewayNodeKind;
  label: string;
  description: string;
  icon: string;
  color: string;
  inputs: PortSchema[];
  outputs: PortSchema[];
  /** Max instances allowed in a gateway (e.g. 1 for start/end) */
  maxInstances?: number;
}

/** Runtime data stored on each React Flow node */
export interface GatewayNodeData extends Record<string, unknown> {
  kind: GatewayNodeKind;
  label: string;
  config: Record<string, unknown>;
}

/** Typed React Flow node */
export type GatewayNode = Node<GatewayNodeData>;

/** Typed React Flow edge */
export type GatewayEdge = Edge<{
  sourcePortType?: PortDataType;
}>;

/** Document schema for .api.json files */
export interface GatewayDocumentSchema {
  id: string;
  name: string;
  type: 'api-gateway';
  nodes: Array<{
    id: string;
    kind: GatewayNodeKind;
    label: string;
    position: { x: number; y: number };
    config: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    sourceHandle: string;
    target: string;
    targetHandle: string;
  }>;
  viewport?: { x: number; y: number; zoom: number };
}

// ---------------------------------------------------------------------------
// Built-in Node Contracts
// ---------------------------------------------------------------------------

export const NODE_CONTRACTS: Record<GatewayNodeKind, GatewayNodeContract> = {
  start: {
    kind: 'start',
    label: '开始',
    description: 'API 入口节点，接收请求参数',
    icon: 'Play',
    color: '#10b981',
    inputs: [],
    outputs: [
      { id: 'request', label: '请求参数', dataType: 'object' },
    ],
    maxInstances: 1,
  },
  end: {
    kind: 'end',
    label: '返回结果',
    description: 'API 出口节点，返回执行结果',
    icon: 'Square',
    color: '#ef4444',
    inputs: [
      { id: 'result', label: '返回值', dataType: 'any' },
    ],
    outputs: [],
    maxInstances: 1,
  },
  'data-definition': {
    kind: 'data-definition',
    label: '数据定义',
    description: '定义变量、常量或数据转换',
    icon: 'Variable',
    color: '#a855f7',
    inputs: [
      { id: 'input', label: '输入', dataType: 'any' },
    ],
    outputs: [
      { id: 'output', label: '输出', dataType: 'object' },
    ],
  },
  metadata: {
    kind: 'metadata',
    label: '元数据',
    description: '定义元数据信息',
    icon: 'FileJson',
    color: '#06b6d4',
    inputs: [],
    outputs: [
      { id: 'metadata', label: '元数据', dataType: 'object' },
    ],
  },
  'sql-query': {
    kind: 'sql-query',
    label: 'SQL 查询',
    description: '执行 SQL 查询语句',
    icon: 'Database',
    color: '#f59e0b',
    inputs: [
      { id: 'params', label: '查询参数', dataType: 'object' },
    ],
    outputs: [
      { id: 'rows', label: '结果集', dataType: 'array' },
    ],
  },
  branch: {
    kind: 'branch',
    label: '条件分支',
    description: '根据条件走不同路径',
    icon: 'GitBranch',
    color: '#ec4899',
    inputs: [
      { id: 'condition', label: '条件', dataType: 'any' },
    ],
    outputs: [
      { id: 'true', label: '是', dataType: 'any' },
      { id: 'false', label: '否', dataType: 'any' },
    ],
  },
  'loop-start': {
    kind: 'loop-start',
    label: '开始循环',
    description: '开始遍历数组或集合，并把当前项送入循环体',
    icon: 'Play',
    color: '#14b8a6',
    inputs: [
      { id: 'items', label: '数据集', dataType: 'array' },
    ],
    outputs: [
      { id: 'item', label: '当前项', dataType: 'any' },
    ],
  },
  'loop-end': {
    kind: 'loop-end',
    label: '结束循环',
    description: '结束当前循环体并输出汇总结果',
    icon: 'Square',
    color: '#0f766e',
    inputs: [
      { id: 'input', label: '输入', dataType: 'any' },
    ],
    outputs: [
      { id: 'output', label: '输出', dataType: 'any' },
    ],
  },
  'loop-break': {
    kind: 'loop-break',
    label: '跳出循环',
    description: '提前结束循环并跳到循环外继续执行',
    icon: 'LogOut',
    color: '#0f766e',
    inputs: [
      { id: 'input', label: '输入', dataType: 'any' },
    ],
    outputs: [
      { id: 'output', label: '输出', dataType: 'any' },
    ],
  },
  'loop-continue': {
    kind: 'loop-continue',
    label: '继续循环',
    description: '跳过当前剩余步骤，直接进入下一次循环',
    icon: 'SkipForward',
    color: '#0f766e',
    inputs: [
      { id: 'input', label: '输入', dataType: 'any' },
    ],
    outputs: [
      { id: 'output', label: '输出', dataType: 'any' },
    ],
  },
};

/** Node kinds that users can drag from the palette (start remains implicit) */
export const DRAGGABLE_NODE_KINDS: GatewayNodeKind[] = [
  'end',
  'data-definition',
  'metadata',
  'sql-query',
  'branch',
  'loop-start',
  'loop-end',
  'loop-break',
  'loop-continue',
];

/** Get the contract for a node kind */
export function getNodeContract(kind: GatewayNodeKind): GatewayNodeContract {
  return NODE_CONTRACTS[kind];
}

/** Port data type display colors */
export const PORT_TYPE_COLORS: Record<PortDataType, string> = {
  any: '#94a3b8',
  string: '#22c55e',
  number: '#3b82f6',
  boolean: '#f59e0b',
  object: '#8b5cf6',
  array: '#ec4899',
  void: '#6b7280',
};
