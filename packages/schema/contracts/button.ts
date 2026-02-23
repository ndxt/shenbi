import {
  COMPONENT_CONTRACT_V1_VERSION,
  type ComponentContract,
} from '../types/contract';

export const buttonContract: ComponentContract = {
  componentType: 'Button',
  runtimeType: 'antd.Button',
  category: 'general',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    type: {
      type: 'enum',
      enum: ['primary', 'default', 'dashed', 'text', 'link'],
      default: 'default',
      allowExpression: true,
      description: '按钮类型',
    },
    size: {
      type: 'enum',
      enum: ['large', 'middle', 'small'],
      allowExpression: true,
      description: '按钮尺寸',
    },
    danger: { type: 'boolean', default: false, allowExpression: true },
    loading: { type: 'boolean', default: false, allowExpression: true },
    disabled: { type: 'boolean', default: false, allowExpression: true },
    block: { type: 'boolean', default: false, allowExpression: true },
    shape: {
      type: 'enum',
      enum: ['default', 'circle', 'round'],
      allowExpression: true,
    },
    htmlType: {
      type: 'enum',
      enum: ['button', 'submit', 'reset'],
      default: 'button',
    },
    icon: { type: 'SchemaNode', description: '按钮图标节点' },
  },
  events: {
    onClick: {
      description: '点击按钮',
      params: [{ name: 'event', type: 'MouseEvent' }],
    },
  },
  slots: {},
  children: {
    type: 'mixed',
    description: '按钮文本或子节点',
  },
};
