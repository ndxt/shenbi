import type { VisualTestCase } from './types';

/**
 * Input 组件视觉测试用例
 */
export const inputVisualCases: VisualTestCase[] = [
  // ==================== 基础类型测试 ====================
  {
    id: 'input-visual-001',
    name: 'Input - 基础文本输入框',
    component: 'Input',
    category: 'basic',
    schema: {
      body: [{
        id: 'input-basic',
        component: 'Input',
        props: { placeholder: '请输入内容' },
      }],
    },
    waitForSelector: '.ant-input',
  },
  {
    id: 'input-visual-002',
    name: 'Input - 带默认值',
    component: 'Input',
    category: 'basic',
    schema: {
      body: [{
        id: 'input-value',
        component: 'Input',
        props: { defaultValue: '默认文本' },
      }],
    },
    waitForSelector: '.ant-input',
  },
  {
    id: 'input-visual-003',
    name: 'Input - 禁用状态',
    component: 'Input',
    category: 'state',
    schema: {
      body: [{
        id: 'input-disabled',
        component: 'Input',
        props: { disabled: true, placeholder: '禁用输入框' },
      }],
    },
    waitForSelector: '.ant-input-disabled',
  },

  // ==================== 尺寸测试 ====================
  {
    id: 'input-visual-004',
    name: 'Input - Large 尺寸',
    component: 'Input',
    category: 'size',
    schema: {
      body: [{
        id: 'input-large',
        component: 'Input',
        props: { size: 'large', placeholder: '大尺寸' },
      }],
    },
    waitForSelector: '.ant-input-lg',
  },
  {
    id: 'input-visual-005',
    name: 'Input - Small 尺寸',
    component: 'Input',
    category: 'size',
    schema: {
      body: [{
        id: 'input-small',
        component: 'Input',
        props: { size: 'small', placeholder: '小尺寸' },
      }],
    },
    waitForSelector: '.ant-input-sm',
  },

  // ==================== 带清除按钮 ====================
  {
    id: 'input-visual-006',
    name: 'Input - 带清除按钮',
    component: 'Input',
    category: 'custom',
    schema: {
      body: [{
        id: 'input-clear',
        component: 'Input',
        props: { allowClear: true, defaultValue: '可清除的内容' },
      }],
    },
    waitForSelector: '.ant-input-affix-wrapper',
  },

  // ==================== 带前后缀 ====================
  {
    id: 'input-visual-007',
    name: 'Input - 带前缀',
    component: 'Input',
    category: 'custom',
    schema: {
      body: [{
        id: 'input-prefix',
        component: 'Input',
        props: {
          prefix: '￥',
          placeholder: '请输入金额'
        },
      }],
    },
    waitForSelector: '.ant-input',
  },
  {
    id: 'input-visual-008',
    name: 'Input - 带后缀',
    component: 'Input',
    category: 'custom',
    schema: {
      body: [{
        id: 'input-suffix',
        component: 'Input',
        props: {
          suffix: '元',
          placeholder: '请输入金额'
        },
      }],
    },
    waitForSelector: '.ant-input',
  },

  // ==================== 密码输入框 ====================
  {
    id: 'input-visual-009',
    name: 'Input - 密码类型',
    component: 'Input',
    category: 'basic',
    schema: {
      body: [{
        id: 'input-password',
        component: 'Input',
        props: { type: 'password', placeholder: '请输入密码' },
      }],
    },
    waitForSelector: 'input[type="password"]',
  },

  // ==================== TextArea ====================
  {
    id: 'input-visual-010',
    name: 'Input.TextArea - 基础多行输入',
    component: 'Input.TextArea',
    category: 'basic',
    schema: {
      body: [{
        id: 'textarea-basic',
        component: 'Input.TextArea',
        props: { placeholder: '请输入多行文本', rows: 4 },
      }],
    },
    waitForSelector: 'textarea.ant-input',
  },
  {
    id: 'input-visual-011',
    name: 'Input.TextArea - 带字数统计',
    component: 'Input.TextArea',
    category: 'custom',
    schema: {
      body: [{
        id: 'textarea-count',
        component: 'Input.TextArea',
        props: { showCount: true, maxLength: 100, placeholder: '请输入（最多 100 字）' },
      }],
    },
    waitForSelector: '.ant-input-textarea-show-count',
  },
];

/**
 * Input 视觉测试套件
 */
export const inputVisualSuite = {
  name: 'Input',
  cases: inputVisualCases,
};
