import type { PageSchema } from '../types/page';

/**
 * 视觉测试用例定义
 */
export interface VisualTestCase {
  /** 测试用例 ID */
  id: string;
  /** 测试用例名称 */
  name: string;
  /** 组件类型 */
  component: string;
  /** 测试类别 */
  category: 'basic' | 'interaction' | 'state' | 'size' | 'custom';
  /** Schema 定义 */
  schema: PageSchema;
  /** 截图区域配置 */
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** 等待时间（毫秒）- 用于动画完成 */
  waitFor?: number;
  /** 需要等待的选择器 */
  waitForSelector?: string;
  /** 预期文本内容 */
  expectedText?: string;
  /** 预期 CSS 样式检查 */
  expectedStyles?: Record<string, string>;
  /** 差异阈值（0-1，默认 0.05 表示 5% 差异） */
  diffThreshold?: number;
  /** 跳过测试 */
  skip?: boolean;
  /** 仅在当前环境运行 */
  only?: boolean;
}

/**
 * 视觉测试套件
 */
export interface VisualTestSuite {
  /** 套件名称 */
  name: string;
  /** 测试用例列表 */
  cases: VisualTestCase[];
}

/**
 * 视觉对比结果
 */
export interface VisualComparisonResult {
  /** 是否通过 */
  passed: boolean;
  /** 差异像素数量 */
  diffPixels: number;
  /** 总像素数量 */
  totalPixels: number;
  /** 差异比例 */
  diffRate: number;
  /** 差异截图路径 */
  diffImage?: string;
}
