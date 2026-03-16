import { describe, it, expect, beforeEach } from 'vitest';
import { TestRunner, runFullTestSuite } from './runner';
import type { TestCase, TestReport, PageSchema } from './types';
import { componentCases, componentCasesL1, componentCasesL2 } from './cases/component-cases';
import { actionCases, actionCasesL1, actionCasesL2 } from './cases/action-cases';

/**
 * 模拟响应生成器
 */
function generateMockResponse(testCase: TestCase): PageSchema {
  const baseSchema: PageSchema = {
    body: [],
  };

  // 根据测试用例类型生成不同的 mock 响应
  if (testCase.category === 'component' && testCase.expectedComponent) {
    const componentType = testCase.expectedComponent;
    const props: Record<string, unknown> = {};

    // 根据 prompt 提取可能的 props
    if (testCase.prompt.includes('primary')) props.type = 'primary';
    if (testCase.prompt.includes('danger')) props.danger = true;
    if (testCase.prompt.includes('加载')) props.loading = true;
    if (testCase.prompt.includes('禁用')) props.disabled = true;
    if (testCase.prompt.includes('块级')) props.block = true;
    if (testCase.prompt.includes('圆形')) props.shape = 'circle';
    if (testCase.prompt.includes('密码')) props.type = 'password';
    if (testCase.prompt.includes('清除')) props.allowClear = true;
    if (testCase.prompt.includes('占位符') || testCase.prompt.includes('placeholder')) props.placeholder = '请输入';
    if (testCase.prompt.includes('搜索')) props.showSearch = true;
    if (testCase.prompt.includes('多选')) props.mode = 'multiple';
    if (testCase.prompt.includes('垂直')) props.layout = 'vertical';
    if (testCase.prompt.includes('水平')) props.layout = 'horizontal';
    if (testCase.prompt.includes('边框')) props.bordered = true;
    if (testCase.prompt.includes('分页')) props.pagination = true;
    if (testCase.prompt.includes('居中')) props.centered = true;
    if (testCase.prompt.includes('成功')) props.type = 'success';
    if (testCase.prompt.includes('错误') || testCase.prompt.includes('失败')) props.type = 'error';
    if (testCase.prompt.includes('警告')) props.type = 'warning';
    if (testCase.prompt.includes('标题')) props.title = '标题';
    if (testCase.prompt.includes('描述')) props.description = '描述内容';

    baseSchema.body = [
      {
        component: componentType,
        props: Object.keys(props).length > 0 ? props : undefined,
      },
    ];
  } else if (testCase.category === 'action') {
    // 生成带 events 的 mock 响应
    const events: Record<string, unknown> = {};

    if (testCase.expectedActions?.includes('setState')) {
      events.onClick = [
        { type: 'setState', key: 'name', value: 'test' },
      ];
    }
    if (testCase.expectedActions?.includes('fetch')) {
      events.onClick = [
        ...(events.onClick as any[] || []),
        { type: 'fetch', url: '/api/data', method: 'GET' },
      ];
    }
    if (testCase.expectedActions?.includes('message')) {
      events.onClick = [
        ...(events.onClick as any[] || []),
        { type: 'message', level: 'info', content: '操作成功' },
      ];
    }
    if (testCase.expectedActions?.includes('navigate')) {
      events.onClick = [
        ...(events.onClick as any[] || []),
        { type: 'navigate', to: '/home' },
      ];
    }
    if (testCase.expectedActions?.includes('confirm')) {
      events.onClick = [
        ...(events.onClick as any[] || []),
        { type: 'confirm', title: '确认操作' },
      ];
    }
    if (testCase.expectedActions?.includes('modal')) {
      events.onClick = [
        ...(events.onClick as any[] || []),
        { type: 'modal', id: 'testModal', open: true },
      ];
    }
    if (testCase.expectedActions?.includes('drawer')) {
      events.onClick = [
        ...(events.onClick as any[] || []),
        { type: 'drawer', id: 'testDrawer', open: true },
      ];
    }
    if (testCase.expectedActions?.includes('validate')) {
      events.onClick = [
        ...(events.onClick as any[] || []),
        { type: 'validate', formRef: 'formRef' },
      ];
    }
    if (testCase.expectedActions?.includes('resetForm')) {
      events.onClick = [
        ...(events.onClick as any[] || []),
        { type: 'resetForm', formRef: 'formRef' },
      ];
    }
    if (testCase.expectedActions?.includes('condition')) {
      events.onClick = [
        ...(events.onClick as any[] || []),
        { type: 'condition', if: '{{state.count > 0}}', then: [] },
      ];
    }
    if (testCase.expectedActions?.includes('loop')) {
      events.onClick = [
        ...(events.onClick as any[] || []),
        { type: 'loop', data: '{{state.items}}', body: [] },
      ];
    }
    if (testCase.expectedActions?.includes('script')) {
      events.onClick = [
        ...(events.onClick as any[] || []),
        { type: 'script', code: 'console.log("test");' },
      ];
    }
    if (testCase.expectedActions?.includes('copy')) {
      events.onClick = [
        ...(events.onClick as any[] || []),
        { type: 'copy', text: 'test' },
      ];
    }
    if (testCase.expectedActions?.includes('debounce')) {
      events.onChange = [
        { type: 'debounce', wait: 500, body: [{ type: 'fetch', url: '/api/search' }] },
      ];
    }
    if (testCase.expectedActions?.includes('throttle')) {
      events.onScroll = [
        { type: 'throttle', wait: 200, body: [{ type: 'fetch', url: '/api/load' }] },
      ];
    }
    if (testCase.expectedActions?.includes('emit')) {
      events.onClick = [
        ...(events.onClick as any[] || []),
        { type: 'emit', event: 'customEvent' },
      ];
    }
    if (testCase.expectedActions?.includes('download')) {
      events.onClick = [
        ...(events.onClick as any[] || []),
        { type: 'download', url: '/api/file.pdf' },
      ];
    }
    if (testCase.expectedActions?.includes('callMethod')) {
      events.onClick = [
        ...(events.onClick as any[] || []),
        { type: 'callMethod', name: 'handleClick' },
      ];
    }
    if (testCase.expectedActions?.includes('notification')) {
      events.onClick = [
        ...(events.onClick as any[] || []),
        { type: 'notification', level: 'info', message: '通知', description: '这是一条通知' },
      ];
    }

    baseSchema.body = [
      {
        component: 'Button',
        props: { children: '按钮' },
        events: Object.keys(events).length > 0 ? events : undefined,
      },
    ];
  }

  return baseSchema;
}

