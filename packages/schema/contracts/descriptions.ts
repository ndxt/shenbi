import {
  COMPONENT_CONTRACT_V1_VERSION,
  type ComponentContract,
} from '../types/contract';

// Descriptions 组件
export const descriptionsContract: ComponentContract = {
  componentType: 'Descriptions',
  runtimeType: 'antd.Descriptions',
  category: 'data-display',
  icon: 'AlignJustify',
  usageScenario: '展示详情键值对信息（如事项基本信息、订单详情）',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    title: {
      type: 'SchemaNode',
      description: '描述列表的标题',
    },
    extra: {
      type: 'SchemaNode',
      description: '描述列表的操作区域，显示在右上方',
    },
    bordered: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否展示边框',
    },
    column: {
      type: 'any',
      default: 3,
      allowExpression: true,
      description: '一行的 DescriptionItems 数量',
    },
    layout: {
      type: 'enum',
      enum: ['horizontal', 'vertical'],
      default: 'horizontal',
      allowExpression: true,
      description: '描述布局',
    },
    size: {
      type: 'enum',
      enum: ['default', 'middle', 'small'],
      allowExpression: true,
      description: '设置列表的大小',
    },
    colon: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否显示 label 后面的冒号',
    },
    items: {
      type: 'array',
      allowExpression: true,
      description: '描述列表项内容',
    },
    labelStyle: {
      type: 'object',
      deprecated: true,
      deprecatedMessage: '请使用 styles.label 替换',
      description: '自定义标签样式（已废弃）',
    },
    contentStyle: {
      type: 'object',
      deprecated: true,
      deprecatedMessage: '请使用 styles.content 替换',
      description: '自定义内容样式（已废弃）',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'nodes',
    description: 'Descriptions.Item 列表',
  },
};

// Descriptions.Item
export const descriptionsItemContract: ComponentContract = {
  componentType: 'Descriptions.Item',
  runtimeType: 'antd.Descriptions.Item',
  category: 'data-display',
  icon: 'Minus',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    label: {
      type: 'SchemaNode',
      description: '内容的描述',
    },
    span: {
      type: 'any',
      default: 1,
      allowExpression: true,
      description: '包含列的数量',
    },
    labelStyle: {
      type: 'object',
      deprecated: true,
      deprecatedMessage: '请使用 styles.label 替换',
      description: '自定义标签样式（已废弃）',
    },
    contentStyle: {
      type: 'object',
      deprecated: true,
      deprecatedMessage: '请使用 styles.content 替换',
      description: '自定义内容样式（已废弃）',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'nodes',
    description: '描述内容',
  },
};
