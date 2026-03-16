import type { PageSchema, SchemaNode } from '../../types';
import type { ComponentContract, ContractProp, Diagnostic } from '../../types/contract';
import { builtinContractMap } from '../../contracts';

/**
 * Schema 验证器
 */
export class SchemaValidator {
  private diagnostics: Diagnostic[] = [];

  /**
   * 验证生成的 PageSchema
   */
  validateSchema(schema: unknown): Diagnostic[] {
    this.diagnostics = [];

    if (!schema || typeof schema !== 'object') {
      this.addError('Schema 必须是一个对象', 'INVALID_SCHEMA');
      return this.diagnostics;
    }

    const pageSchema = schema as Partial<PageSchema>;

    // 验证 PageSchema 结构
    this.validatePageSchema(pageSchema);

    return this.diagnostics;
  }

  /**
   * 验证 PageSchema 结构
   */
  private validatePageSchema(schema: Partial<PageSchema>): void {
    // 检查 body 字段
    if (!schema.body) {
      this.addError('PageSchema 必须包含 body 字段', 'MISSING_BODY', 'body');
      return;
    }

    // 验证 body 内容
    if (Array.isArray(schema.body)) {
      schema.body.forEach((node, index) => {
        this.validateSchemaNode(node, `body[${index}]`);
      });
    } else {
      this.validateSchemaNode(schema.body, 'body');
    }

    // 验证 state 字段
    if (schema.state) {
      this.validateState(schema.state);
    }

    // 验证 dataSources 字段
    if (schema.dataSources) {
      this.validateDataSources(schema.dataSources);
    }

    // 验证 methods 字段
    if (schema.methods) {
      this.validateMethods(schema.methods);
    }

    // 验证 watchers 字段
    if (schema.watchers) {
      this.validateWatchers(schema.watchers);
    }
  }

  /**
   * 验证 SchemaNode
   */
  private validateSchemaNode(node: unknown, path: string): void {
    if (!node || typeof node !== 'object') {
      this.addError(`${path}: SchemaNode 必须是一个对象`, 'INVALID_SCHEMA_NODE', path);
      return;
    }

    const schemaNode = node as Partial<SchemaNode>;

    // 检查 component 字段
    if (!schemaNode.component) {
      this.addError(`${path}: SchemaNode 必须包含 component 字段`, 'MISSING_COMPONENT', `${path}.component`);
      return;
    }

    // 验证 component 是否存在于契约中
    const contract = builtinContractMap[schemaNode.component];
    if (!contract) {
      // 检查是否是复合组件（如 Input.TextArea）
      const compositeContract = builtinContractMap[schemaNode.component];
      if (!compositeContract) {
        this.addWarning(`${path}: 组件 "${schemaNode.component}" 未在契约中找到`, 'UNKNOWN_COMPONENT', `${path}.component`);
      }
    }

    // 验证 props
    if (schemaNode.props) {
      this.validateProps(schemaNode.props, schemaNode.component, `${path}.props`);
    }

    // 验证 events
    if (schemaNode.events) {
      this.validateEvents(schemaNode.events, `${path}.events`);
    }

    // 验证 slots
    if (schemaNode.slots) {
      Object.entries(schemaNode.slots).forEach(([slotName, slotContent]) => {
        if (Array.isArray(slotContent)) {
          slotContent.forEach((child, index) => {
            this.validateSchemaNode(child, `${path}.slots.${slotName}[${index}]`);
          });
        } else {
          this.validateSchemaNode(slotContent, `${path}.slots.${slotName}`);
        }
      });
    }

    // 验证 children
    if (schemaNode.children) {
      if (Array.isArray(schemaNode.children)) {
        schemaNode.children.forEach((child, index) => {
          if (typeof child === 'object') {
            this.validateSchemaNode(child, `${path}.children[${index}]`);
          }
        });
      }
    }

    // 验证 if 条件表达式
    if (schemaNode.if && typeof schemaNode.if === 'string') {
      this.validateExpression(schemaNode.if as string, `${path}.if`);
    }

    // 验证 loop 循环
    if (schemaNode.loop) {
      this.validateLoop(schemaNode.loop, `${path}.loop`);
    }
  }

