import type { PageSchema } from '../../types/page';
import type { Diagnostic } from '../types/contract';

/**
 * LLM 生成测试用例定义
 */
export interface TestCase {
  /** 测试用例 ID */
  id: string;
  /** 测试用例名称 */
  name: string;
  /** 测试类别 */
  category: 'component' | 'action' | 'expression' | 'page';
  /** 测试子类别 */
  subCategory?: string;
  /** 测试难度级别 L1=单属性，L2=多属性组合，L3=复杂场景 */
  level: 'L1' | 'L2' | 'L3';
  /** 输入给 LLM 的 prompt */
  prompt: string;
  /** 期望的组件类型（用于组件测试） */
  expectedComponent?: string;
  /** 期望包含的 props（用于验证） */
  expectedProps?: string[];
  /** 期望包含的 actions（用于验证） */
  expectedActions?: string[];
  /** 运行配置 */
  config?: TestCaseConfig;
}

export interface TestCaseConfig {
  /** 是否允许额外 props */
  allowExtraProps?: boolean;
  /** 是否允许额外 actions */
  allowExtraActions?: boolean;
  /** 表达式校验级别 */
  expressionValidation?: 'strict' | 'loose';
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * 单个测试结果
 */
export interface TestCaseResult {
  /** 测试用例 ID */
  testCaseId: string;
  /** 测试是否通过 */
  passed: boolean;
  /** 生成的 Schema */
  generatedSchema?: PageSchema | null;
  /** 验证错误列表 */
  diagnostics: Diagnostic[];
  /** 运行时间（毫秒） */
  duration: number;
  /** 错误信息 */
  error?: string;
  /** 详细信息 */
  details?: {
    /** 组件匹配结果 */
    componentMatch?: boolean;
    /** Props 匹配结果 */
    propsMatch?: {
      passed: boolean;
      expected: string[];
      actual: string[];
      missing: string[];
      extra: string[];
    };
    /** Actions 匹配结果 */
    actionsMatch?: {
      passed: boolean;
      expected: string[];
      actual: string[];
      missing: string[];
      extra: string[];
    };
    /** 表达式验证结果 */
    expressionValidation?: {
      passed: boolean;
      invalidExpressions: string[];
    };
  };
}

/**
 * 测试报告
 */
export interface TestReport {
  /** 运行时间戳 */
  timestamp: string;
  /** 测试模式 */
  mode: 'mock' | 'live' | 'mixed';
  /** 总体统计 */
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
    avgDuration: number;
  };
  /** 按类别分组统计 */
  byCategory: {
    component: { total: number; passed: number; passRate: number };
    action: { total: number; passed: number; passRate: number };
    expression: { total: number; passed: number; passRate: number };
    page: { total: number; passed: number; passRate: number };
  };
  /** 按难度级别分组统计 */
  byLevel: {
    L1: { total: number; passed: number; passRate: number };
    L2: { total: number; passed: number; passRate: number };
    L3: { total: number; passed: number; passRate: number };
  };
  /** 详细结果 */
  results: TestCaseResult[];
  /** 诊断信息 */
  diagnostics: Diagnostic[];
}

/**
 * 测试运行器配置
 */
export interface TestRunnerConfig {
  /** 运行模式：mock=使用 mock 响应，live=真实调用 LLM，mixed=优先 mock 失败时 live */
  mode: 'mock' | 'live' | 'mixed';
  /** LLM API 端点 */
  apiEndpoint?: string;
  /** API 密钥 */
  apiKey?: string;
  /** 模型名称 */
  model?: string;
  /** 并发数 */
  concurrency?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 重试次数 */
  retries?: number;
  /** Mock 响应映射 */
  mocks?: Record<string, string | PageSchema>;
  /** 是否生成详细报告 */
  verbose?: boolean;
}

/**
 * LLM API 请求格式
 */
export interface LLMRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  response_format?: {
    type: 'json_object';
  };
}

/**
 * LLM API 响应格式
 */
export interface LLMResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
