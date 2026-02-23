import {
  COMPONENT_CONTRACT_V1_VERSION,
  type ComponentContract,
} from '../types/contract';

// Drawer 组件
export const drawerContract: ComponentContract = {
  componentType: 'Drawer',
  runtimeType: 'antd.Drawer',
  category: 'feedback',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    open: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: 'Drawer 是否可见',
    },
    title: {
      type: 'SchemaNode',
      description: '标题',
    },
    placement: {
      type: 'enum',
      enum: ['top', 'right', 'bottom', 'left'],
      default: 'right',
      allowExpression: true,
      description: '抽屉的方向',
    },
    size: {
      type: 'any',
      default: 'default',
      allowExpression: true,
      description: '预设抽屉宽度/高度，支持 default | large | number | string',
    },
    closable: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否显示关闭按钮',
    },
    mask: {
      type: 'any',
      default: true,
      allowExpression: true,
      description: '遮罩效果',
    },
    maskClosable: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '点击蒙层是否允许关闭',
    },
    destroyOnClose: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '关闭时销毁 Drawer 里的子元素',
    },
    destroyOnHidden: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '关闭时销毁 Drawer 里的子元素（隐藏时）',
    },
    footer: {
      type: 'SchemaNode',
      description: '抽屉的页脚',
    },
    extra: {
      type: 'SchemaNode',
      description: '抽屉右上角的操作区域',
    },
    loading: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '显示骨架屏',
    },
    push: {
      type: 'any',
      default: { distance: 180 },
      allowExpression: true,
      description: '多层 Drawer 的推动行为',
    },
    resizable: {
      type: 'any',
      allowExpression: true,
      description: '是否启用拖拽改变尺寸',
    },
    getContainer: {
      type: 'any',
      default: 'body',
      description: '指定 Drawer 挂载的节点',
    },
    keyboard: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否支持键盘 esc 关闭',
    },
    zIndex: {
      type: 'number',
      default: 1000,
      allowExpression: true,
      description: '设置 Drawer 的 z-index',
    },
    className: {
      type: 'string',
      description: 'Drawer 容器外层 className',
    },
    style: {
      type: 'object',
      description: 'Drawer 面板的样式',
    },
    rootClassName: {
      type: 'string',
      description: 'Drawer 最外层容器的 className',
    },
    rootStyle: {
      type: 'object',
      description: 'Drawer 最外层容器的样式',
    },
    width: {
      type: 'any',
      deprecated: true,
      deprecatedMessage: '请使用 size 替换',
      description: '宽度（已废弃）',
    },
    height: {
      type: 'any',
      deprecated: true,
      deprecatedMessage: '请使用 size 替换',
      description: '高度（已废弃）',
    },
    headerStyle: {
      type: 'object',
      deprecated: true,
      deprecatedMessage: '请使用 styles.header 替换',
      description: '头部样式（已废弃）',
    },
  },
  events: {
    onClose: {
      description: '点击遮罩层或关闭按钮的回调',
      params: [{ name: 'event', type: 'Event' }],
    },
    afterOpenChange: {
      description: '切换抽屉时动画结束后的回调',
      params: [{ name: 'open', type: 'boolean' }],
    },
  },
  slots: {},
  children: {
    type: 'nodes',
    description: '抽屉内容',
  },
};