  /**
   * 验证 props
   */
  private validateProps(props: Record<string, unknown>, componentName: string, path: string): void {
    const contract = builtinContractMap[componentName];

    Object.entries(props).forEach(([propName, propValue]) => {
      const propPath = `${path}.${propName}`;

      // 验证表达式
      if (typeof propValue === 'string' && propValue.startsWith('{{') && propValue.endsWith('}}')) {
        this.validateExpression(propValue, propPath);
      }

      // 如果契约存在，验证 prop 是否在契约中定义
      if (contract?.props) {
        const contractProp = contract.props[propName];
        if (!contractProp) {
          // 检查是否是通用属性
          const allowedCommonProps = ['style', 'className', 'id', 'key', 'ref', 'if', 'show', 'loop', 'slots'];
          if (!allowedCommonProps.includes(propName)) {
            this.addWarning(`${propPath}: 属性 "${propName}" 未在组件 "${componentName}" 的契约中定义`, 'UNKNOWN_PROP', propPath);
          }
        } else {
          // 验证 prop 类型
          this.validatePropType(propValue, contractProp, propPath);
        }
      }
    });
  }

  /**
   * 验证 prop 类型
   */
  private validatePropType(value: unknown, contractProp: ContractProp, path: string): void {
    if (!contractProp.type) return;

    // 跳过 any 类型
    if (contractProp.type === 'any') return;

    // 验证 enum 类型
    if (contractProp.type === 'enum' && contractProp.enum) {
      if (typeof value === 'string' && !value.startsWith('{{')) {
        if (!contractProp.enum.includes(value)) {
          this.addError(`${path}: 值 "${value}" 不在允许的枚举值中: ${contractProp.enum.join(', ')}`, 'INVALID_ENUM_VALUE', path);
        }
      }
      return;
    }

    // 验证基本类型
    const typeChecks: Record<string, (v: unknown) => boolean> = {
      string: (v) => typeof v === 'string',
      number: (v) => typeof v === 'number',
      boolean: (v) => typeof v === 'boolean',
      object: (v) => typeof v === 'object' && v !== null,
      array: (v) => Array.isArray(v),
      function: () => true, // 函数无法在 JSON 中表示
    };

    const checkFn = typeChecks[contractProp.type];
    if (checkFn && !checkFn(value)) {
      this.addWarning(`${path}: 期望类型 ${contractProp.type}，但得到 ${typeof value}`, 'TYPE_MISMATCH', path);
    }
  }

  /**
   * 验证 events
   */
  private validateEvents(events: Record<string, unknown>, path: string): void {
    Object.entries(events).forEach(([eventName, eventValue]) => {
      // 验证事件处理函数是 ActionChain
      if (Array.isArray(eventValue)) {
        this.validateActionChain(eventValue, `${path}.${eventName}`);
      } else {
        this.addError(`${path}.${eventName}: 事件处理函数必须是 ActionChain 数组`, 'INVALID_EVENT_HANDLER', `${path}.${eventName}`);
      }
    });
  }

  /**
   * 验证 ActionChain
   */
  private validateActionChain(actions: unknown[], path: string): void {
    const validActionTypes = new Set([
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
      'batch',
      'emit',
      'callProp',
      'setQuery',
      'download',
    ]);

    actions.forEach((action, index) => {
      const actionPath = `${path}[${index}]`;

      if (!action || typeof action !== 'object') {
        this.addError(`${actionPath}: Action 必须是一个对象`, 'INVALID_ACTION', actionPath);
        return;
      }

      const actionObj = action as Record<string, unknown>;

      // 检查 type 字段
      if (!actionObj.type) {
        this.addError(`${actionPath}: Action 必须包含 type 字段`, 'MISSING_ACTION_TYPE', `${actionPath}.type`);
        return;
      }

      const actionType = actionObj.type as string;

      // 验证 action 类型是否有效
      if (!validActionTypes.has(actionType)) {
        this.addError(`${actionPath}: 无效的 Action 类型 "${actionType}"`, 'INVALID_ACTION_TYPE', `${actionPath}.type`);
      }

      // 验证特定 action 的必需字段
      this.validateActionFields(actionObj, actionType, actionPath);
    });
  }

