import {
  COMPONENT_CONTRACT_V1_VERSION,
  type ComponentContract,
} from '../types/contract';

// Image
export const imageContract: ComponentContract = {
  componentType: 'Image',
  runtimeType: 'antd.Image',
  category: 'data-display',
  icon: 'Image',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    alt: {
      type: 'string',
      allowExpression: true,
      description: '图片描述',
    },
    fallback: {
      type: 'string',
      allowExpression: true,
      description: '加载失败容错地址',
    },
    height: {
      type: 'any',
      allowExpression: true,
      description: '图片高度',
    },
    placeholder: {
      type: 'SchemaNode',
      description: '加载占位',
    },
    preview: {
      type: 'any',
      default: true,
      allowExpression: true,
      description: '预览参数',
    },
    src: {
      type: 'string',
      allowExpression: true,
      description: '图片地址',
    },
    width: {
      type: 'any',
      allowExpression: true,
      description: '图片宽度',
    },
  },
  events: {
    onError: {
      description: '加载错误回调',
      params: [{ name: 'event', type: 'Event' }],
    },
    onPreview: {
      description: '预览回调',
      params: [],
    },
  },
  slots: {},
  children: {
    type: 'none',
  },
};

// Image.PreviewGroup
export const imagePreviewGroupContract: ComponentContract = {
  componentType: 'Image.PreviewGroup',
  runtimeType: 'antd.Image.PreviewGroup',
  category: 'data-display',
  icon: 'Images',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    items: {
      type: 'array',
      allowExpression: true,
      description: '预览图片列表',
    },
    fallback: {
      type: 'string',
      allowExpression: true,
      description: '加载失败容错地址',
    },
    preview: {
      type: 'any',
      default: true,
      allowExpression: true,
      description: '预览参数',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'nodes',
    description: 'Image 列表',
  },
};

// Popover
export const popoverContract: ComponentContract = {
  componentType: 'Popover',
  runtimeType: 'antd.Popover',
  category: 'data-display',
  icon: 'MessageSquare',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    arrow: {
      type: 'any',
      default: true,
      allowExpression: true,
      description: '修改箭头的显示状态',
    },
    content: {
      type: 'SchemaNode',
      description: '卡片内容',
    },
    defaultOpen: {
      type: 'boolean',
      default: false,
      description: '默认是否显隐',
    },
    open: {
      type: 'boolean',
      allowExpression: true,
      description: '用于手动控制浮层显隐',
    },
    overlayClassName: {
      type: 'string',
      allowExpression: true,
      description: '卡片类名',
    },
    overlayStyle: {
      type: 'object',
      allowExpression: true,
      description: '卡片样式',
    },
    overlayInnerStyle: {
      type: 'object',
      allowExpression: true,
      description: '卡片内容样式',
    },
    placement: {
      type: 'enum',
      enum: ['top', 'left', 'right', 'bottom', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight', 'leftTop', 'leftBottom', 'rightTop', 'rightBottom'],
      default: 'top',
      allowExpression: true,
      description: '气泡卡片位置',
    },
    title: {
      type: 'SchemaNode',
      description: '卡片标题',
    },
    trigger: {
      type: 'enum',
      enum: ['hover', 'focus', 'click', 'contextMenu'],
      default: 'hover',
      allowExpression: true,
      description: '触发行为',
    },
    mouseEnterDelay: {
      type: 'number',
      default: 0.1,
      allowExpression: true,
      description: '鼠标移入后延时多少才显示',
    },
    mouseLeaveDelay: {
      type: 'number',
      default: 0.1,
      allowExpression: true,
      description: '鼠标移出后延时多少才隐藏',
    },
    destroyOnHidden: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '关闭时是否销毁',
    },
  },
  events: {
    onOpenChange: {
      description: '显示隐藏的回调',
      params: [{ name: 'open', type: 'boolean' }],
    },
  },
  slots: {},
  children: {
    type: 'node',
    description: '触发元素',
  },
};

// QRCode
export const qrCodeContract: ComponentContract = {
  componentType: 'QRCode',
  runtimeType: 'antd.QRCode',
  category: 'data-display',
  icon: 'QrCode',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    bgColor: {
      type: 'string',
      default: 'transparent',
      allowExpression: true,
      description: '背景色',
    },
    bordered: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否有边框',
    },
    color: {
      type: 'string',
      default: '#000',
      allowExpression: true,
      description: '二维码颜色',
    },
    errorLevel: {
      type: 'enum',
      enum: ['L', 'M', 'Q', 'H'],
      default: 'M',
      allowExpression: true,
      description: '纠错等级',
    },
    icon: {
      type: 'string',
      allowExpression: true,
      description: '二维码中图片的地址',
    },
    iconSize: {
      type: 'any',
      default: 40,
      allowExpression: true,
      description: '二维码中图片的大小',
    },
    size: {
      type: 'number',
      default: 160,
      allowExpression: true,
      description: '二维码大小',
    },
    status: {
      type: 'enum',
      enum: ['active', 'expired', 'loading'],
      default: 'active',
      allowExpression: true,
      description: '二维码状态',
    },
    value: {
      type: 'string',
      required: true,
      allowExpression: true,
      description: '扫描后的地址',
    },
  },
  events: {
    onRefresh: {
      description: '点击刷新按钮的回调',
      params: [],
    },
  },
  slots: {},
  children: {
    type: 'none',
  },
};

