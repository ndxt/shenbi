import {
  COMPONENT_CONTRACT_V1_VERSION,
  type ComponentContract,
} from '../types/contract';

export const modalContract: ComponentContract = {
  componentType: 'Modal',
  runtimeType: 'antd.Modal',
  category: 'feedback',
  icon: 'Layers2',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    open: {
      type: 'boolean',
      allowExpression: true,
      required: true,
    },
    title: {
      type: 'any',
      allowExpression: true,
    },
    width: {
      type: 'any',
      allowExpression: true,
      description: '支持 number 或 string',
    },
    destroyOnClose: {
      type: 'boolean',
      default: false,
      allowExpression: true,
    },
    maskClosable: {
      type: 'boolean',
      default: true,
      allowExpression: true,
    },
    footer: {
      type: 'any',
      allowExpression: true,
      description: '支持 null/ReactNode',
    },
  },
  events: {
    onOk: {
      params: [{ name: 'event', type: 'MouseEvent' }],
    },
    onCancel: {
      params: [{ name: 'event', type: 'MouseEvent' }],
    },
  },
  slots: {
    footer: {
      description: '自定义底部区域',
      multiple: false,
    },
  },
  children: {
    type: 'mixed',
  },
};
