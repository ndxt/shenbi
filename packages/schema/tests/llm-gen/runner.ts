import type { PageSchema } from '../../types';
import type {
  TestCase,
  TestCaseResult,
  TestReport,
  TestRunnerConfig,
  AssertionResult,
  Diagnostic,
} from './types';
import { validateSchema } from './validator';

/**
 * 默认配置
 */
const DEFAULT_CONFIG: TestRunnerConfig = {
  mode: 'mixed',
  apiEndpoint: 'http://localhost:3001',
  l1Threshold: 95,
  l2Threshold: 80,
  timeout: 60000,
  concurrency: 3,
};

/**
 * LLM 生成质量测试运行器
 */
export class TestRunner {
  private config: TestRunnerConfig;
  private mockResponses: Map<string, PageSchema> = new Map();

  constructor(config: Partial<TestRunnerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 注册 Mock 响应
   */
  registerMock(testId: string, schema: PageSchema): void {
    this.mockResponses.set(testId, schema);
  }

  /**
   * 加载 Mock 响应文件
   */
  async loadMockResponses(mockModule: Record<string, PageSchema>): Promise<void> {
    for (const [key, value] of Object.entries(mockModule)) {
      this.mockResponses.set(key, value);
    }
  }

  /**
   * 运行单个测试用例
   */
  async runTestCase(testCase: TestCase): Promise<TestCaseResult> {
    const startTime = Date.now();
    const assertionsPassed: AssertionResult[] = [];

    try {
      // 检查是否跳过
      if (this.config.skipIds?.includes(testCase.id)) {
        return {
          id: testCase.id,
          status: 'skip',
          prompt: testCase.prompt,
        };
      }

      // 检查是否只运行指定的 case
      if (this.config.onlyIds && !this.config.onlyIds.includes(testCase.id)) {
        return {
          id: testCase.id,
          status: 'skip',
          prompt: testCase.prompt,
        };
      }

      // 获取 Schema（Mock 或实时调用）
      const schema = await this.fetchSchema(testCase);

      if (!schema) {
        return {
          id: testCase.id,
          status: 'fail',
          prompt: testCase.prompt,
          failureReason: 'Failed to fetch schema from API',
          durationMs: Date.now() - startTime,
        };
      }

      // 校验 Schema
      const validatorResult = validateSchema(schema);

      // 运行断言
      const componentAssertions = this.assertComponents(schema, testCase.assertions.components);
      assertionsPassed.push(...componentAssertions);

      const propAssertions = this.assertProps(schema, testCase.assertions.props);
      assertionsPassed.push(...propAssertions);

      const actionAssertions = this.assertActions(schema, testCase.assertions.actions);
      assertionsPassed.push(...actionAssertions);

      const structureAssertions = this.assertStructure(schema, testCase.assertions.structure);
      assertionsPassed.push(...structureAssertions);

      const expressionAssertions = this.assertExpressions(schema, testCase.assertions.expressions);
      assertionsPassed.push(...expressionAssertions);

      const stateAssertions = this.assertState(schema, testCase.assertions.state);
      assertionsPassed.push(...stateAssertions);

      // 添加校验器诊断
      for (const diag of validatorResult.diagnostics) {
        if (diag.level === 'error') {
          assertionsPassed.push({
            name: `validator:${diag.code}`,
            passed: false,
            message: diag.message,
          });
        }
      }

      const allPassed = assertionsPassed.every((a) => a.passed);

      return {
        id: testCase.id,
        status: allPassed ? 'pass' : 'fail',
        prompt: testCase.prompt,
        schema,
        durationMs: Date.now() - startTime,
        diagnostics: validatorResult.diagnostics,
        assertionsPassed,
        failureReason: allPassed ? undefined : this.buildFailureMessage(assertionsPassed),
      };
    } catch (error) {
      return {
        id: testCase.id,
        status: 'fail',
        prompt: testCase.prompt,
        durationMs: Date.now() - startTime,
        failureReason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 运行所有测试用例
   */
  async runAll(testCases: TestCase[]): Promise<TestReport> {
    const startTime = Date.now();
    const results: TestCaseResult[] = [];

    // 并发执行
    const concurrency = this.config.concurrency ?? 3;
    const batches = this.chunkArray(testCases, concurrency);

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map((testCase) => this.runTestCase(testCase)),
      );
      results.push(...batchResults);
    }

    const passed = results.filter((r) => r.status === 'pass').length;
    const failed = results.filter((r) => r.status === 'fail').length;
    const skipped = results.filter((r) => r.status === 'skip').length;
    const total = results.length;

    return {
      summary: {
        total,
        passed,
        failed,
        skipped,
        passRate: total > 0 ? (passed / (total - skipped)) * 100 : 0,
        durationMs: Date.now() - startTime,
      },
      cases: results,
      metadata: {
        timestamp: new Date().toISOString(),
        mode: this.config.mode,
        apiEndpoint: this.config.apiEndpoint,
      },
    };
  }

  /**
   * 获取 Schema（Mock 或实时）
   */
  private async fetchSchema(testCase: TestCase): Promise<PageSchema | null> {
    // 检查是否有 Mock 响应
    const mockSchema = this.mockResponses.get(testCase.id);
    if (mockSchema) {
      return mockSchema;
    }

    // 检查是否配置为只使用 Mock
    if (this.config.mode === 'mock') {
      console.warn(`No mock response found for test case: ${testCase.id}`);
      return null;
    }

    // 实时调用 API
    try {
      const response = await fetch(`${this.config.apiEndpoint}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: testCase.prompt,
          context: {},
        }),
        signal: AbortSignal.timeout(this.config.timeout ?? 60000),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const result = await response.json();
      return result.schema as PageSchema;
    } catch (error) {
      console.error(`Failed to fetch schema for ${testCase.id}:`, error);
      return null;
    }
  }

  /**
   * 断言：组件包含
   */
  private assertComponents(
    schema: PageSchema,
    assertion: { mustInclude?: string[]; mustNotInclude?: string[] } = {},
  ): AssertionResult[] {
    const results: AssertionResult[] = [];

    // 收集所有组件
    const foundComponents = new Set<string>();
    this.collectComponents(schema, foundComponents);

    // 检查 mustInclude
    if (assertion.mustInclude) {
      for (const component of assertion.mustInclude) {
        results.push({
          name: `components.mustInclude.${component}`,
          passed: foundComponents.has(component),
          message: foundComponents.has(component)
            ? undefined
            : `Component "${component}" not found in generated schema`,
        });
      }
    }

    // 检查 mustNotInclude
    if (assertion.mustNotInclude) {
      for (const component of assertion.mustNotInclude) {
        const found = foundComponents.has(component);
        results.push({
          name: `components.mustNotInclude.${component}`,
          passed: !found,
          message: found
            ? `Component "${component}" should not be in generated schema`
            : undefined,
        });
      }
    }

    return results;
  }

  /**
   * 断言：Props 值
   */
  private assertProps(
    schema: PageSchema,
    assertions: Record<string, Record<string, unknown>> = {},
  ): AssertionResult[] {
    const results: AssertionResult[] = [];

    for (const [componentName, propAssertions] of Object.entries(assertions)) {
      const component = this.findComponent(schema, componentName);
      if (!component) {
        results.push({
          name: `props.${componentName}`,
          passed: false,
          message: `Component "${componentName}" not found`,
        });
        continue;
      }

      const props = component.props ?? {};
      for (const [propName, expectedValue] of Object.entries(propAssertions)) {
        const actualValue = props[propName];
        const passed = this.deepEquals(actualValue, expectedValue);
        results.push({
          name: `props.${componentName}.${propName}`,
          passed,
          message: passed
            ? undefined
            : `Prop "${propName}" mismatch. Expected: ${JSON.stringify(expectedValue)}, Got: ${JSON.stringify(actualValue)}`,
        });
      }
    }

    return results;
  }

  /**
   * 断言：Actions
   */
  private assertActions(
    schema: PageSchema,
    assertion: { mustInclude?: Array<{ type: string; [key: string]: unknown }>; mustNotInclude?: string[] } = {},
  ): AssertionResult[] {
    const results: AssertionResult[] = [];

    // 收集所有 actions
    const allActions = this.collectActions(schema);

    // 检查 mustInclude
    if (assertion.mustInclude) {
      for (const expectedAction of assertion.mustInclude) {
        const found = allActions.some((action) => {
          if (action.type !== expectedAction.type) {
            return false;
          }
          // 检查其他属性是否匹配
          for (const [key, value] of Object.entries(expectedAction)) {
            if (key === 'type') {
              continue;
            }
            if (!this.deepEquals(action[key], value)) {
              return false;
            }
          }
          return true;
        });

        results.push({
          name: `actions.mustInclude.${expectedAction.type}`,
          passed: found,
          message: found
            ? undefined
            : `Action ${JSON.stringify(expectedAction)} not found in generated schema`,
        });
      }
    }

    // 检查 mustNotInclude
    if (assertion.mustNotInclude) {
      for (const actionType of assertion.mustNotInclude) {
        const found = allActions.some((action) => action.type === actionType);
        results.push({
          name: `actions.mustNotInclude.${actionType}`,
          passed: !found,
          message: found
            ? `Action type "${actionType}" should not be in generated schema`
            : undefined,
        });
      }
    }

    return results;
  }

  /**
   * 断言：结构
   */
  private assertStructure(
    schema: PageSchema,
    assertion: { maxNodeCount?: number; minNodeCount?: number } = {},
  ): AssertionResult[] {
    const results: AssertionResult[] = [];

    const nodeCount = this.countNodes(schema);

    if (assertion.maxNodeCount !== undefined) {
      results.push({
        name: `structure.maxNodeCount`,
        passed: nodeCount <= assertion.maxNodeCount,
        message:
          nodeCount <= assertion.maxNodeCount
            ? undefined
            : `Node count ${nodeCount} exceeds max ${assertion.maxNodeCount}`,
      });
    }

    if (assertion.minNodeCount !== undefined) {
      results.push({
        name: `structure.minNodeCount`,
        passed: nodeCount >= assertion.minNodeCount,
        message:
          nodeCount >= assertion.minNodeCount
            ? undefined
            : `Node count ${nodeCount} is less than min ${assertion.minNodeCount}`,
      });
    }

    return results;
  }

  /**
   * 断言：表达式引用
   */
  private assertExpressions(
    schema: PageSchema,
    assertion: { mustReference?: string[]; mustNotReference?: string[] } = {},
  ): AssertionResult[] {
    const results: AssertionResult[] = [];

    // 收集所有引用
    const referencedKeys = this.collectExpressionReferences(schema);

    // 检查 mustReference
    if (assertion.mustReference) {
      for (const ref of assertion.mustReference) {
        const found = referencedKeys.has(ref);
        results.push({
          name: `expressions.mustReference.${ref}`,
          passed: found,
          message: found
            ? undefined
            : `Expression reference "${ref}" not found in generated schema`,
        });
      }
    }

    // 检查 mustNotReference
    if (assertion.mustNotReference) {
      for (const ref of assertion.mustNotReference) {
        const found = referencedKeys.has(ref);
        results.push({
          name: `expressions.mustNotReference.${ref}`,
          passed: !found,
          message: found
            ? `Expression reference "${ref}" should not be in generated schema`
            : undefined,
        });
      }
    }

    return results;
  }

  /**
   * 断言：State 声明
   */
  private assertState(
    schema: PageSchema,
    assertion: { mustDeclare?: string[] } = {},
  ): AssertionResult[] {
    const results: AssertionResult[] = [];

    const declaredStateKeys = schema.state ? Object.keys(schema.state) : [];

    if (assertion.mustDeclare) {
      for (const key of assertion.mustDeclare) {
        const found = declaredStateKeys.includes(key);
        results.push({
          name: `state.mustDeclare.${key}`,
          passed: found,
          message: found
            ? undefined
            : `State key "${key}" not declared in schema`,
        });
      }
    }

    return results;
  }

  /**
   * 构建失败消息
   */
  private buildFailureMessage(assertions: AssertionResult[]): string {
    const failed = assertions.filter((a) => !a.passed);
    return failed.map((a) => `${a.name}: ${a.message}`).join('; ');
  }

  /**
   * 辅助函数：收集组件
   */
  private collectComponents(schema: PageSchema, found: Set<string>): void {
    function traverse(node: unknown): void {
      if (!node || typeof node !== 'object') {
        return;
      }
      const record = node as Record<string, unknown>;
      if (typeof record.component === 'string') {
        found.add(record.component);
      }
      if (Array.isArray(record.children)) {
        for (const child of record.children) {
          traverse(child);
        }
      }
    }

    traverse(schema);

    // 也检查 blocks
    if (Array.isArray(schema.blocks)) {
      for (const block of schema.blocks) {
        traverse(block);
      }
    }

    // 也检查 nodes
    if (Array.isArray(schema.nodes)) {
      for (const node of schema.nodes) {
        traverse(node);
      }
    }
  }

  /**
   * 辅助函数：查找组件
   */
  private findComponent(
    schema: PageSchema,
    componentName: string,
  ): { component: string; props?: Record<string, unknown> } | null {
    let found: { component: string; props?: Record<string, unknown> } | null = null;

    function traverse(node: unknown): void {
      if (found || !node || typeof node !== 'object') {
        return;
      }
      const record = node as Record<string, unknown>;
      if (record.component === componentName) {
        found = {
          component: componentName,
          props: record.props as Record<string, unknown> | undefined,
        };
        return;
      }
      if (Array.isArray(record.children)) {
        for (const child of record.children) {
          traverse(child);
        }
      }
    }

    traverse(schema);

    if (!found && Array.isArray(schema.blocks)) {
      for (const block of schema.blocks) {
        traverse(block);
        if (found) {
          break;
        }
      }
    }

    return found;
  }

  /**
   * 辅助函数：收集 Actions
   */
  private collectActions(
    schema: PageSchema,
  ): Array<{ type: string; [key: string]: unknown }> {
    const actions: Array<{ type: string; [key: string]: unknown }> = [];

    function traverse(node: unknown): void {
      if (!node || typeof node !== 'object') {
        return;
      }
      const record = node as Record<string, unknown>;

      if (Array.isArray(record.actions)) {
        for (const action of record.actions) {
          if (action && typeof action === 'object' && typeof (action as { type: string }).type === 'string') {
            actions.push(action as { type: string; [key: string]: unknown });
          }
        }
      }

      if (Array.isArray(record.children)) {
        for (const child of record.children) {
          traverse(child);
        }
      }
    }

    traverse(schema);
    return actions;
  }

  /**
   * 辅助函数：计算节点数
   */
  private countNodes(schema: PageSchema): number {
    let count = 0;

    function traverse(node: unknown): void {
      if (!node || typeof node !== 'object') {
        return;
      }
      const record = node as Record<string, unknown>;
      if (typeof record.component === 'string') {
        count++;
      }
      if (Array.isArray(record.children)) {
        for (const child of record.children) {
          traverse(child);
        }
      }
    }

    traverse(schema);

    if (Array.isArray(schema.blocks)) {
      for (const block of schema.blocks) {
        traverse(block);
      }
    }

    if (Array.isArray(schema.nodes)) {
      for (const node of schema.nodes) {
        traverse(node);
      }
    }

    return count;
  }

  /**
   * 辅助函数：收集表达式引用
   */
  private collectExpressionReferences(schema: PageSchema): Set<string> {
    const references = new Set<string>();
    const expressionRegex = /\{\{\s*([^}]+)\s*\}\}/g;

    function traverse(node: unknown): void {
      if (typeof node === 'string') {
        const matches = node.matchAll(expressionRegex);
        for (const match of matches) {
          const expr = match[1].trim();
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
        for (const value of Object.values(node)) {
          traverse(value);
        }
      }
    }

    traverse(schema);
    return references;
  }

  /**
   * 辅助函数：深度比较
   */
  private deepEquals(a: unknown, b: unknown): boolean {
    if (a === b) {
      return true;
    }
    if (typeof a !== typeof b) {
      return false;
    }
    if (a === null || b === null) {
      return a === b;
    }
    if (typeof a !== 'object') {
      return a === b;
    }
    if (Array.isArray(a) !== Array.isArray(b)) {
      return false;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) {
        return false;
      }
      return a.every((item, index) => this.deepEquals(item, b[index]));
    }
    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);
    if (keysA.length !== keysB.length) {
      return false;
    }
    for (const key of keysA) {
      if (!(keysB as string[]).includes(key)) {
        return false;
      }
      if (!this.deepEquals(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      )) {
        return false;
      }
    }
    return true;
  }

  /**
   * 辅助函数：数组分块
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

/**
 * 创建测试运行器实例
 */
export function createTestRunner(config?: Partial<TestRunnerConfig>): TestRunner {
  return new TestRunner(config);
}