/**
 * 为所有测试用例生成 mock 响应
 */
function generateAllMocks(cases: TestCase[]): Record<string, PageSchema> {
  const mocks: Record<string, PageSchema> = {};
  cases.forEach((testCase) => {
    mocks[testCase.id] = generateMockResponse(testCase);
  });
  return mocks;
}

describe('LLM Generation Tests', () => {
  describe('Test Runner', () => {
    it('should create runner with default config', () => {
      const runner = new TestRunner({ mode: 'mock' });
      expect(runner).toBeDefined();
    });

    it('should register mock responses', () => {
      const runner = new TestRunner({ mode: 'mock' });
      const mockSchema: PageSchema = { body: [{ component: 'Button' }] };
      runner.registerMock('test-001', mockSchema);
    });

    it('should run single test case', async () => {
      const runner = new TestRunner({ mode: 'mock' });
      const testCase: TestCase = {
        id: 'test-001',
        name: 'Test Button',
        category: 'component',
        level: 'L1',
        prompt: 'Create a button',
        expectedComponent: 'Button',
      };
      runner.registerMock('test-001', { body: [{ component: 'Button' }] });

      const result = await runner.runTestCase(testCase);
      expect(result.testCaseId).toBe('test-001');
      expect(result.passed).toBe(true);
    });
  });

  describe('Component Cases - L1', () => {
    const mocks = generateAllMocks(componentCasesL1.slice(0, 10)); // 测试前 10 个用例

    it('should run Button tests', async () => {
      const buttonCases = componentCasesL1.filter((c) => c.subCategory === 'Button');
      const runner = new TestRunner({
        mode: 'mock',
        mocks: generateAllMocks(buttonCases),
      });

      const report = await runner.runAll(buttonCases.slice(0, 3));
      expect(report.summary.total).toBe(3);
      expect(report.mode).toBe('mock');
    });

    it('should run Input tests', async () => {
      const inputCases = componentCasesL1.filter((c) => c.subCategory === 'Input');
      const runner = new TestRunner({
        mode: 'mock',
        mocks: generateAllMocks(inputCases),
      });

      const report = await runner.runAll(inputCases.slice(0, 3));
      expect(report.summary.total).toBe(3);
      expect(report.mode).toBe('mock');
    });

    it('should run Select tests', async () => {
      const selectCases = componentCasesL1.filter((c) => c.subCategory === 'Select');
      const runner = new TestRunner({
        mode: 'mock',
        mocks: generateAllMocks(selectCases),
      });

      const report = await runner.runAll(selectCases.slice(0, 2));
      expect(report.summary.total).toBe(2);
      expect(report.mode).toBe('mock');
    });
  });

  describe('Component Cases - L2', () => {
    it('should run L2 combination tests', async () => {
      const runner = new TestRunner({
        mode: 'mock',
        mocks: generateAllMocks(componentCasesL2.slice(0, 5)),
      });

      const report = await runner.runAll(componentCasesL2.slice(0, 3));
      expect(report.summary.total).toBe(3);
      expect(report.mode).toBe('mock');
    });
  });

  describe('Action Cases - L1', () => {
    it('should run setState tests', async () => {
      const setStateCases = actionCasesL1.filter((c) => c.subCategory === 'setState');
      const runner = new TestRunner({
        mode: 'mock',
        mocks: generateAllMocks(setStateCases),
      });

      const report = await runner.runAll(setStateCases);
      expect(report.summary.total).toBe(setStateCases.length);
      expect(report.mode).toBe('mock');
    });

    it('should run message tests', async () => {
      const messageCases = actionCasesL1.filter((c) => c.subCategory === 'message');
      const runner = new TestRunner({
        mode: 'mock',
        mocks: generateAllMocks(messageCases),
      });

      const report = await runner.runAll(messageCases);
      expect(report.summary.total).toBe(messageCases.length);
      expect(report.mode).toBe('mock');
    });

    it('should run fetch tests', async () => {
      const fetchCases = actionCasesL1.filter((c) => c.subCategory === 'fetch');
      const runner = new TestRunner({
        mode: 'mock',
        mocks: generateAllMocks(fetchCases),
      });

      const report = await runner.runAll(fetchCases);
      expect(report.summary.total).toBe(fetchCases.length);
      expect(report.mode).toBe('mock');
    });

    it('should run confirm tests', async () => {
      const confirmCases = actionCasesL1.filter((c) => c.subCategory === 'confirm');
      const runner = new TestRunner({
        mode: 'mock',
        mocks: generateAllMocks(confirmCases),
      });

      const report = await runner.runAll(confirmCases);
      expect(report.summary.total).toBe(confirmCases.length);
      expect(report.mode).toBe('mock');
    });
  });

  describe('Action Cases - L2', () => {
    it('should run L2 combination tests', async () => {
      const runner = new TestRunner({
        mode: 'mock',
        mocks: generateAllMocks(actionCasesL2.slice(0, 5)),
      });

      const report = await runner.runAll(actionCasesL2.slice(0, 3));
      expect(report.summary.total).toBe(3);
      expect(report.mode).toBe('mock');
    });
  });

  describe('Full Test Suite', () => {
    it('should run full suite with mock data', async () => {
      const allCases = [
        ...componentCasesL1.slice(0, 10),
        ...actionCasesL1.slice(0, 10),
      ];

      const mocks = generateAllMocks(allCases);

      const report = await runFullTestSuite(allCases, {
        mode: 'mock',
        mocks,
      });

      expect(report.summary.total).toBe(20);
      expect(report.mode).toBe('mock');
    });
  });

  describe('Validator Integration', () => {
    it('should validate generated schema', async () => {
      const testCase: TestCase = {
        id: 'validator-001',
        name: 'Test Validation',
        category: 'component',
        level: 'L1',
        prompt: 'Create a button',
        expectedComponent: 'Button',
      };

      const validSchema: PageSchema = {
        body: [{ component: 'Button', props: { type: 'primary' } }],
      };

      const runner = new TestRunner({ mode: 'mock' });
      runner.registerMock('validator-001', validSchema);

      const result = await runner.runTestCase(testCase);
      expect(result.testCaseId).toBe('validator-001');
      expect(result.generatedSchema).toBeDefined();
    });
  });
});

/**
 * 导出运行完整测试套件的函数
 */
export async function runFullTestSuiteExport(options?: {
  mode?: 'mock' | 'live' | 'mixed';
  apiEndpoint?: string;
}): Promise<TestReport> {
  const allCases = [...componentCases, ...actionCases];

  // 在 mock 模式下，为所有用例生成 mock 响应
  if (!options || options.mode === 'mock') {
    const mocks = generateAllMocks(allCases);
    return runFullTestSuite(allCases, {
      mode: 'mock',
      mocks,
    });
  }

  return runFullTestSuite(allCases, {
    mode: options.mode,
    apiEndpoint: options.apiEndpoint,
  });
}
