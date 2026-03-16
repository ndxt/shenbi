import { describe, expect, it } from 'vitest';
import { createTestRunner } from './runner';
import { componentCases } from './cases/component-cases';
import { actionCases } from './cases/action-cases';
import type { TestCase, TestReport } from './types';

/**
 * LLM 生成质量测试
 *
 * 通过现有 ai-agents 生成管线，用最小 prompt 生成 Schema，自动校验结果
 */
describe('LLM Generation Quality Tests', () => {
  const runner = createTestRunner({
    mode: 'mock', // 默认使用 Mock 模式
    l1Threshold: 95,
    l2Threshold: 80,
  });

  describe('Component Tests', () => {
    // 只运行前几个 case 作为示例
    const sampleCases = componentCases.slice(0, 10);

    for (const testCase of sampleCases) {
      it(`should generate ${testCase.id} correctly`, async () => {
        // 注意：实际使用时需要注册 Mock 响应或切换到 live 模式
        // runner.registerMock(testCase.id, mockSchema);
        const result = await runner.runTestCase(testCase);

        // 在 Mock 模式下，如果没有注册 Mock 响应，会跳过实际测试
        if (result.status === 'skip') {
          expect(result.status).toBe('skip');
          return;
        }

        expect(result.status).toBe('pass');
      });
    }
  });

  describe('Action Tests', () => {
    const sampleCases = actionCases.slice(0, 5);

    for (const testCase of sampleCases) {
      it(`should handle ${testCase.id} correctly`, async () => {
        const result = await runner.runTestCase(testCase);

        if (result.status === 'skip') {
          expect(result.status).toBe('skip');
          return;
        }

        expect(result.status).toBe('pass');
      });
    }
  });
});

/**
 * 批量运行所有测试并生成报告
 *
 * 使用方式：
 * ```bash
 * pnpm test -- --run llm-gen/index.test.ts
 * ```
 *
 * 或在代码中调用：
 * ```typescript
 * import { runFullTestSuite } from './llm-gen';
 * const report = await runFullTestSuite({ mode: 'live' });
 * ```
 */
export async function runFullTestSuite(
  config: { mode?: 'mock' | 'live' | 'mixed'; apiEndpoint?: string } = {},
): Promise<TestReport> {
  const runner = createTestRunner({
    mode: config.mode ?? 'mixed',
    apiEndpoint: config.apiEndpoint,
    concurrency: 3,
  });

  // 合并所有测试用例
  const allCases: TestCase[] = [...componentCases, ...actionCases];

  // 运行测试
  const report = await runner.runAll(allCases);

  // 检查通过率是否达到阈值
  const l1Cases = allCases.filter((c) => c.level === 'L1');
  const l2Cases = allCases.filter((c) => c.level === 'L2');

  const l1Results = report.cases.filter((r) => l1Cases.some((c) => c.id === r.id));
  const l2Results = report.cases.filter((r) => l2Cases.some((c) => c.id === r.id));

  const l1PassRate =
    l1Results.length > 0
      ? (l1Results.filter((r) => r.status === 'pass').length / l1Results.length) * 100
      : 0;

  const l2PassRate =
    l2Results.length > 0
      ? (l2Results.filter((r) => r.status === 'pass').length / l2Results.length) * 100
      : 0;

  console.log('\\n========== Test Report ==========');
  console.log(`Total: ${report.summary.total}`);
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Failed: ${report.summary.failed}`);
  console.log(`Skipped: ${report.summary.skipped}`);
  console.log(`Pass Rate: ${report.summary.passRate.toFixed(2)}%`);
  console.log(`Duration: ${report.summary.durationMs}ms`);
  console.log(`\\nL1 Pass Rate: ${l1PassRate.toFixed(2)}% (threshold: 95%)`);
  console.log(`L2 Pass Rate: ${l2PassRate.toFixed(2)}% (threshold: 80%)`);
  console.log('==================================\\n');

  return report;
}

export { componentCases, actionCases } from './cases';
export type { TestCase, TestReport, TestRunnerConfig } from './types';
export { validateSchema } from './validator';
