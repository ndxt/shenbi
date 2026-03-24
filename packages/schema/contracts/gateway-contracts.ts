// ---------------------------------------------------------------------------
// Gateway Node Contracts — unified ComponentContract definitions
// ---------------------------------------------------------------------------

import {
  type ComponentContract,
  type PortDataType,
  COMPONENT_CONTRACT_V1_VERSION,
} from '../types/contract';

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

/** All gateway node component types */
export type GatewayComponentType =
  | 'Gateway.Start'
  | 'Gateway.End'
  | 'Gateway.DataDefinition'
  | 'Gateway.Metadata'
  | 'Gateway.SqlQuery'
  | 'Gateway.Branch'
  | 'Gateway.LoopStart'
  | 'Gateway.LoopEnd'
  | 'Gateway.LoopBreak'
  | 'Gateway.LoopContinue';

/**
 * Maps a GatewayNodeKind (used in React Flow runtime) to the unified
 * componentType string used in the contract registry.
 */
export const GATEWAY_KIND_TO_COMPONENT_TYPE: Record<string, GatewayComponentType> = {
  'start': 'Gateway.Start',
  'end': 'Gateway.End',
  'data-definition': 'Gateway.DataDefinition',
  'metadata': 'Gateway.Metadata',
  'sql-query': 'Gateway.SqlQuery',
  'branch': 'Gateway.Branch',
  'loop-start': 'Gateway.LoopStart',
  'loop-end': 'Gateway.LoopEnd',
  'loop-break': 'Gateway.LoopBreak',
  'loop-continue': 'Gateway.LoopContinue',
};

/** Reverse map: componentType → kind */
export const GATEWAY_COMPONENT_TYPE_TO_KIND: Record<GatewayComponentType, string> = {
  'Gateway.Start': 'start',
  'Gateway.End': 'end',
  'Gateway.DataDefinition': 'data-definition',
  'Gateway.Metadata': 'metadata',
  'Gateway.SqlQuery': 'sql-query',
  'Gateway.Branch': 'branch',
  'Gateway.LoopStart': 'loop-start',
  'Gateway.LoopEnd': 'loop-end',
  'Gateway.LoopBreak': 'loop-break',
  'Gateway.LoopContinue': 'loop-continue',
};

// ---------------------------------------------------------------------------
// Contract definitions
// ---------------------------------------------------------------------------

const startContract: ComponentContract = {
  componentType: 'Gateway.Start',
  displayNameKey: '开始',
  category: 'gateway-endpoints',
  icon: 'Play',
  color: '#10b981',
  description: 'API 入口节点，接收请求参数',
  version: COMPONENT_CONTRACT_V1_VERSION,
  maxInstances: 1,
  ports: {
    inputs: [],
    outputs: [
      { id: 'request', label: '请求参数', dataType: 'object' },
    ],
  },
};

const endContract: ComponentContract = {
  componentType: 'Gateway.End',
  displayNameKey: '返回结果',
  category: 'gateway-endpoints',
  icon: 'Square',
  color: '#ef4444',
  description: 'API 出口节点，返回执行结果',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [
      { id: 'result', label: '返回值', dataType: 'any' },
    ],
    outputs: [],
  },
};

const dataDefinitionContract: ComponentContract = {
  componentType: 'Gateway.DataDefinition',
  displayNameKey: '数据定义',
  category: 'gateway-data',
  icon: 'Variable',
  color: '#a855f7',
  description: '定义变量、常量或数据转换',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [
      { id: 'input', label: '输入', dataType: 'any' },
    ],
    outputs: [
      { id: 'output', label: '输出', dataType: 'object' },
    ],
  },
};

const metadataContract: ComponentContract = {
  componentType: 'Gateway.Metadata',
  displayNameKey: '元数据',
  category: 'gateway-data',
  icon: 'FileJson',
  color: '#06b6d4',
  description: '定义元数据信息',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [],
    outputs: [
      { id: 'metadata', label: '元数据', dataType: 'object' },
    ],
  },
};

