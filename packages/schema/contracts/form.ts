import {
  COMPONENT_CONTRACT_V1_VERSION,
  type ComponentContract,
} from '../types/contract';

export const formContract: ComponentContract = {
  componentType: 'Form',
  runtimeType: 'antd.Form',
  category: 'data-entry',
  icon: 'ClipboardList',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    layout: {
      type: 'enum',
      enum: ['horizontal', 'vertical', 'inline'],
      default: 'horizontal',
      allowExpression: true,
    },
    initialValues: {
      type: 'object',
      allowExpression: true,
    },
    disabled: {
      type: 'boolean',
      default: false,
      allowExpression: true,
    },
    preserve: {
      type: 'boolean',
      default: true,
      allowExpression: true,
    },
  },
  events: {
    onValuesChange: {
      params: [
        { name: 'changedValues', type: 'Record<string, any>' },
        { name: 'allValues', type: 'Record<string, any>' },
      ],
    },
    onFinish: {
      params: [{ name: 'values', type: 'Record<string, any>' }],
    },
    onFinishFailed: {
      params: [{ name: 'errorInfo', type: 'any' }],
    },
  },
  slots: {},
  children: {
    type: 'nodes',
    description: '通常为 Form.Item 列表',
  },
};