  /**
   * 验证 Action 字段
   */
  private validateActionFields(action: Record<string, unknown>, actionType: string, path: string): void {
    const requiredFields: Record<string, string[]> = {
      setState: ['key', 'value'],
      callMethod: ['name'],
      fetch: [],
      navigate: [],
      message: ['content'],
      notification: ['message'],
      confirm: ['title'],
      modal: ['id', 'open'],
      drawer: ['id', 'open'],
      validate: ['formRef'],
      resetForm: ['formRef'],
      condition: ['if'],
      loop: ['data', 'body'],
      script: ['code'],
      copy: ['text'],
      debounce: ['wait', 'body'],
      throttle: ['wait', 'body'],
      batch: ['actions'],
      emit: ['event'],
      callProp: ['name'],
      setQuery: ['query'],
      download: ['url'],
    };

    const fields = requiredFields[actionType] || [];
    fields.forEach((field) => {
      if (!(field in action)) {
        this.addError(`${path}: Action "${actionType}" 必须包含 "${field}" 字段`, 'MISSING_ACTION_FIELD', `${path}.${field}`);
      }
    });

    // 验证特定字段的表达式
    if (actionType === 'setState' && typeof action.value === 'string') {
      const value = action.value as string;
      if (value.startsWith('{{') && value.endsWith('}}')) {
        this.validateExpression(value, `${path}.value`);
      }
    }

    if (actionType === 'condition' && typeof action.if === 'string') {
      this.validateExpression(action.if as string, `${path}.if`);
    }
  }

