import {
  COMPONENT_CONTRACT_V1_VERSION,
  type ComponentContract,
} from '../types/contract';

export const inputContract: ComponentContract = {
  componentType: 'Input',
  runtimeType: 'antd.Input',
  category: 'data-entry',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    value: { type: 'any', allowExpression: true },
    defaultValue: { type: 'any', allowExpression: true },
    placeholder: { type: 'string', allowExpression: true },
    allowClear: { type: 'boolean', default: false, allowExpression: true },
    disabled: { type: 'boolean', default: false, allowExpression: true },
    maxLength: { type: 'number', allowExpression: true },
    type: {
      type: 'enum',
      enum: ['text', 'password', 'search', 'email', 'number', 'url'],
      default: 'text',
      allowExpression: true,
    },
  },
  events: {
    onChange: {
      params: [{ name: 'event', type: 'ChangeEvent<HTMLInputElement>' }],
    },
    onPressEnter: {
      params: [{ name: 'event', type: 'KeyboardEvent' }],
    },
  },
  slots: {},
  children: {
    type: 'none',
  },
};
