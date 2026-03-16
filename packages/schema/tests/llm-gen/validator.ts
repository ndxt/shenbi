import type { PageSchema, SchemaNode } from '../../types';
import { builtinContractMap } from '../../contracts';
import type { Diagnostic } from './types';

// Build supported component set from builtinContractMap
export const supportedComponentSet = new Set(Object.keys(builtinContractMap));

/**
 * Schema 校验器
 *
 * 校验层次：
 * 1. 结构校验 - Schema 基本结构合法性
 * 2. 契约校验 - 组件/Props/Events 是否符合契约
 * 3. 表达式校验 - 表达式语法和引用合法性
 * 4. Action 校验 - Action 类型和引用合法性
 */

const VALID_ACTION_TYPES = new Set([
  'setState',
  'callMethod',
  'fetch',
  'navigate',
  'message',
  'notification',
  'confirm',
  'modal',
  'drawer',
  'validate',
  'resetForm',
  'condition',
  'loop',
  'script',
  'copy',
  'debounce',
  'throttle',
  'emit',
  'download',
]);

export interface ValidatorOptions {
  /** 是否校验表达式引用的状态已声明 */
  validateExpressionReferences?: boolean;
  /** 是否校验 Action 引用的状态/方法已声明 */
  validateActionReferences?: boolean;
}

export interface ValidatorResult {
  valid: boolean;
  diagnostics: Diagnostic[];
}

/**
 * 主校验函数
 */
export function validateSchema(
  schema: PageSchema,
  options: ValidatorOptions = {},
): ValidatorResult {
  const diagnostics: Diagnostic[] = [];

  // 1. 基础结构校验
  validatePageSchemaStructure(schema, diagnostics);

  // 2. 校验组件和 Props 是否符合契约
  validateSchemaNodesAgainstContracts(schema, diagnostics);

  // 3. 表达式校验
  if (options.validateExpressionReferences !== false) {
    validateExpressions(schema, diagnostics);
  }

  // 4. Action 校验
  if (options.validateActionReferences !== false) {
    validateActions(schema, diagnostics);
  }

  return {
    valid: diagnostics.every((d) => d.level !== 'error'),
    diagnostics,
  };
}

/**
 * 校验 PageSchema 基础结构
 */
function validatePageSchemaStructure(schema: PageSchema, diagnostics: Diagnostic[]): void {
  // 校验 schema 基本字段
  if (!schema || typeof schema !== 'object') {
    diagnostics.push({
      level: 'error',
      code: 'SCHEMA_NOT_OBJECT',
      message: 'Schema must be an object',
    });
    return;
  }

  // 校验 blocks 数组
  if (schema.blocks && !Array.isArray(schema.blocks)) {
    diagnostics.push({
      level: 'error',
      code: 'BLOCKS_NOT_ARRAY',
      message: 'schema.blocks must be an array',
      path: '/blocks',
    });
  }

  // 校验 state 对象
  if (schema.state && typeof schema.state !== 'object') {
    diagnostics.push({
      level: 'error',
      code: 'STATE_NOT_OBJECT',
      message: 'schema.state must be an object',
      path: '/state',
    });
  }

  // 校验 methods 对象
  if (schema.methods && typeof schema.methods !== 'object') {
    diagnostics.push({
      level: 'error',
      code: 'METHODS_NOT_OBJECT',
      message: 'schema.methods must be an object',
      path: '/methods',
    });
  }

  // 递归校验 nodes
  const seenIds = new Set<string>();
  if (schema.blocks) {
    for (const block of schema.blocks) {
      validateSchemaNode(block, diagnostics, seenIds, '/blocks');
    }
  }

  // 校验 nodes 数组
  if (schema.nodes && Array.isArray(schema.nodes)) {
    for (const node of schema.nodes) {
      validateSchemaNode(node, diagnostics, seenIds, '/nodes');
    }
  }

  // 检查节点 ID 唯一性
  // (already checked in validateSchemaNode)
}

/**
 * 递归校验 SchemaNode
 */
