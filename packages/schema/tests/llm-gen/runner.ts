import type { PageSchema } from '../../types';
import type { TestCase, TestCaseResult, TestReport, TestRunnerConfig, LLMRequest, LLMResponse } from './types';
import { validateSchema } from './validator';

/**
 * LLM 生成测试运行器
 */
export class TestRunner {
  private config: TestRunnerConfig;
  private mocks: Map<string, string | PageSchema> = new Map();
  private results: TestCaseResult[] = [];

  constructor(config: TestRunnerConfig) {
    this.config = {
      mode: 'mock',
      concurrency: 5,
      timeout: 30000,
      retries: 1,
      verbose: false,
      ...config,
    };
  }

  /**
   * 注册 Mock 响应
   */
  registerMock(testId: string, response: string | PageSchema): void {
    this.mocks.set(testId, response);
  }

  /**
   * 注册多个 Mock 响应
   */
  registerMocks(mocks: Record<string, string | PageSchema>): void {
    Object.entries(mocks).forEach(([id, response]) => {
      this.mocks.set(id, response);
    });
  }

  /**
   * 运行单个测试用例
   */
  async runTestCase(testCase: TestCase): Promise<TestCaseResult> {
    const startTime = Date.now();
    const result: TestCaseResult = {
      testCaseId: testCase.id,
      passed: false,
      generatedSchema: null,
      diagnostics: [],
      duration: 0,
    };

    try {
      // 尝试获取 Mock 响应
      let response: string | null = null;

      if (this.config.mode === 'mock' || this.config.mode === 'mixed') {
        response = await this.getMockResponse(testCase);
      }

      // 如果 Mock 失败且是 mixed 模式，尝试真实调用
      if (!response && (this.config.mode === 'live' || this.config.mode === 'mixed')) {
        response = await this.callLLM(testCase.prompt);
      }

      if (!response) {
        result.diagnostics.push({
          level: 'error',
          message: '无法获取响应（Mock 和 Live 均失败）',
          code: 'NO_RESPONSE',
        });
        result.duration = Date.now() - startTime;
        return result;
      }

      // 解析响应
      const schema = this.parseResponse(response);

      if (!schema) {
        result.diagnostics.push({
          level: 'error',
          message: '无法解析响应为有效的 Schema',
          code: 'PARSE_ERROR',
        });
        result.duration = Date.now() - startTime;
        return result;
      }

      result.generatedSchema = schema;

      // 验证 Schema
      const validationDiagnostics = validateSchema(schema);
      result.diagnostics.push(...validationDiagnostics);

      // 验证期望的组件
      if (testCase.expectedComponent) {
        const componentMatch = this.checkComponent(schema, testCase.expectedComponent);
        if (!componentMatch) {
          result.diagnostics.push({
            level: 'error',
            message: `期望组件 "${testCase.expectedComponent}"，但生成的组件不匹配`,
            code: 'COMPONENT_MISMATCH',
          });
        }
      }

      // 验证期望的 props
      if (testCase.expectedProps && testCase.expectedProps.length > 0) {
        const propsMatch = this.checkProps(schema, testCase.expectedProps);
        if (!propsMatch.passed) {
          result.diagnostics.push({
            level: 'warning',
            message: `Props 不匹配：缺少 [${propsMatch.missing.join(', ')}]`,
            code: 'PROPS_MISMATCH',
          });
        }
      }

      // 验证期望的 actions
      if (testCase.expectedActions && testCase.expectedActions.length > 0) {
        const actionsMatch = this.checkActions(schema, testCase.expectedActions);
        if (!actionsMatch.passed) {
          result.diagnostics.push({
            level: 'warning',
            message: `Actions 不匹配：缺少 [${actionsMatch.missing.join(', ')}]`,
            code: 'ACTIONS_MISMATCH',
          });
        }
      }

      // 判断是否通过
      const hasErrors = result.diagnostics.some((d) => d.level === 'error');
      result.passed = !hasErrors;

      // 添加详细匹配信息
      result.details = {
        componentMatch: this.checkComponent(schema, testCase.expectedComponent || ''),
        propsMatch: this.checkProps(schema, testCase.expectedProps || []),
        actionsMatch: this.checkActions(schema, testCase.expectedActions || []),
      };
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      result.diagnostics.push({
        level: 'error',
        message: result.error,
        code: 'RUNTIME_ERROR',
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * 批量运行测试
   */
  async runAll(testCases: TestCase[]): Promise<TestReport> {
    this.results = [];
    const startTime = Date.now();

    // 并发控制
    const concurrency = this.config.concurrency || 5;
    const batches = this.chunkArray(testCases, concurrency);

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map((tc) => this.runTestCase(tc))
      );
      this.results.push(...batchResults);
    }

    return this.generateReport(startTime);
  }

  /**
   * 获取 Mock 响应
   */
  private async getMockResponse(testCase: TestCase): Promise<string | null> {
    const mock = this.mocks.get(testCase.id);

    if (mock === undefined) {
      return null;
    }

    // 模拟网络延迟
    await this.sleep(10);

    if (typeof mock === 'string') {
      return mock;
    }

    return JSON.stringify(mock, null, 2);
  }

  /**
   * 调用 LLM API
   */
  private async callLLM(prompt: string): Promise<string | null> {
    const endpoint = this.config.apiEndpoint;
    const apiKey = this.config.apiKey;
    const model = this.config.model || 'claude-sonnet-4-20250514';

    if (!endpoint) {
      return null;
    }

    try {
      const request: LLMRequest = {
        model,
        messages: [
          {
            role: 'system',
            content: '你是一个低代码页面 Schema 生成器。请根据用户描述生成符合 PageSchema 类型的 JSON。只返回 JSON，不要任何解释。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 4096,
        response_format: {
          type: 'json_object',
        },
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`API 请求失败：${response.status} ${response.statusText}`);
      }

      const data: LLMResponse = await response.json();
      return data.choices[0]?.message.content || null;
    } catch (error) {
      console.error('LLM 调用失败:', error);
      return null;
    }
  }

  /**
   * 解析响应
   */
  private parseResponse(response: string): PageSchema | null {
    try {
      // 尝试直接解析
      const schema = JSON.parse(response);
      return schema as PageSchema;
    } catch {
      // 尝试提取 JSON 块
      const jsonMatch = response.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]) as PageSchema;
        } catch {
          return null;
        }
      }

      // 尝试提取花括号内容
      const braceMatch = response.match(/{[\s\S]*}/);
      if (braceMatch) {
        try {
          return JSON.parse(braceMatch[0]) as PageSchema;
        } catch {
          return null;
        }
      }

      return null;
    }
  }

  /**
   * 检查组件
   */
  private checkComponent(schema: PageSchema, expectedComponent: string): boolean {
    if (!expectedComponent) return true;

    const checkNode = (node: unknown): boolean => {
      if (!node || typeof node !== 'object') return false;
      const n = node as Record<string, unknown>;
      if (n.component === expectedComponent) return true;

      // 检查 slots
      if (n.slots && typeof n.slots === 'object') {
        for (const slotContent of Object.values(n.slots)) {
          if (Array.isArray(slotContent)) {
            if (slotContent.some(checkNode)) return true;
          } else if (checkNode(slotContent)) {
            return true;
          }
        }
      }

      // 检查 children
      if (Array.isArray(n.children)) {
        if (n.children.some(checkNode)) return true;
      }

      return false;
    };

    if (Array.isArray(schema.body)) {
      return schema.body.some(checkNode);
    }
    return checkNode(schema.body);
  }

  /**
   * 检查 Props
   */
  private checkProps(schema: PageSchema, expectedProps: string[]): {
    passed: boolean;
    expected: string[];
    actual: string[];
    missing: string[];
    extra: string[];
  } {
    const actualProps = new Set<string>();

    const collectProps = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>;
      if (n.props && typeof n.props === 'object') {
        Object.keys(n.props).forEach((key) => actualProps.add(key));
      }
      if (Array.isArray(n.children)) {
        n.children.forEach(collectProps);
      }
      if (n.slots && typeof n.slots === 'object') {
        Object.values(n.slots).forEach((content) => {
          if (Array.isArray(content)) {
            content.forEach(collectProps);
          } else {
            collectProps(content);
          }
        });
      }
    };

    if (Array.isArray(schema.body)) {
      schema.body.forEach(collectProps);
    } else {
      collectProps(schema.body);
    }

    const actual = [...actualProps];
    const missing = expectedProps.filter((p) => !actualProps.has(p));
    const extra = actual.filter((p) => !expectedProps.includes(p));

    return {
      passed: missing.length === 0,
      expected: expectedProps,
      actual,
      missing,
      extra,
    };
  }

  /**
   * 检查 Actions
   */
  private checkActions(schema: PageSchema, expectedActions: string[]): {
    passed: boolean;
    expected: string[];
    actual: string[];
    missing: string[];
    extra: string[];
  } {
    const actualActions = new Set<string>();

    const collectActions = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>;

      // 收集 events 中的 actions
      if (n.events && typeof n.events === 'object') {
        for (const eventValue of Object.values(n.events)) {
          if (Array.isArray(eventValue)) {
            eventValue.forEach((action) => {
              if (action && typeof action === 'object' && 'type' in action) {
                actualActions.add((action as Record<string, unknown>).type as string);
              }
            });
          }
        }
      }

      if (Array.isArray(n.children)) {
        n.children.forEach(collectActions);
      }
      if (n.slots && typeof n.slots === 'object') {
        Object.values(n.slots).forEach((content) => {
          if (Array.isArray(content)) {
            content.forEach(collectActions);
          } else {
            collectActions(content);
          }
        });
      }
    };

    if (Array.isArray(schema.body)) {
      schema.body.forEach(collectActions);
    } else {
      collectActions(schema.body);
    }

    const actual = [...actualActions];
    const missing = expectedActions.filter((a) => !actualActions.has(a));
    const extra = actual.filter((a) => !expectedActions.includes(a));

    return {
      passed: missing.length === 0,
      expected: expectedActions,
      actual,
      missing,
      extra,
    };
  }

  /**
   * 生成报告
   */
  private generateReport(startTime: number): TestReport {
    const total = this.results.length;
    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;
    const skipped = 0;

    const duration = Date.now() - startTime;
    const avgDuration = total > 0 ? duration / total : 0;

    // 按类别分组
    const byCategory = {
      component: this.categoryStats('component'),
      action: this.categoryStats('action'),
      expression: this.categoryStats('expression'),
      page: this.categoryStats('page'),
    };

    // 按难度级别分组
    const byLevel = {
      L1: this.levelStats('L1'),
      L2: this.levelStats('L2'),
      L3: this.levelStats('L3'),
    };

    // 收集所有诊断信息
    const diagnostics = this.results.flatMap((r) => r.diagnostics);

    return {
      timestamp: new Date().toISOString(),
      mode: this.config.mode,
      summary: {
        total,
        passed,
        failed,
        skipped,
        passRate: total > 0 ? (passed / total) * 100 : 0,
        avgDuration,
      },
      byCategory,
      byLevel,
      results: this.results,
      diagnostics,
    };
  }

  private categoryStats(category: string): { total: number; passed: number; passRate: number } {
    // Note: In a real implementation, test cases would need to store category info
    // For now, return placeholder stats
    return { total: 0, passed: 0, passRate: 0 };
  }

  private levelStats(level: string): { total: number; passed: number; passRate: number } {
    // Note: In a real implementation, test cases would need to store level info
    // For now, return placeholder stats
    return { total: 0, passed: 0, passRate: 0 };
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * 运行完整测试套件（便捷函数）
 */
export async function runFullTestSuite(
  testCases: TestCase[],
  options: Partial<TestRunnerConfig> = {}
): Promise<TestReport> {
  const runner = new TestRunner({
    mode: options.mode || 'mock',
    apiEndpoint: options.apiEndpoint,
    apiKey: options.apiKey,
    model: options.model,
    concurrency: options.concurrency,
    timeout: options.timeout,
    mocks: options.mocks,
  });

  return runner.runAll(testCases);
}
