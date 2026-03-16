import type { PageSchema } from '../../types';

/**
 * 测试用例定义
 */
export interface TestCase {
  /** 唯一标识 */
  id: string;
  /** 测试套件类型 */
  suite: 'component' | 'action' | 'complex';
  /** 测试级别 */
  level: 'L1' | 'L2';
  /** 生成 prompt */
  prompt: string;
  /** 断言条件 */
  assertions: TestCaseAssertions;
  /** 是否只跑 Mock 模式 */
  mockOnly?: boolean;
}

export interface TestCaseAssertions {
  /** 组件断言 */
  components?: {
    /** 必须包含的组件列表 */
    mustInclude?: string[];
    /** 不能包含的组件列表 */
    mustNotInclude?: string[];
  };
  /** Props 断言 */
  props?: Record<string, Record<string, unknown>>;
  /** Actions 断言 */
  actions?: {
    /** 必须包含的 Action */
    mustInclude?: Array<{ type: string; [key: string]: unknown }>;
    /** 不能包含的 Action */
    mustNotInclude?: string[];
  };
  /** 结构断言 */
  structure?: {
    /** 最大节点数 */
    maxNodeCount?: number;
    /** 最小节点数 */
    minNodeCount?: number;
  };
  /** 表达式断言 */
  expressions?: {
    /** 必须引用的状态/数据源 */
    mustReference?: string[];
    /** 不能引用的状态/数据源 */
    mustNotReference?: string[];
  };
  /** State 断言 */
  state?: {
    /** 必须声明的状态字段 */
    mustDeclare?: string[];
  };
}

/**
 * 单个测试用例的执行结果
 */
export interface TestCaseResult {
  id: string;
  status: 'pass' | 'fail' | 'skip';
  prompt: string;
  durationMs?: number;
  schema?: PageSchema;
  diagnostics?: Diagnostic[];
  failureReason?: string;
  assertionsPassed?: AssertionResult[];
}

/**
 * 单个断言的结果
 */
export interface AssertionResult {
  name: string;
  passed: boolean;
  message?: string;
}

/**
 * 校验诊断信息
 */
export interface Diagnostic {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  path?: string;
}

/**
 * 测试报告
 */
export interface TestReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
    durationMs: number;
  };
  cases: TestCaseResult[];
  metadata: {
    timestamp: string;
    mode: 'mock' | 'live' | 'mixed';
    apiEndpoint?: string;
  };
}

/**
 * 测试运行配置
 */
export interface TestRunnerConfig {
  /** API 端点 */
  apiEndpoint?: string;
  /** 运行模式 */
  mode: 'mock' | 'live' | 'mixed';
  /** L1 通过率阈值 */
  l1Threshold?: number;
  /** L2 通过率阈值 */
  l2Threshold?: number;
  /** 超时时间 (ms) */
  timeout?: number;
  /** 并发数 */
  concurrency?: number;
  /** 是否只运行指定 ID 的 case */
  onlyIds?: string[];
  /** 是否跳过指定 ID 的 case */
  skipIds?: string[];
}

/**
 * Mock 响应数据
 */
export interface MockResponse {
  schema: PageSchema;
  durationMs?: number;
  tokensUsed?: number;
}