const sqlQueryContract: ComponentContract = {
  componentType: 'Gateway.SqlQuery',
  displayNameKey: 'SQL 查询一下',
  category: 'gateway-data',
  icon: 'Database',
  color: '#f59e0b',
  description: '执行 SQL 查询语句',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [
      { id: 'params', label: '查询参数', dataType: 'object' },
    ],
    outputs: [
      { id: 'rows', label: '结果集', dataType: 'array' },
    ],
  },
};

const branchContract: ComponentContract = {
  componentType: 'Gateway.Branch',
  displayNameKey: '条件分支',
  category: 'gateway-flow',
  icon: 'GitBranch',
  color: '#ec4899',
  description: '根据条件走不同路径',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [
      { id: 'condition', label: '条件', dataType: 'any' },
    ],
    outputs: [
      { id: 'true', label: '是', dataType: 'any' },
      { id: 'false', label: '否', dataType: 'any' },
    ],
  },
};

const loopStartContract: ComponentContract = {
  componentType: 'Gateway.LoopStart',
  displayNameKey: '开始循环',
  category: 'gateway-flow',
  icon: 'Play',
  color: '#14b8a6',
  description: '开始遍历数组或集合，并把当前项送入循环体',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [
      { id: 'items', label: '数据集', dataType: 'array' },
    ],
    outputs: [
      { id: 'item', label: '当前项', dataType: 'any' },
    ],
  },
};

const loopEndContract: ComponentContract = {
  componentType: 'Gateway.LoopEnd',
  displayNameKey: '结束循环',
  category: 'gateway-flow',
  icon: 'Square',
  color: '#0f766e',
  description: '结束当前循环体并输出汇总结果',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [
      { id: 'input', label: '输入', dataType: 'any' },
    ],
    outputs: [
      { id: 'output', label: '输出', dataType: 'any' },
    ],
  },
};

const loopBreakContract: ComponentContract = {
  componentType: 'Gateway.LoopBreak',
  displayNameKey: '跳出循环',
  category: 'gateway-flow',
  icon: 'LogOut',
  color: '#0f766e',
  description: '提前结束循环并跳到循环外继续执行',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [
      { id: 'input', label: '输入', dataType: 'any' },
    ],
    outputs: [
      { id: 'output', label: '输出', dataType: 'any' },
    ],
  },
};

const loopContinueContract: ComponentContract = {
  componentType: 'Gateway.LoopContinue',
  displayNameKey: '继续循环',
  category: 'gateway-flow',
  icon: 'SkipForward',
  color: '#0f766e',
  description: '跳过当前剩余步骤，直接进入下一次循环',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [
      { id: 'input', label: '输入', dataType: 'any' },
    ],
    outputs: [
      { id: 'output', label: '输出', dataType: 'any' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** All built-in gateway node contracts */
export const gatewayContracts: ComponentContract[] = [
  startContract,
  endContract,
  dataDefinitionContract,
  metadataContract,
  sqlQueryContract,
  branchContract,
  loopStartContract,
  loopEndContract,
  loopBreakContract,
  loopContinueContract,
];

/** Quick lookup by componentType */
export const gatewayContractMap: Record<string, ComponentContract> = Object.fromEntries(
  gatewayContracts.map((c) => [c.componentType, c]),
);

/** Quick lookup by runtime kind (e.g. 'start', 'sql-query') */
export const gatewayContractByKind: Record<string, ComponentContract> = Object.fromEntries(
  Object.entries(GATEWAY_KIND_TO_COMPONENT_TYPE)
    .filter(([, componentType]) => componentType in gatewayContractMap)
    .map(([kind, componentType]) => [kind, gatewayContractMap[componentType]!]),
);

/** Get gateway contract by componentType */
export function getGatewayContract(componentType: string): ComponentContract | undefined {
  return gatewayContractMap[componentType];
}

/** Get gateway contract by runtime kind */
export function getGatewayContractByKind(kind: string): ComponentContract | undefined {
  return gatewayContractByKind[kind];
}
