import {
  COMPONENT_CONTRACT_V1_VERSION,
  type ComponentContract,
} from '../types/contract';

// Alert
export const alertContract: ComponentContract = {
  componentType: 'Alert',
  runtimeType: 'antd.Alert',
  category: 'feedback',
  icon: 'AlertCircle',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    action: {
      type: 'SchemaNode',
      description: '自定义操作项',
    },
    banner: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否用作顶部公告',
    },
    closable: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否显示关闭按钮',
    },
    closeIcon: {
      type: 'SchemaNode',
      description: '自定义关闭 Icon',
    },
    closeText: {
      type: 'SchemaNode',
      description: '自定义关闭按钮',
    },
    description: {
      type: 'SchemaNode',
      description: '警告提示的辅助性文字介绍',
    },
    icon: {
      type: 'SchemaNode',
      description: '自定义图标',
    },
    message: {
      type: 'SchemaNode',
      required: true,
      description: '警告提示内容',
    },
    showIcon: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否显示辅助图标',
    },
    type: {
      type: 'enum',
      enum: ['success', 'info', 'warning', 'error'],
      default: 'info',
      allowExpression: true,
      description: '指定警告提示的样式',
    },
  },
  events: {
    onClose: {
      description: '关闭时触发的回调函数',
      params: [{ name: 'e', type: 'MouseEvent' }],
    },
    afterClose: {
      description: '关闭动画结束后触发的回调函数',
      params: [],
    },
  },
  slots: {},
  children: {
    type: 'none',
  },
};

// Message (静态方法，非组件)
// 跳过：message 是全局静态方法，不作为组件契约

// Notification (静态方法，非组件)
// 跳过：notification 是全局静态方法，不作为组件契约

// Popconfirm
export const popconfirmContract: ComponentContract = {
  componentType: 'Popconfirm',
  runtimeType: 'antd.Popconfirm',
  category: 'feedback',
  icon: 'HelpCircle',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    cancelButtonProps: {
      type: 'object',
      allowExpression: true,
      description: '取消按钮 props',
    },
    cancelText: {
      type: 'SchemaNode',
      default: '取消',
      description: '取消按钮文字',
    },
    description: {
      type: 'SchemaNode',
      description: '确认内容的详细描述',
    },
    disabled: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否禁用',
    },
    icon: {
      type: 'SchemaNode',
      description: '自定义弹出气泡 Icon 图标',
    },
    okButtonProps: {
      type: 'object',
      allowExpression: true,
      description: '确认按钮 props',
    },
    okText: {
      type: 'SchemaNode',
      default: '确定',
      description: '确认按钮文字',
    },
    okType: {
      type: 'enum',
      enum: ['primary', 'ghost', 'dashed', 'link', 'text', 'default'],
      default: 'primary',
      allowExpression: true,
      description: '确认按钮类型',
    },
    open: {
      type: 'boolean',
      allowExpression: true,
      description: '是否显示弹出框',
    },
    defaultOpen: {
      type: 'boolean',
      default: false,
      description: '默认是否显隐',
    },
    showCancel: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否显示取消按钮',
    },
    title: {
      type: 'SchemaNode',
      description: '确认框的描述',
    },
    trigger: {
      type: 'enum',
      enum: ['hover', 'focus', 'click', 'contextMenu'],
      default: 'click',
      allowExpression: true,
      description: '触发行为',
    },
    placement: {
      type: 'enum',
      enum: ['top', 'left', 'right', 'bottom', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight', 'leftTop', 'leftBottom', 'rightTop', 'rightBottom'],
      default: 'top',
      allowExpression: true,
      description: '气泡弹出位置',
    },
    arrow: {
      type: 'any',
      default: true,
      allowExpression: true,
      description: '修改箭头的显示状态',
    },
  },
  events: {
    onOpenChange: {
      description: '显示隐藏的回调',
      params: [{ name: 'open', type: 'boolean' }],
    },
    onConfirm: {
      description: '点击确认的回调',
      params: [{ name: 'e', type: 'MouseEvent' }],
    },
    onCancel: {
      description: '点击取消的回调',
      params: [{ name: 'e', type: 'MouseEvent' }],
    },
  },
  slots: {},
  children: {
    type: 'node',
    description: '触发元素',
  },
};

// Progress
export const progressContract: ComponentContract = {
  componentType: 'Progress',
  runtimeType: 'antd.Progress',
  category: 'feedback',
  icon: 'Percent',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    format: {
      type: 'function',
      description: '内容的格式函数',
    },
    percent: {
      type: 'number',
      default: 0,
      allowExpression: true,
      description: '当前进度百分比',
    },
    showInfo: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否显示进度数值或状态图标',
    },
    size: {
      type: 'any',
      default: 'default',
      allowExpression: true,
      description: '进度条尺寸',
    },
    status: {
      type: 'enum',
      enum: ['success', 'exception', 'normal', 'active'],
      allowExpression: true,
      description: '进度条的状态',
    },
    steps: {
      type: 'number',
      allowExpression: true,
      description: '进度条总步数',
    },
    strokeLinecap: {
      type: 'enum',
      enum: ['round', 'square', 'butt'],
      default: 'round',
      allowExpression: true,
      description: '进度条端点形状',
    },
    strokeWidth: {
      type: 'number',
      allowExpression: true,
      description: '进度条线的宽度',
    },
    strokeColor: {
      type: 'any',
      allowExpression: true,
      description: '进度条的颜色',
    },
    trailColor: {
      type: 'string',
      allowExpression: true,
      description: '未完成的分段的颜色',
    },
    type: {
      type: 'enum',
      enum: ['line', 'circle', 'dashboard', 'block'],
      default: 'line',
      allowExpression: true,
      description: '进度条类型',
    },
    circleWidth: {
      type: 'any',
      allowExpression: true,
      description: '圆形进度条线的宽度（仅 circle/dashboard）',
    },
    success: {
      type: 'object',
      allowExpression: true,
      description: '成功的进度条相关配置',
    },
    gapDegree: {
      type: 'number',
      allowExpression: true,
      description: '仪表盘进度条缺口角度',
    },
    gapPosition: {
      type: 'enum',
      enum: ['top', 'bottom', 'left', 'right'],
      allowExpression: true,
      description: '仪表盘进度条缺口位置',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'none',
  },
};

