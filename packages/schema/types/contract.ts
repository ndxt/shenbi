export const COMPONENT_CONTRACT_V1_VERSION = '1.0.0' as const;

export type ContractValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'object'
  | 'array'
  | 'function'
  | 'SchemaNode'
  | 'Expression'
  | 'any';

/** Data types for flow-node ports — determines connection compatibility */
export type PortDataType = 'any' | 'string' | 'number' | 'boolean' | 'object' | 'array' | 'void';

/** A single input or output port on a flow node */
export interface ContractPort {
  id: string;
  label: string;
  dataType: PortDataType;
  required?: boolean;
  description?: string;
}

/** Port definitions for flow-node contracts */
export interface ContractPorts {
  inputs?: ContractPort[];
  outputs?: ContractPort[];
}

export interface ContractParam {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
}

export interface ContractProp {
  type: ContractValueType;
  oneOf?: ContractProp[];
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
  shape?: Record<string, ContractProp>;
  items?: ContractProp;
  description?: string;
  allowExpression?: boolean;
  deprecated?: boolean;
  deprecatedMessage?: string;
}

export interface ContractEvent {
  description?: string;
  params?: ContractParam[];
}

export interface ContractSlot {
  description?: string;
  multiple?: boolean;
}

export interface ContractChildren {
  type: 'none' | 'text' | 'node' | 'nodes' | 'mixed';
  description?: string;
}

export interface ComponentContractV1 {
  componentType: string;
  displayNameKey?: string;
  runtimeType?: string;
  category?: string;
  icon?: string;
  usageScenario?: string;
  props?: Record<string, ContractProp>;
  events?: Record<string, ContractEvent>;
  slots?: Record<string, ContractSlot>;
  children?: ContractChildren;
  version: typeof COMPONENT_CONTRACT_V1_VERSION | string;
  deprecated?: boolean;
  deprecatedMessage?: string;

  /** Component accent color (e.g. for flow-node rendering) */
  color?: string;
  /** Human-readable description of the component */
  description?: string;
  /** Maximum number of instances allowed (e.g. 1 for start/end nodes) */
  maxInstances?: number;
  /** Input/output port definitions for flow-node components */
  ports?: ContractPorts;
}

export type ComponentContract = ComponentContractV1;

export interface Diagnostic {
  level: 'error' | 'warning' | 'info';
  message: string;
  path?: string;
  code?: string;
}
