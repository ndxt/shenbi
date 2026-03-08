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

export interface ContractParam {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
}

export interface ContractProp {
  type: ContractValueType;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
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
}

export type ComponentContract = ComponentContractV1;

export interface Diagnostic {
  level: 'error' | 'warning' | 'info';
  message: string;
  path?: string;
  code?: string;
}
