import {
  COMPONENT_CONTRACT_V1_VERSION,
  type ComponentContract,
} from '../types/contract';

// Avatar
export const avatarContract: ComponentContract = {
  componentType: 'Avatar',
  runtimeType: 'antd.Avatar',
  category: 'data-display',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    alt: {
      type: 'string',
      allowExpression: true,
      description: '图片无法显示时的替代文本',
    },
    gap: {
      type: 'number',
      default: 4,
      allowExpression: true,
      description: '字符类型距离左右两侧边界单位像素',
    },
    icon: {
      type: 'SchemaNode',
      description: '设置头像图标',
    },
    shape: {
      type: 'enum',
      enum: ['circle', 'square'],
      default: 'circle',
      allowExpression: true,
      description: '头像形状',
    },
    size: {
      type: 'any',
      default: 'default',
      allowExpression: true,
      description: '头像大小',
    },
    src: {
      type: 'string',
      allowExpression: true,
      description: '图片类头像资源地址',
    },
    srcSet: {
      type: 'string',
      allowExpression: true,
      description: '图片响应式资源地址',
    },
    draggable: {
      type: 'any',
      allowExpression: true,
      description: '图片是否允许拖动',
    },
    crossOrigin: {
      type: 'enum',
      enum: ['anonymous', 'use-credentials', ''],
      allowExpression: true,
      description: 'CORS 属性',
    },
  },
  events: {
    onError: {
      description: '图片加载失败事件',
      params: [],
    },
  },
  slots: {},
  children: {
    type: 'text',
    description: '文字头像内容',
  },
};

// Avatar.Group
export const avatarGroupContract: ComponentContract = {
  componentType: 'Avatar.Group',
  runtimeType: 'antd.Avatar.Group',
  category: 'data-display',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    maxCount: {
      type: 'number',
      allowExpression: true,
      description: '显示的最大头像个数',
    },
    maxPopoverPlacement: {
      type: 'enum',
      enum: ['top', 'bottom'],
      default: 'top',
      allowExpression: true,
      description: '多余头像气泡弹出位置',
    },
    maxPopoverTrigger: {
      type: 'enum',
      enum: ['hover', 'focus', 'click'],
      default: 'hover',
      allowExpression: true,
      description: '多余头像气泡弹出触发方式',
    },
    maxStyle: {
      type: 'object',
      allowExpression: true,
      description: '多余头像样式',
    },
    size: {
      type: 'any',
      default: 'default',
      allowExpression: true,
      description: '头像大小',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'nodes',
    description: 'Avatar 列表',
  },
};

// Badge
export const badgeContract: ComponentContract = {
  componentType: 'Badge',
  runtimeType: 'antd.Badge',
  category: 'data-display',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    color: {
      type: 'string',
      allowExpression: true,
      description: '自定义小圆点的颜色',
    },
    count: {
      type: 'any',
      allowExpression: true,
      description: '展示的数字',
    },
    dot: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '不展示数字，只有一个小红点',
    },
    offset: {
      type: 'array',
      allowExpression: true,
      description: '设置状态点的位置偏移',
    },
    overflowCount: {
      type: 'number',
      default: 99,
      allowExpression: true,
      description: '展示封顶的数字值',
    },
    showZero: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '当数值为 0 时，是否展示 Badge',
    },
    size: {
      type: 'enum',
      enum: ['default', 'small'],
      default: 'default',
      allowExpression: true,
      description: '在设置了 count 时有效，设置小圆点的大小',
    },
    status: {
      type: 'enum',
      enum: ['success', 'processing', 'default', 'error', 'warning'],
      allowExpression: true,
      description: '设置 Badge 为状态点',
    },
    text: {
      type: 'SchemaNode',
      description: '在设置了 status 时有效，设置状态点的文本',
    },
    title: {
      type: 'string',
      allowExpression: true,
      description: '设置鼠标放在状态点上时显示的文字',
    },
    styles: {
      type: 'object',
      allowExpression: true,
      description: '设置样式',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'node',
    description: '包裹元素',
  },
};

// Badge.Ribbon
export const badgeRibbonContract: ComponentContract = {
  componentType: 'Badge.Ribbon',
  runtimeType: 'antd.Badge.Ribbon',
  category: 'data-display',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    color: {
      type: 'string',
      allowExpression: true,
      description: '自定义缎带的颜色',
    },
    placement: {
      type: 'enum',
      enum: ['start', 'end'],
      default: 'end',
      allowExpression: true,
      description: '缎带的位置',
    },
    text: {
      type: 'SchemaNode',
      description: '缎带中填入的内容',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'node',
    description: '包裹元素',
  },
};

