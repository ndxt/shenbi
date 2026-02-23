import {
  COMPONENT_CONTRACT_V1_VERSION,
  type ComponentContract,
} from '../types/contract';

// FloatButton
export const floatButtonContract: ComponentContract = {
  componentType: 'FloatButton',
  runtimeType: 'antd.FloatButton',
  category: 'general',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    icon: {
      type: 'SchemaNode',
      description: '设置按钮图标组件',
    },
    content: {
      type: 'SchemaNode',
      description: '文本及其它内容（shape 为 square 时有效）',
    },
    type: {
      type: 'enum',
      enum: ['default', 'primary'],
      default: 'default',
      allowExpression: true,
      description: '设置按钮类型',
    },
    shape: {
      type: 'enum',
      enum: ['circle', 'square'],
      default: 'circle',
      allowExpression: true,
      description: '设置按钮形状',
    },
    tooltip: {
      type: 'any',
      allowExpression: true,
      description: '气泡卡片内容',
    },
    href: {
      type: 'string',
      allowExpression: true,
      description: '链接地址',
    },
    target: {
      type: 'string',
      allowExpression: true,
      description: '链接打开位置',
    },
    badge: {
      type: 'object',
      allowExpression: true,
      description: '附带徽标',
    },
  },
  events: {
    onClick: {
      description: '点击按钮时的回调',
      params: [{ name: 'event', type: 'MouseEvent' }],
    },
  },
  slots: {},
  children: {
    type: 'none',
  },
};

// FloatButton.Group
export const floatButtonGroupContract: ComponentContract = {
  componentType: 'FloatButton.Group',
  runtimeType: 'antd.FloatButton.Group',
  category: 'general',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    open: {
      type: 'boolean',
      allowExpression: true,
      description: '菜单是否可见（配合 trigger 使用）',
    },
    closeIcon: {
      type: 'SchemaNode',
      description: '自定义关闭按钮图标',
    },
    shape: {
      type: 'enum',
      enum: ['circle', 'square'],
      default: 'circle',
      allowExpression: true,
      description: '子按钮形状',
    },
    trigger: {
      type: 'enum',
      enum: ['click', 'hover'],
      allowExpression: true,
      description: '触发菜单的行为',
    },
    placement: {
      type: 'enum',
      enum: ['top', 'left', 'right', 'bottom'],
      default: 'top',
      allowExpression: true,
      description: '菜单弹出位置',
    },
  },
  events: {
    onOpenChange: {
      description: '菜单打开状态变化回调',
      params: [{ name: 'open', type: 'boolean' }],
    },
    onClick: {
      description: '点击按钮时的回调',
      params: [{ name: 'event', type: 'MouseEvent' }],
    },
  },
  slots: {},
  children: {
    type: 'nodes',
    description: 'FloatButton 列表',
  },
};

// FloatButton.BackTop
export const floatButtonBackTopContract: ComponentContract = {
  componentType: 'FloatButton.BackTop',
  runtimeType: 'antd.FloatButton.BackTop',
  category: 'general',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    duration: {
      type: 'number',
      default: 450,
      allowExpression: true,
      description: '回到顶部所需时间（ms）',
    },
    target: {
      type: 'function',
      description: '设置需要监听滚动事件的元素',
    },
    visibilityHeight: {
      type: 'number',
      default: 400,
      allowExpression: true,
      description: '滚动高度达到此参数值才出现',
    },
  },
  events: {
    onClick: {
      description: '点击按钮的回调函数',
      params: [],
    },
  },
  slots: {},
  children: {
    type: 'node',
    description: '自定义内容',
  },
};
