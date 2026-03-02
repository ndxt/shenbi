import {
  COMPONENT_CONTRACT_V1_VERSION,
  type ComponentContract,
} from '../types/contract';

export const selectContract: ComponentContract = {
  componentType: 'Select',
  runtimeType: 'antd.Select',
  category: 'data-entry',
  icon: 'ListFilter',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    value: { type: 'any', allowExpression: true },
    defaultValue: { type: 'any', allowExpression: true },
    options: { type: 'array', allowExpression: true },
    mode: {
      type: 'enum',
      enum: ['multiple', 'tags'],
      allowExpression: true,
    },
    placeholder: { type: 'string', allowExpression: true },
    allowClear: { type: 'boolean', default: false, allowExpression: true },
    showSearch: { type: 'boolean', default: false, allowExpression: true },
    disabled: { type: 'boolean', default: false, allowExpression: true },
    style: { type: 'object', allowExpression: true },
  },
  events: {
    onChange: {
      params: [
        { name: 'value', type: 'any' },
        { name: 'option', type: 'any' },
      ],
    },
    onSearch: {
      params: [{ name: 'value', type: 'string' }],
    },
    onClear: {
      params: [],
    },
  },
  slots: {},
  children: {
    type: 'none',
  },
};