// Segmented
export const segmentedContract: ComponentContract = {
  componentType: 'Segmented',
  runtimeType: 'antd.Segmented',
  category: 'data-display',
  icon: 'RectangleEllipsis',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    block: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '占满父元素宽度',
    },
    defaultValue: {
      type: 'any',
      description: '默认选中的值',
    },
    disabled: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否禁用',
    },
    options: {
      type: 'array',
      allowExpression: true,
      description: '数据化配置选项内容',
    },
    size: {
      type: 'enum',
      enum: ['large', 'middle', 'small'],
      default: 'middle',
      allowExpression: true,
      description: '控件尺寸',
    },
    value: {
      type: 'any',
      allowExpression: true,
      description: '当前选中的值',
    },
    vertical: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否垂直显示',
    },
  },
  events: {
    onChange: {
      description: '选项变化时的回调函数',
      params: [{ name: 'value', type: 'any' }],
    },
  },
  slots: {},
  children: {
    type: 'none',
    description: '使用 options 配置',
  },
};

// Statistic
export const statisticContract: ComponentContract = {
  componentType: 'Statistic',
  runtimeType: 'antd.Statistic',
  category: 'data-display',
  icon: 'BarChart3',
  usageScenario: '展示KPI数值、汇总指标、数字看板（如会议数、完成率）',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    decimalSeparator: {
      type: 'string',
      default: '.',
      allowExpression: true,
      description: '设置小数点',
    },
    formatter: {
      type: 'function',
      description: '自定义数值展示',
    },
    groupSeparator: {
      type: 'string',
      default: ',',
      allowExpression: true,
      description: '设置千分位标识符',
    },
    loading: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '数值是否加载中',
    },
    precision: {
      type: 'number',
      allowExpression: true,
      description: '数值精度',
    },
    prefix: {
      type: 'SchemaNode',
      description: '设置数值的前缀',
    },
    suffix: {
      type: 'SchemaNode',
      description: '设置数值的后缀',
    },
    title: {
      type: 'SchemaNode',
      description: '数值的标题',
    },
    value: {
      type: 'any',
      allowExpression: true,
      description: '数值内容',
    },
    valueStyle: {
      type: 'object',
      allowExpression: true,
      description: '设置数值的样式',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'none',
  },
};

// Statistic.Countdown
export const statisticCountdownContract: ComponentContract = {
  componentType: 'Statistic.Countdown',
  runtimeType: 'antd.Statistic.Countdown',
  category: 'data-display',
  icon: 'Timer',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    format: {
      type: 'string',
      default: 'HH:mm:ss',
      allowExpression: true,
      description: '格式化倒计时展示',
    },
    prefix: {
      type: 'SchemaNode',
      description: '设置数值的前缀',
    },
    suffix: {
      type: 'SchemaNode',
      description: '设置数值的后缀',
    },
    title: {
      type: 'SchemaNode',
      description: '数值的标题',
    },
    value: {
      type: 'any',
      required: true,
      allowExpression: true,
      description: '数值内容',
    },
    valueStyle: {
      type: 'object',
      allowExpression: true,
      description: '设置数值的样式',
    },
  },
  events: {
    onFinish: {
      description: '倒计时完成时触发',
      params: [],
    },
    onChange: {
      description: '倒计时时间变化时触发',
      params: [{ name: 'value', type: 'any' }],
    },
  },
  slots: {},
  children: {
    type: 'none',
  },
};

// Tag
export const tagContract: ComponentContract = {
  componentType: 'Tag',
  runtimeType: 'antd.Tag',
  category: 'data-display',
  icon: 'Tag',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    bordered: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否有边框',
    },
    closable: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否可关闭',
    },
    color: {
      type: 'string',
      allowExpression: true,
      description: '标签色',
    },
    icon: {
      type: 'SchemaNode',
      description: '设置图标',
    },
  },
  events: {
    onClose: {
      description: '关闭时的回调',
      params: [{ name: 'e', type: 'MouseEvent' }],
    },
    onClick: {
      description: '点击标签时的回调',
      params: [{ name: 'e', type: 'MouseEvent' }],
    },
  },
  slots: {},
  children: {
    type: 'text',
    description: '标签内容',
  },
};

// Tag.CheckableTag
export const checkableTagContract: ComponentContract = {
  componentType: 'Tag.CheckableTag',
  runtimeType: 'antd.Tag.CheckableTag',
  category: 'data-display',
  icon: 'BadgeCheck',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    checked: {
      type: 'boolean',
      allowExpression: true,
      description: '设置标签的选中状态',
    },
  },
  events: {
    onChange: {
      description: '点击标签时的回调',
      params: [{ name: 'checked', type: 'boolean' }],
    },
  },
  slots: {},
  children: {
    type: 'text',
    description: '标签内容',
  },
};

