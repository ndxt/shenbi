import {
  COMPONENT_CONTRACT_V1_VERSION,
  type ComponentContract,
} from '../types/contract';

// Space 组件
export const spaceContract: ComponentContract = {
  componentType: 'Space',
  runtimeType: 'antd.Space',
  category: 'layout',
  icon: 'GripHorizontal',
  usageScenario: '控制相邻元素间距（如按钮组、标签组），不适合用作动态/历史记录列表容器',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    align: {
      type: 'enum',
      enum: ['start', 'end', 'center', 'baseline'],
      allowExpression: true,
      description: '对齐方式',
    },
    direction: {
      type: 'enum',
      enum: ['vertical', 'horizontal'],
      default: 'horizontal',
      allowExpression: true,
      description: '间距方向',
    },
    size: {
      type: 'any',
      default: 'small',
      allowExpression: true,
      description: '间距大小，可传 small | middle | large | number | [水平, 垂直]',
    },
    split: {
      type: 'SchemaNode',
      description: '拆分符（已废弃，请用 separator）',
      deprecated: true,
    },
    separator: {
      type: 'SchemaNode',
      description: '自定义分隔符',
    },
    wrap: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否自动换行，仅在 horizontal 时有效',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'nodes',
    description: '子元素列表',
  },
};

// Space.Compact 组件
export const spaceCompactContract: ComponentContract = {
  componentType: 'Space.Compact',
  runtimeType: 'antd.Space.Compact',
  category: 'layout',
  icon: 'Minimize2',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    block: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '宽度 100% 显示',
    },
    direction: {
      type: 'enum',
      enum: ['vertical', 'horizontal'],
      default: 'horizontal',
      allowExpression: true,
      description: '布局方向',
    },
    size: {
      type: 'enum',
      enum: ['small', 'middle', 'large'],
      default: 'middle',
      allowExpression: true,
      description: '子组件大小',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'nodes',
    description: '紧凑排列的子组件',
  },
};