  /**
   * 验证表达式
   */
  private validateExpression(expr: string, path: string): void {
    if (!expr.startsWith('{{') || !expr.endsWith('}}')) {
      this.addError(`${path}: 表达式必须以 {{ 开始，以 }} 结束`, 'INVALID_EXPRESSION_SYNTAX', path);
      return;
    }

    const content = expr.slice(2, -2).trim();

    if (!content) {
      this.addError(`${path}: 表达式不能为空`, 'EMPTY_EXPRESSION', path);
      return;
    }

    // 验证表达式内容
    // 检查是否是合法的 JS 表达式或路径引用
    const pathPattern = /^[a-zA-Z_$][\w$]*(\.[a-zA-Z_$][\w$]*)*$/;
    const expressionPattern = /^[a-zA-Z_$][\w$\s\.\(\)\[\]+'"*/\-!&|<>=?,]*$/;

    if (!pathPattern.test(content) && !expressionPattern.test(content)) {
      this.addWarning(`${path}: 表达式可能包含非法字符`, 'SUSPICIOUS_EXPRESSION', path);
    }

    // 检查引用的变量是否存在（简单检查）
    const refPattern = /(state|params|computed|ds|utils|refs|event|loop)\./g;
    const refs = content.match(refPattern);
    if (refs) {
      const validContexts = new Set(['state.', 'params.', 'computed.', 'ds.', 'utils.', 'refs.', 'event.', 'loop.']);
      refs.forEach((ref) => {
        if (!validContexts.has(ref)) {
          this.addWarning(`${path}: 未知的引用上下文 "${ref}"`, 'UNKNOWN_CONTEXT', path);
        }
      });
    }
  }

  /**
   * 验证 loop 指令
   */
  private validateLoop(loop: unknown, path: string): void {
    if (!loop || typeof loop !== 'object') {
      this.addError(`${path}: loop 必须是一个对象`, 'INVALID_LOOP', path);
      return;
    }

    const loopObj = loop as Record<string, unknown>;

    if (!loopObj.data) {
      this.addError(`${path}: loop 必须包含 data 字段`, 'MISSING_LOOP_DATA', `${path}.data`);
    }

    // 验证 data 是表达式或数组
    if (typeof loopObj.data === 'string' && loopObj.data.startsWith('{{')) {
      this.validateExpression(loopObj.data, `${path}.data`);
    }
  }

  /**
   * 验证 state
   */
  private validateState(state: Record<string, unknown>, path: string = 'state'): void {
    Object.entries(state).forEach(([key, value]) => {
      if (!value || typeof value !== 'object') {
        this.addWarning(`${path}.${key}: state 字段应该是一个对象`, 'INVALID_STATE_FIELD', `${path}.${key}`);
      }
    });
  }

  /**
   * 验证 dataSources
   */
  private validateDataSources(dataSources: Record<string, unknown>, path: string = 'dataSources'): void {
    Object.entries(dataSources).forEach(([key, value]) => {
      if (!value || typeof value !== 'object') {
        this.addError(`${path}.${key}: DataSource 必须是一个对象`, 'INVALID_DATASOURCE', `${path}.${key}`);
        return;
      }

      const ds = value as Record<string, unknown>;

      // 检查 type 字段
      if (!ds.type) {
        this.addError(`${path}.${key}: DataSource 必须包含 type 字段`, 'MISSING_DATASOURCE_TYPE', `${path}.${key}.type`);
      }
    });
  }

  /**
   * 验证 methods
   */
  private validateMethods(methods: Record<string, unknown>, path: string = 'methods'): void {
    Object.entries(methods).forEach(([key, value]) => {
      if (!value || typeof value !== 'object') {
        this.addError(`${path}.${key}: Method 必须是一个对象`, 'INVALID_METHOD', `${path}.${key}`);
        return;
      }

      const method = value as Record<string, unknown>;

      // 检查 body 字段
      if (!method.body) {
        this.addError(`${path}.${key}: Method 必须包含 body 字段`, 'MISSING_METHOD_BODY', `${path}.${key}.body`);
      } else if (Array.isArray(method.body)) {
        this.validateActionChain(method.body, `${path}.${key}.body`);
      }
    });
  }

  /**
   * 验证 watchers
   */
  private validateWatchers(watchers: unknown[], path: string = 'watchers'): void {
    if (!Array.isArray(watchers)) {
      this.addError(`${path}: watchers 必须是一个数组`, 'INVALID_WATCHERS', path);
      return;
    }

    watchers.forEach((watcher, index) => {
      if (!watcher || typeof watcher !== 'object') {
        this.addError(`${path}[${index}]: Watcher 必须是一个对象`, 'INVALID_WATCHER', `${path}[${index}]`);
        return;
      }

      const watcherObj = watcher as Record<string, unknown>;

      // 检查 watch 字段
      if (!watcherObj.watch) {
        this.addError(`${path}[${index}]: Watcher 必须包含 watch 字段`, 'MISSING_WATCH', `${path}[${index}].watch`);
      }

      // 检查 handler 字段
      if (!watcherObj.handler) {
        this.addError(`${path}[${index}]: Watcher 必须包含 handler 字段`, 'MISSING_WATCHER_HANDLER', `${path}[${index}].handler`);
      } else if (Array.isArray(watcherObj.handler)) {
        this.validateActionChain(watcherObj.handler, `${path}[${index}].handler`);
      }
    });
  }

  /**
   * 检查节点 ID 唯一性
   */
  checkNodeIds(schema: PageSchema): void {
    const ids = new Map<string, string>();

    const collectIds = (node: SchemaNode | SchemaNode[], path: string): void => {
      if (Array.isArray(node)) {
        node.forEach((n, i) => collectIds(n, `${path}[${i}]`));
        return;
      }

      if (node.id) {
        if (ids.has(node.id)) {
          this.addError(`${path}: 节点 ID "${node.id}" 重复（首次出现在 ${ids.get(node.id)}）`, 'DUPLICATE_NODE_ID', `${path}.id`);
        } else {
          ids.set(node.id, path);
        }
      }

      if (node.slots) {
        Object.entries(node.slots).forEach(([slotName, slotContent]) => {
          if (Array.isArray(slotContent)) {
            slotContent.forEach((child, index) => {
              if (typeof child === 'object') {
                collectIds(child, `${path}.slots.${slotName}[${index}]`);
              }
            });
          }
        });
      }

      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child, index) => {
          if (typeof child === 'object') {
            collectIds(child, `${path}.children[${index}]`);
          }
        });
      }
    };

    if (Array.isArray(schema.body)) {
      schema.body.forEach((node, i) => collectIds(node, `body[${i}]`));
    } else {
      collectIds(schema.body, 'body');
    }
  }

  private addError(message: string, code?: string, path?: string): void {
    this.diagnostics.push({
      level: 'error',
      message,
      code,
      path,
    });
  }

  private addWarning(message: string, code?: string, path?: string): void {
    this.diagnostics.push({
      level: 'warning',
      message,
      code,
      path,
    });
  }
}

/**
 * 验证 Schema（便捷函数）
 */
export function validateSchema(schema: unknown): Diagnostic[] {
  const validator = new SchemaValidator();
  return validator.validateSchema(schema);
}

/**
 * 检查 Schema 是否有效
 */
export function isValidSchema(schema: unknown): boolean {
  const diagnostics = validateSchema(schema);
  return !diagnostics.some((d) => d.level === 'error');
}
