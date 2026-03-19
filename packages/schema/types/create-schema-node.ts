import type { ComponentContract } from './contract';
import type { ContractProp } from './contract';
import type { PropValue } from './expression';
import type { SchemaNode } from './node';

export interface CreateSchemaNodeOptions {
  id?: string;
}

function deepCloneValue<T>(value: T): T {
  if (value === undefined) {
    return value;
  }
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function createNodeId(componentType: string): string {
  const normalized = componentType
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'node';
  const randomSuffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${normalized}-${randomSuffix}`;
}

function resolveDefaultPropValue(prop: ContractProp | undefined): unknown {
  if (!prop || !Object.prototype.hasOwnProperty.call(prop, 'default')) {
    return undefined;
  }
  return deepCloneValue(prop.default);
}

export function createSchemaNodeFromContract(
  contract: ComponentContract,
  options: CreateSchemaNodeOptions = {},
): SchemaNode {
  const props = Object.entries(contract.props ?? {}).reduce<Record<string, PropValue>>((acc, [key, value]) => {
    const defaultValue = resolveDefaultPropValue(value);
    if (defaultValue !== undefined) {
      acc[key] = defaultValue as PropValue;
    }
    return acc;
  }, {});

  const node: SchemaNode = {
    id: options.id ?? createNodeId(contract.componentType),
    component: contract.componentType,
  };

  if (Object.keys(props).length > 0) {
    node.props = props;
  }

  if (
    contract.children
    && ['node', 'nodes', 'mixed'].includes(contract.children.type)
  ) {
    node.children = [];
  }

  return node;
}