function validateSchemaNode(
  node: unknown,
  diagnostics: Diagnostic[],
  seenIds: Set<string>,
  basePath: string,
): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  const nodeRecord = node as Record<string, unknown>;

  // 校验 component 字段
  const component = nodeRecord.component as string | undefined;
  if (!component || typeof component !== 'string') {
    diagnostics.push({
      level: 'error',
      code: 'NODE_MISSING_COMPONENT',
      message: 'SchemaNode must have a string component field',
      path: basePath,
    });
    return;
  }

  // 校验 component 是否在支持的组件列表中
  if (!supportedComponentSet.has(component)) {
    diagnostics.push({
      level: 'error',
      code: 'UNSUPPORTED_COMPONENT',
      message: `Component "${component}" is not in the supported components list`,
      path: basePath,
    });
  }

  // 校验 ID 唯一性
  const nodeId = nodeRecord.id as string | undefined;
  if (nodeId) {
    if (seenIds.has(nodeId)) {
      diagnostics.push({
        level: 'error',
        code: 'DUPLICATE_NODE_ID',
        message: `Duplicate node ID: "${nodeId}"`,
        path: basePath,
      });
    } else {
      seenIds.add(nodeId);
    }
  }

  // 校验 props
  const props = nodeRecord.props as Record<string, unknown> | undefined;
  if (props && typeof props === 'object') {
    validateNodeProps(props, component, diagnostics, `${basePath}/props`);
  }

  // 校验 children
  const children = nodeRecord.children;
  if (Array.isArray(children)) {
    for (const [index, child] of children.entries()) {
      if (child && typeof child === 'object') {
        validateSchemaNode(child, diagnostics, seenIds, `${basePath}/children[${index}]`);
      }
    }
  }
}

/**
 * 校验节点 Props 是否符合契约
 */
function validateNodeProps(
  props: Record<string, unknown>,
  componentType: string,
  diagnostics: Diagnostic[],
  basePath: string,
): void {
  const contract = builtinContractMap[componentType];
  if (!contract?.props) {
    return;
  }

  for (const [propName, propValue] of Object.entries(props)) {
    const contractProp = contract.props[propName];

    // 检查 prop 是否在契约中声明
    if (!contractProp) {
      diagnostics.push({
        level: 'warning',
        code: 'UNDECLARED_PROP',
        message: `Prop "${propName}" is not declared in component "${componentType}" contract`,
        path: `${basePath}/${propName}`,
      });
      continue;
    }

    // 校验 prop 值类型
    validatePropValue(propValue, contractProp, diagnostics, `${basePath}/${propName}`);
  }
}

/**
 * 校验 Prop 值是否符合契约类型定义
 */
function validatePropValue(
  value: unknown,
  contractProp: { type: string; enum?: unknown[]; shape?: Record<string, unknown>; items?: unknown },
  diagnostics: Diagnostic[],
  path: string,
): void {
  const { type, enum: enumValues, shape, items } = contractProp;

  // 校验 enum 类型
  if (type === 'enum' && enumValues && Array.isArray(enumValues)) {
    if (!enumValues.includes(value)) {
      diagnostics.push({
        level: 'error',
        code: 'INVALID_ENUM_VALUE',
        message: `Value "${String(value)}" is not in the allowed enum values: [${enumValues.join(', ')}]`,
        path,
      });
    }
    return;
  }

  // 校验基本类型
  if (type === 'string' && typeof value !== 'string') {
    diagnostics.push({
      level: 'error',
      code: 'TYPE_MISMATCH',
      message: `Expected string but got ${typeof value}`,
      path,
    });
  } else if (type === 'number' && typeof value !== 'number') {
    diagnostics.push({
      level: 'error',
      code: 'TYPE_MISMATCH',
      message: `Expected number but got ${typeof value}`,
      path,
    });
  } else if (type === 'boolean' && typeof value !== 'boolean') {
    diagnostics.push({
      level: 'error',
      code: 'TYPE_MISMATCH',
      message: `Expected boolean but got ${typeof value}`,
      path,
    });
  }

  // 校验 object 类型
  if (type === 'object' && shape && typeof value === 'object' && value !== null) {
    const valueRecord = value as Record<string, unknown>;
    for (const [key, val] of Object.entries(valueRecord)) {
      const shapeProp = shape[key];
      if (shapeProp && typeof shapeProp === 'object') {
        validatePropValue(val, shapeProp as typeof contractProp, diagnostics, `${path}/${key}`);
      }
    }
  }

  // 校验 array 类型
  if (type === 'array' && items && Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      validatePropValue(item, items as typeof contractProp, diagnostics, `${path}[${index}]`);
    }
  }
}

/**
 * 校验表达式
 */
