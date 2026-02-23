import {
  COMPONENT_CONTRACT_V1_VERSION,
  type ComponentContract,
} from '../types/contract';

export const cardContract: ComponentContract = {
  componentType: 'Card',
  runtimeType: 'antd.Card',
  category: 'data-display',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    title: {
      type: 'any',
      allowExpression: true,
    },
    extra: {
      type: 'any',
      allowExpression: true,
    },
    bordered: {
      type: 'boolean',
      default: true,
      allowExpression: true,
    },
    size: {
      type: 'enum',
      enum: ['default', 'small'],
      allowExpression: true,
    },
    hoverable: {
      type: 'boolean',
      default: false,
      allowExpression: true,
    },
  },
  events: {},
  slots: {
    title: { description: '标题插槽', multiple: false },
    extra: { description: '右上角扩展区域', multiple: false },
  },
  children: {
    type: 'mixed',
  },
};
