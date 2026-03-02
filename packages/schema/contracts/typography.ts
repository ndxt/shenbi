import {
  COMPONENT_CONTRACT_V1_VERSION,
  type ComponentContract,
} from '../types/contract';

// Typography.Text
export const typographyTextContract: ComponentContract = {
  componentType: 'Typography.Text',
  runtimeType: 'antd.Typography.Text',
  category: 'general',
  icon: 'Type',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    type: {
      type: 'enum',
      enum: ['secondary', 'success', 'warning', 'danger'],
      allowExpression: true,
      description: '文本类型',
    },
    code: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '代码样式',
    },
    copyable: {
      type: 'any',
      default: false,
      allowExpression: true,
      description: '是否可复制',
    },
    delete: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '删除线样式',
    },
    disabled: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '禁用状态',
    },
    editable: {
      type: 'any',
      default: false,
      allowExpression: true,
      description: '是否可编辑',
    },
    ellipsis: {
      type: 'any',
      default: false,
      allowExpression: true,
      description: '自动溢出省略',
    },
    keyboard: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '键盘样式',
    },
    mark: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '标记样式',
    },
    strong: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '加粗',
    },
    italic: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '斜体',
    },
    underline: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '下划线',
    },
  },
  events: {
    onClick: {
      description: '点击事件',
      params: [{ name: 'event', type: 'MouseEvent' }],
    },
  },
  slots: {},
  children: {
    type: 'text',
    description: '文本内容',
  },
};

// Typography.Title
export const typographyTitleContract: ComponentContract = {
  componentType: 'Typography.Title',
  runtimeType: 'antd.Typography.Title',
  category: 'general',
  icon: 'Heading',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    level: {
      type: 'enum',
      enum: [1, 2, 3, 4, 5],
      default: 1,
      allowExpression: true,
      description: '标题级别（h1-h5）',
    },
    type: {
      type: 'enum',
      enum: ['secondary', 'success', 'warning', 'danger'],
      allowExpression: true,
      description: '文本类型',
    },
    code: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '代码样式',
    },
    copyable: {
      type: 'any',
      default: false,
      allowExpression: true,
      description: '是否可复制',
    },
    delete: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '删除线样式',
    },
    disabled: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '禁用状态',
    },
    editable: {
      type: 'any',
      default: false,
      allowExpression: true,
      description: '是否可编辑',
    },
    ellipsis: {
      type: 'any',
      default: false,
      allowExpression: true,
      description: '自动溢出省略',
    },
    mark: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '标记样式',
    },
    italic: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '斜体',
    },
    underline: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '下划线',
    },
  },
  events: {
    onClick: {
      description: '点击事件',
      params: [{ name: 'event', type: 'MouseEvent' }],
    },
  },
  slots: {},
  children: {
    type: 'text',
    description: '标题内容',
  },
};

// Typography.Paragraph
export const typographyParagraphContract: ComponentContract = {
  componentType: 'Typography.Paragraph',
  runtimeType: 'antd.Typography.Paragraph',
  category: 'general',
  icon: 'AlignLeft',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    type: {
      type: 'enum',
      enum: ['secondary', 'success', 'warning', 'danger'],
      allowExpression: true,
      description: '文本类型',
    },
    code: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '代码样式',
    },
    copyable: {
      type: 'any',
      default: false,
      allowExpression: true,
      description: '是否可复制',
    },
    delete: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '删除线样式',
    },
    disabled: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '禁用状态',
    },
    editable: {
      type: 'any',
      default: false,
      allowExpression: true,
      description: '是否可编辑',
    },
    ellipsis: {
      type: 'any',
      default: false,
      allowExpression: true,
      description: '自动溢出省略',
    },
    mark: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '标记样式',
    },
    strong: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '加粗',
    },
    italic: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '斜体',
    },
    underline: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '下划线',
    },
  },
  events: {
    onClick: {
      description: '点击事件',
      params: [{ name: 'event', type: 'MouseEvent' }],
    },
  },
  slots: {},
  children: {
    type: 'text',
    description: '段落内容',
  },
};