// Timeline
export const timelineContract: ComponentContract = {
  componentType: 'Timeline',
  runtimeType: 'antd.Timeline',
  category: 'data-display',
  icon: 'GitCommitVertical',
  usageScenario: '展示时序动态、操作日志、历史记录、最新动态列表',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    items: {
      type: 'array',
      allowExpression: true,
      description: '通过 items 配置时间轴',
    },
    mode: {
      type: 'enum',
      enum: ['left', 'alternate', 'right'],
      default: 'left',
      allowExpression: true,
      description: '通过设置 mode 可以改变时间轴和内容的相对位置',
    },
    pending: {
      type: 'SchemaNode',
      description: '指定最后一个幽灵节点是否存在或内容',
    },
    pendingDot: {
      type: 'SchemaNode',
      description: '指定最后一个幽灵节点的图标',
    },
    reverse: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '节点倒序排列',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'nodes',
    description: 'Timeline.Item 子节点',
  },
};

// Timeline.Item
export const timelineItemContract: ComponentContract = {
  componentType: 'Timeline.Item',
  runtimeType: 'antd.Timeline.Item',
  category: 'data-display',
  icon: 'Circle',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    color: {
      type: 'string',
      default: 'blue',
      allowExpression: true,
      description: '指定圆圈颜色',
    },
    dot: {
      type: 'SchemaNode',
      description: '自定义时间轴点',
    },
    label: {
      type: 'SchemaNode',
      description: '设置标签',
    },
    position: {
      type: 'enum',
      enum: ['left', 'right'],
      allowExpression: true,
      description: '自定义节点位置',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'nodes',
    description: '时间轴内容',
  },
};

// Tooltip
export const tooltipContract: ComponentContract = {
  componentType: 'Tooltip',
  runtimeType: 'antd.Tooltip',
  category: 'data-display',
  icon: 'Info',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    arrow: {
      type: 'any',
      default: true,
      allowExpression: true,
      description: '修改箭头的显示状态',
    },
    color: {
      type: 'string',
      allowExpression: true,
      description: '背景色',
    },
    defaultOpen: {
      type: 'boolean',
      default: false,
      description: '默认是否显隐',
    },
    open: {
      type: 'boolean',
      allowExpression: true,
      description: '用于手动控制浮层显隐',
    },
    overlayClassName: {
      type: 'string',
      allowExpression: true,
      description: '卡片类名',
    },
    overlayStyle: {
      type: 'object',
      allowExpression: true,
      description: '卡片样式',
    },
    overlayInnerStyle: {
      type: 'object',
      allowExpression: true,
      description: '卡片内容样式',
    },
    placement: {
      type: 'enum',
      enum: ['top', 'left', 'right', 'bottom', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight', 'leftTop', 'leftBottom', 'rightTop', 'rightBottom'],
      default: 'top',
      allowExpression: true,
      description: '气泡卡片位置',
    },
    title: {
      type: 'SchemaNode',
      description: '提示文字',
    },
    trigger: {
      type: 'enum',
      enum: ['hover', 'focus', 'click', 'contextMenu'],
      default: 'hover',
      allowExpression: true,
      description: '触发行为',
    },
    mouseEnterDelay: {
      type: 'number',
      default: 0.1,
      allowExpression: true,
      description: '鼠标移入后延时多少才显示',
    },
    mouseLeaveDelay: {
      type: 'number',
      default: 0.1,
      allowExpression: true,
      description: '鼠标移出后延时多少才隐藏',
    },
    destroyOnHidden: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '关闭时是否销毁',
    },
  },
  events: {
    onOpenChange: {
      description: '显示隐藏的回调',
      params: [{ name: 'open', type: 'boolean' }],
    },
  },
  slots: {},
  children: {
    type: 'node',
    description: '触发元素',
  },
};

// Tour
export const tourContract: ComponentContract = {
  componentType: 'Tour',
  runtimeType: 'antd.Tour',
  category: 'data-display',
  icon: 'MapPin',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    arrow: {
      type: 'any',
      default: true,
      allowExpression: true,
      description: '是否显示箭头',
    },
    current: {
      type: 'number',
      default: 0,
      allowExpression: true,
      description: '当前处于第几步',
    },
    defaultCurrent: {
      type: 'number',
      default: 0,
      description: '默认处于第几步',
    },
    indicatorsRender: {
      type: 'function',
      description: '自定义指示器',
    },
    open: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否开启',
    },
    steps: {
      type: 'array',
      required: true,
      allowExpression: true,
      description: '引导步骤',
    },
    type: {
      type: 'enum',
      enum: ['default', 'primary'],
      default: 'default',
      allowExpression: true,
      description: '引导类型',
    },
    zIndex: {
      type: 'number',
      allowExpression: true,
      description: 'Tour 的层级',
    },
  },
  events: {
    onChange: {
      description: '步骤改变时的回调',
      params: [{ name: 'current', type: 'number' }],
    },
    onClose: {
      description: '关闭 Tour 时的回调',
      params: [{ name: 'current', type: 'number' }],
    },
    onFinish: {
      description: '完成 Tour 时的回调',
      params: [],
    },
  },
  slots: {},
  children: {
    type: 'none',
  },
};