// Result
export const resultContract: ComponentContract = {
  componentType: 'Result',
  runtimeType: 'antd.Result',
  category: 'feedback',
  icon: 'CircleCheck',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    extra: {
      type: 'SchemaNode',
      description: '操作区',
    },
    icon: {
      type: 'SchemaNode',
      description: '自定义 icon',
    },
    status: {
      type: 'enum',
      enum: ['success', 'error', 'info', 'warning', '404', '403', '500'],
      default: 'info',
      allowExpression: true,
      description: '结果的状态',
    },
    subTitle: {
      type: 'SchemaNode',
      description: 'subTitle 文字',
    },
    title: {
      type: 'SchemaNode',
      description: 'title 文字',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'none',
  },
};

// Skeleton
export const skeletonContract: ComponentContract = {
  componentType: 'Skeleton',
  runtimeType: 'antd.Skeleton',
  category: 'feedback',
  icon: 'Scan',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    active: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否展示动画效果',
    },
    avatar: {
      type: 'any',
      default: false,
      allowExpression: true,
      description: '是否显示头像占位图',
    },
    loading: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '为 true 时，显示占位图',
    },
    paragraph: {
      type: 'any',
      default: true,
      allowExpression: true,
      description: '是否显示段落占位图',
    },
    round: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否使用圆角样式',
    },
    title: {
      type: 'any',
      default: true,
      allowExpression: true,
      description: '是否显示标题占位图',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'nodes',
    description: '加载完成后的内容',
  },
};

// Skeleton.Button
export const skeletonButtonContract: ComponentContract = {
  componentType: 'Skeleton.Button',
  runtimeType: 'antd.Skeleton.Button',
  category: 'feedback',
  icon: 'Square',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    active: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否展示动画效果',
    },
    block: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否将宽度调整为父元素宽度',
    },
    shape: {
      type: 'enum',
      enum: ['circle', 'square', 'round', 'default'],
      default: 'default',
      allowExpression: true,
      description: '指定按钮的形状',
    },
    size: {
      type: 'enum',
      enum: ['large', 'small', 'default'],
      default: 'default',
      allowExpression: true,
      description: '按钮大小',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'none',
  },
};

// Skeleton.Input
export const skeletonInputContract: ComponentContract = {
  componentType: 'Skeleton.Input',
  runtimeType: 'antd.Skeleton.Input',
  category: 'feedback',
  icon: 'Minus',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    active: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否展示动画效果',
    },
    size: {
      type: 'enum',
      enum: ['large', 'small', 'default'],
      default: 'default',
      allowExpression: true,
      description: '输入框大小',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'none',
  },
};

// Skeleton.Image
export const skeletonImageContract: ComponentContract = {
  componentType: 'Skeleton.Image',
  runtimeType: 'antd.Skeleton.Image',
  category: 'feedback',
  icon: 'Image',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    active: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否展示动画效果',
    },
    style: {
      type: 'object',
      allowExpression: true,
      description: '自定义样式',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'none',
  },
};

// Spin
export const spinContract: ComponentContract = {
  componentType: 'Spin',
  runtimeType: 'antd.Spin',
  category: 'feedback',
  icon: 'Loader',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    delay: {
      type: 'number',
      allowExpression: true,
      description: '延迟显示加载效果的时间',
    },
    fullscreen: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否全屏显示',
    },
    indicator: {
      type: 'SchemaNode',
      description: '加载指示符',
    },
    percent: {
      type: 'number',
      allowExpression: true,
      description: '进度百分比（0-100）',
    },
    size: {
      type: 'enum',
      enum: ['small', 'default', 'large'],
      default: 'default',
      allowExpression: true,
      description: '组件大小',
    },
    spinning: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否加载中',
    },
    tip: {
      type: 'SchemaNode',
      description: '自定义描述文案',
    },
    wrapperClassName: {
      type: 'string',
      allowExpression: true,
      description: '包装器的类属性',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'nodes',
    description: '包裹的内容',
  },
};

// Watermark
export const watermarkContract: ComponentContract = {
  componentType: 'Watermark',
  runtimeType: 'antd.Watermark',
  category: 'feedback',
  icon: 'Droplets',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    content: {
      type: 'any',
      allowExpression: true,
      description: '水印内容',
    },
    font: {
      type: 'object',
      allowExpression: true,
      description: '文字样式',
    },
    gap: {
      type: 'array',
      default: [100, 100],
      allowExpression: true,
      description: '水印之间的间距',
    },
    image: {
      type: 'string',
      allowExpression: true,
      description: '图片源（建议导出 2 倍或 3 倍图）',
    },
    offset: {
      type: 'array',
      allowExpression: true,
      description: '水印距离容器左上角的偏移量',
    },
    rotate: {
      type: 'number',
      default: -22,
      allowExpression: true,
      description: '水印绘制时旋转的角度',
    },
    width: {
      type: 'number',
      allowExpression: true,
      description: '水印的宽度',
    },
    height: {
      type: 'number',
      allowExpression: true,
      description: '水印的高度',
    },
    inherit: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否继承父元素的水印',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'nodes',
    description: '需要添加水印的内容',
  },
};