function validateExpressions(schema: PageSchema, diagnostics: Diagnostic[]): void {
  const declaredStateKeys = schema.state ? Object.keys(schema.state) : [];
  const declaredParamsKeys = schema.params ? Object.keys(schema.params) : [];
  const declaredComputedKeys = schema.computed ? Object.keys(schema.computed) : [];
  const declaredDatasourceKeys = schema.datasources ? Object.keys(schema.datasources) : [];

  // 收集所有引用的 key
  const referencedKeys = collectExpressionReferences(schema);

  // 检查引用是否已声明
  for (const ref of referencedKeys) {
    const [scope, ...keyParts] = ref.split('.');
    const key = keyParts.join('.');

    switch (scope) {
      case 'state':
        if (!declaredStateKeys.includes(key)) {
          diagnostics.push({
            level: 'warning',
            code: 'UNDECLARED_STATE_REFERENCE',
            message: `Expression references state.${key} which is not declared`,
          });
        }
        break;
      case 'params':
        if (!declaredParamsKeys.includes(key)) {
          diagnostics.push({
            level: 'warning',
            code: 'UNDECLARED_PARAMS_REFERENCE',
            message: `Expression references params.${key} which is not declared`,
          });
        }
        break;
      case 'computed':
        if (!declaredComputedKeys.includes(key)) {
          diagnostics.push({
            level: 'warning',
            code: 'UNDECLARED_COMPUTED_REFERENCE',
            message: `Expression references computed.${key} which is not declared`,
          });
        }
        break;
      case 'ds':
        if (!declaredDatasourceKeys.includes(key)) {
          diagnostics.push({
            level: 'warning',
            code: 'UNDECLARED_DATASOURCE_REFERENCE',
            message: `Expression references ds.${key} which is not declared`,
          });
        }
        break;
    }
  }
}

/**
 * 收集所有表达式引用
 */
function collectExpressionReferences(schema: PageSchema): string[] {
  const references = new Set<string>();
  const expressionRegex = /\{\{\s*([^}]+)\s*\}\}/g;

  function traverse(node: unknown): void {
    if (typeof node === 'string') {
      const matches = node.matchAll(expressionRegex);
      for (const match of matches) {
        const expr = match[1].trim();
        // 提取引用，如 state.foo, params.bar
        const refMatch = expr.match(/^(state|params|computed|ds)\.([a-zA-Z0-9_]+)/);
        if (refMatch) {
          references.add(`${refMatch[1]}.${refMatch[2]}`);
        }
      }
    } else if (Array.isArray(node)) {
      for (const item of node) {
        traverse(item);
      }
    } else if (node && typeof node === 'object') {
      for (const value of Object.values(node as Record<string, unknown>)) {
        traverse(value);
      }
    }
  }

  traverse(schema);
  return [...references];
}

/**
 * 校验 Actions
 */
function validateActions(schema: PageSchema, diagnostics: Diagnostic[]): void {
  const declaredStateKeys = schema.state ? Object.keys(schema.state) : [];
  const declaredMethodKeys = schema.methods ? Object.keys(schema.methods) : [];

  // 收集所有 actions
  const allActions = collectAllActions(schema);

  for (const action of allActions) {
    // 校验 action type
    if (!VALID_ACTION_TYPES.has(action.type)) {
      diagnostics.push({
        level: 'error',
        code: 'INVALID_ACTION_TYPE',
        message: `Invalid action type: "${action.type}". Must be one of: ${[...VALID_ACTION_TYPES].join(', ')}`,
      });
    }

    // 校验 setState 的 key
    if (action.type === 'setState' && action.key) {
      if (!declaredStateKeys.includes(String(action.key))) {
        diagnostics.push({
          level: 'error',
          code: 'UNDECLARED_STATE_KEY',
          message: `setState action references state.${action.key} which is not declared`,
        });
      }
    }

    // 校验 callMethod 的 name
    if (action.type === 'callMethod' && action.name) {
      if (!declaredMethodKeys.includes(String(action.name))) {
        diagnostics.push({
          level: 'error',
          code: 'UNDECLARED_METHOD',
          message: `callMethod action references method.${action.name} which is not declared`,
        });
      }
    }
  }
}

/**
 * 收集所有 actions
 */
function collectAllActions(schema: PageSchema): Array<{ type: string; [key: string]: unknown }> {
  const actions: Array<{ type: string; [key: string]: unknown }> = [];

  function traverse(node: unknown): void {
    if (node && typeof node === 'object') {
      const record = node as Record<string, unknown>;

      // 检查是否有 actions 字段
      if (Array.isArray(record.actions)) {
        for (const action of record.actions) {
          if (action && typeof action === 'object') {
            const actionRecord = action as { type: string; [key: string]: unknown };
            if (actionRecord.type) {
              actions.push(actionRecord);
            }
          }
        }
      }

      // 检查是否有 onClick 等事件处理中的 actions
      if (typeof record.onClick === 'object' && record.onClick !== null) {
        traverse(record.onClick);
      }

      // 递归遍历 children
      if (Array.isArray(record.children)) {
        for (const child of record.children) {
          traverse(child);
        }
      }
    }
  }

  traverse(schema);
  return actions;
}

/**
 * 校验单个 SchemaNode
 */
export function validateNode(node: SchemaNode): ValidatorResult {
  const diagnostics: Diagnostic[] = [];
  const seenIds = new Set<string>();
  validateSchemaNode(node, diagnostics, seenIds, '/');

  return {
    valid: diagnostics.every((d) => d.level !== 'error'),
    diagnostics,
  };
}
