import type { VisualTestCase } from './types';

/**
 * Button 组件视觉测试用例
 */
export const buttonVisualCases: VisualTestCase[] = [
  // ==================== 基础类型测试 ====================
  {
    id: 'button-visual-001',
    name: 'Button - Primary 类型',
    component: 'Button',
    category: 'basic',
    schema: {
      body: [{
        id: 'btn-primary',
        component: 'Button',
        props: { type: 'primary', children: '主要按钮' },
      }],
    },
    waitForSelector: '.ant-btn-primary',
    expectedText: '主要按钮',
  },
  {
    id: 'button-visual-002',
    name: 'Button - Default 类型',
    component: 'Button',
    category: 'basic',
    schema: {
      body: [{
        id: 'btn-default',
        component: 'Button',
        props: { type: 'default', children: '默认按钮' },
      }],
    },
    waitForSelector: '.ant-btn-default',
    expectedText: '默认按钮',
  },
  {
    id: 'button-visual-003',
    name: 'Button - Dashed 类型',
    component: 'Button',
    category: 'basic',
    schema: {
      body: [{
        id: 'btn-dashed',
        component: 'Button',
        props: { type: 'dashed', children: '虚线按钮' },
      }],
    },
    waitForSelector: '.ant-btn-dashed',
    expectedText: '虚线按钮',
  },
  {
    id: 'button-visual-004',
    name: 'Button - Text 类型',
    component: 'Button',
    category: 'basic',
    schema: {
      body: [{
        id: 'btn-text',
        component: 'Button',
        props: { type: 'text', children: '文本按钮' },
      }],
    },
    waitForSelector: '.ant-btn-text',
    expectedText: '文本按钮',
  },
  {
    id: 'button-visual-005',
    name: 'Button - Link 类型',
    component: 'Button',
    category: 'basic',
    schema: {
      body: [{
        id: 'btn-link',
        component: 'Button',
        props: { type: 'link', children: '链接按钮' },
      }],
    },
    waitForSelector: '.ant-btn-link',
    expectedText: '链接按钮',
  },

  // ==================== Danger 模式 ====================
  {
    id: 'button-visual-006',
    name: 'Button - Danger Primary',
    component: 'Button',
    category: 'state',
    schema: {
      body: [{
        id: 'btn-danger-primary',
        component: 'Button',
        props: { type: 'primary', danger: true, children: '危险操作' },
      }],
    },
    waitForSelector: '.ant-btn-dangerous.ant-btn-primary',
    expectedText: '危险操作',
  },
  {
    id: 'button-visual-007',
    name: 'Button - Danger Default',
    component: 'Button',
    category: 'state',
    schema: {
      body: [{
        id: 'btn-danger-default',
        component: 'Button',
        props: { type: 'default', danger: true, children: '危险取消' },
      }],
    },
    waitForSelector: '.ant-btn-dangerous.ant-btn-default',
    expectedText: '危险取消',
  },

  // ==================== 尺寸测试 ====================
  {
    id: 'button-visual-008',
    name: 'Button - Large 尺寸',
    component: 'Button',
    category: 'size',
    schema: {
      body: [{
        id: 'btn-large',
        component: 'Button',
        props: { type: 'primary', size: 'large', children: '大按钮' },
      }],
    },
    waitForSelector: '.ant-btn-lg',
    expectedText: '大按钮',
  },
  {
    id: 'button-visual-009',
    name: 'Button - Middle 尺寸',
    component: 'Button',
    category: 'size',
    schema: {
      body: [{
        id: 'btn-middle',
        component: 'Button',
        props: { type: 'primary', size: 'middle', children: '中按钮' },
      }],
    },
    waitForSelector: '.ant-btn',
    expectedText: '中按钮',
  },
  {
    id: 'button-visual-010',
    name: 'Button - Small 尺寸',
    component: 'Button',
    category: 'size',
    schema: {
      body: [{
        id: 'btn-small',
        component: 'Button',
        props: { type: 'primary', size: 'small', children: '小按钮' },
      }],
    },
    waitForSelector: '.ant-btn-sm',
    expectedText: '小按钮',
  },

  // ==================== 形状测试 ====================
  {
    id: 'button-visual-011',
    name: 'Button - Circle 形状',
    component: 'Button',
    category: 'custom',
    schema: {
      body: [{
        id: 'btn-circle',
        component: 'Button',
        props: { shape: 'circle', children: 'A' },
      }],
    },
    waitForSelector: '.ant-btn-circle',
    expectedText: 'A',
  },
  {
    id: 'button-visual-012',
    name: 'Button - Round 形状',
    component: 'Button',
    category: 'custom',
    schema: {
      body: [{
        id: 'btn-round',
        component: 'Button',
        props: { shape: 'round', type: 'primary', children: '圆角按钮' },
      }],
    },
    waitForSelector: '.ant-btn-round',
    expectedText: '圆角按钮',
  },

  // ==================== 状态测试 ====================
  {
    id: 'button-visual-013',
    name: 'Button - Loading 状态',
    component: 'Button',
    category: 'state',
    schema: {
      body: [{
        id: 'btn-loading',
        component: 'Button',
        props: { type: 'primary', loading: true, children: '加载中' },
      }],
    },
    waitForSelector: '.ant-btn-loading',
    expectedText: '加载中',
  },
  {
    id: 'button-visual-014',
    name: 'Button - Disabled 状态',
    component: 'Button',
    category: 'state',
    schema: {
      body: [{
        id: 'btn-disabled',
        component: 'Button',
        props: { type: 'primary', disabled: true, children: '禁用按钮' },
      }],
    },
    waitForSelector: '.ant-btn[disabled]',
    expectedText: '禁用按钮',
  },
  {
    id: 'button-visual-015',
    name: 'Button - Block 块级',
    component: 'Button',
    category: 'custom',
    schema: {
      body: [{
        id: 'btn-block',
        component: 'Button',
        props: { type: 'primary', block: true, children: '块级按钮' },
      }],
    },
    waitForSelector: '.ant-btn-block',
    expectedText: '块级按钮',
  },

  // ==================== 带图标按钮 ====================
  {
    id: 'button-visual-016',
    name: 'Button - 带 Icon',
    component: 'Button',
    category: 'custom',
    schema: {
      body: [{
        id: 'btn-icon',
        component: 'Button',
        props: {
          type: 'primary',
          icon: { component: 'span', props: { children: '+' } },
          children: '添加'
        },
      }],
    },
    waitForSelector: '.ant-btn-primary',
    expectedText: '添加',
  },
];

/**
 * Button 视觉测试套件
 */
export const buttonVisualSuite = {
  name: 'Button',
  cases: buttonVisualCases,
};
