import {
  COMPONENT_CONTRACT_V1_VERSION,
  type ComponentContract,
} from '../types/contract';

// Row 组件
export const rowContract: ComponentContract = {
  componentType: 'Row',
  runtimeType: 'antd.Row',
  category: 'layout',
  icon: 'Columns3',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    align: {
      type: 'enum',
      enum: ['top', 'middle', 'bottom', 'stretch'],
      default: 'top',
      allowExpression: true,
      description: '垂直对齐方式',
    },
    gutter: {
      type: 'any',
      default: 0,
      allowExpression: true,
      description: '栅格间隔，可传数字或数组 [水平, 垂直]',
    },
    justify: {
      type: 'enum',
      enum: ['start', 'end', 'center', 'space-around', 'space-between', 'space-evenly'],
      default: 'start',
      allowExpression: true,
      description: '水平排列方式',
    },
    wrap: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否自动换行',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'nodes',
    description: 'Col 组件列表',
  },
};

// Col 组件
export const colContract: ComponentContract = {
  componentType: 'Col',
  runtimeType: 'antd.Col',
  category: 'layout',
  icon: 'RectangleHorizontal',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    flex: {
      type: 'any',
      allowExpression: true,
      description: 'flex 布局属性',
    },
    offset: {
      type: 'number',
      default: 0,
      allowExpression: true,
      description: '栅格左侧偏移格数',
    },
    order: {
      type: 'number',
      default: 0,
      allowExpression: true,
      description: '栅格顺序',
    },
    pull: {
      type: 'number',
      default: 0,
      allowExpression: true,
      description: '栅格向左移动格数',
    },
    push: {
      type: 'number',
      default: 0,
      allowExpression: true,
      description: '栅格向右移动格数',
    },
    span: {
      type: 'number',
      allowExpression: true,
      description: '栅格占位格数（0-24，0 表示隐藏）',
    },
    xs: {
      type: 'any',
      allowExpression: true,
      description: '屏幕 < 576px 时的响应式配置',
    },
    sm: {
      type: 'any',
      allowExpression: true,
      description: '屏幕 ≥ 576px 时的响应式配置',
    },
    md: {
      type: 'any',
      allowExpression: true,
      description: '屏幕 ≥ 768px 时的响应式配置',
    },
    lg: {
      type: 'any',
      allowExpression: true,
      description: '屏幕 ≥ 992px 时的响应式配置',
    },
    xl: {
      type: 'any',
      allowExpression: true,
      description: '屏幕 ≥ 1200px 时的响应式配置',
    },
    xxl: {
      type: 'any',
      allowExpression: true,
      description: '屏幕 ≥ 1600px 时的响应式配置',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'nodes',
    description: '列内容',
  },
};