// Calendar
export const calendarContract: ComponentContract = {
  componentType: 'Calendar',
  runtimeType: 'antd.Calendar',
  category: 'data-display',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    cellRender: {
      type: 'function',
      description: '自定义单元格渲染',
    },
    dateFullCellRender: {
      type: 'function',
      deprecated: true,
      deprecatedMessage: '请使用 cellRender',
      description: '自定义单元格渲染（已废弃）',
    },
    defaultValue: {
      type: 'any',
      description: '默认展示的日期',
    },
    disabledDate: {
      type: 'function',
      description: '不可选择的日期',
    },
    fullscreen: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否全屏显示',
    },
    headerRender: {
      type: 'function',
      description: '自定义头部内容',
    },
    mode: {
      type: 'enum',
      enum: ['month', 'year'],
      default: 'month',
      allowExpression: true,
      description: '初始模式',
    },
    validRange: {
      type: 'array',
      allowExpression: true,
      description: '设置可以切换的日期范围',
    },
    value: {
      type: 'any',
      allowExpression: true,
      description: '展示日期',
    },
  },
  events: {
    onSelect: {
      description: '点击选择日期回调',
      params: [{ name: 'date', type: 'any' }],
    },
    onPanelChange: {
      description: '日期面板变化回调',
      params: [
        { name: 'date', type: 'any' },
        { name: 'mode', type: 'string' },
      ],
    },
  },
  slots: {},
  children: {
    type: 'none',
  },
};

// Carousel
export const carouselContract: ComponentContract = {
  componentType: 'Carousel',
  runtimeType: 'antd.Carousel',
  category: 'data-display',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    autoplay: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否自动切换',
    },
    autoplaySpeed: {
      type: 'number',
      default: 3000,
      allowExpression: true,
      description: '自动切换的间隔',
    },
    dots: {
      type: 'any',
      default: true,
      allowExpression: true,
      description: '是否显示面板指示点',
    },
    dotPosition: {
      type: 'enum',
      enum: ['top', 'bottom', 'left', 'right'],
      default: 'bottom',
      allowExpression: true,
      description: '面板指示点位置',
    },
    effect: {
      type: 'enum',
      enum: ['scrollx', 'fade'],
      default: 'scrollx',
      allowExpression: true,
      description: '动画效果函数',
    },
    easing: {
      type: 'string',
      default: 'linear',
      allowExpression: true,
      description: '动画效果',
    },
    infinite: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否开启无限循环',
    },
    waitForAnimate: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否等待动画完成',
    },
  },
  events: {
    afterChange: {
      description: '切换面板的回调',
      params: [{ name: 'current', type: 'number' }],
    },
    beforeChange: {
      description: '切换面板的回调',
      params: [
        { name: 'from', type: 'number' },
        { name: 'to', type: 'number' },
      ],
    },
  },
  slots: {},
  children: {
    type: 'nodes',
    description: '轮播内容',
  },
};

// Collapse
export const collapseContract: ComponentContract = {
  componentType: 'Collapse',
  runtimeType: 'antd.Collapse',
  category: 'data-display',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    accordion: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '手风琴模式',
    },
    activeKey: {
      type: 'any',
      allowExpression: true,
      description: '当前激活 tab 面板的 key',
    },
    bordered: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '带边框风格的折面板',
    },
    collapsible: {
      type: 'enum',
      enum: ['header', 'icon', 'disabled'],
      allowExpression: true,
      description: '所有子面板可折叠区域',
    },
    defaultActiveKey: {
      type: 'any',
      description: '默认激活 tab 面板的 key',
    },
    destroyInactivePanel: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '销毁折叠隐藏的面板',
    },
    expandIconPosition: {
      type: 'enum',
      enum: ['start', 'end'],
      default: 'start',
      allowExpression: true,
      description: '设置折叠图标位置',
    },
    ghost: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '幽灵模式',
    },
    size: {
      type: 'enum',
      enum: ['large', 'middle', 'small'],
      default: 'middle',
      allowExpression: true,
      description: '折叠面板大小',
    },
  },
  events: {
    onChange: {
      description: '切换面板的回调',
      params: [{ name: 'activeKey', type: 'any' }],
    },
  },
  slots: {},
  children: {
    type: 'nodes',
    description: 'Collapse.Panel 列表',
  },
};

// Collapse.Panel
export const collapsePanelContract: ComponentContract = {
  componentType: 'Collapse.Panel',
  runtimeType: 'antd.Collapse.Panel',
  category: 'data-display',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    collapsible: {
      type: 'enum',
      enum: ['header', 'icon', 'disabled'],
      allowExpression: true,
      description: '可折叠区域',
    },
    extra: {
      type: 'SchemaNode',
      description: '自定义渲染每个面板右上角的内容',
    },
    forceRender: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '强制渲染面板内容',
    },
    header: {
      type: 'SchemaNode',
      description: '面板头内容',
    },
    key: {
      type: 'string',
      required: true,
      description: '对应 activeKey',
    },
    showArrow: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否展示当前面板上的箭头',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'nodes',
    description: '面板内容',
  },
};

// Empty
export const emptyContract: ComponentContract = {
  componentType: 'Empty',
  runtimeType: 'antd.Empty',
  category: 'data-display',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    description: {
      type: 'SchemaNode',
      description: '自定义描述内容',
    },
    image: {
      type: 'any',
      default: 'Empty.PRESENTED_IMAGE_DEFAULT',
      allowExpression: true,
      description: '图片地址',
    },
    imageStyle: {
      type: 'object',
      allowExpression: true,
      description: '图片样式',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'node',
    description: '自定义额外内容',
  },
};
