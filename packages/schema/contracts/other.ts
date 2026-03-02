import {
  COMPONENT_CONTRACT_V1_VERSION,
  type ComponentContract,
} from '../types/contract';

// Affix
export const affixContract: ComponentContract = {
  componentType: 'Affix',
  runtimeType: 'antd.Affix',
  category: 'other',
  icon: 'Pin',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    offsetBottom: {
      type: 'number',
      allowExpression: true,
      description: '距离窗口底部达到指定偏移量后触发',
    },
    offsetTop: {
      type: 'number',
      default: 0,
      allowExpression: true,
      description: '距离窗口顶部达到指定偏移量后触发',
    },
    target: {
      type: 'function',
      description: '设置 Affix 需要监听其滚动事件的元素',
    },
    onChange: {
      type: 'function',
      deprecated: true,
      deprecatedMessage: '请使用 onVisibleChange',
      description: '固定状态改变时触发的回调函数（已废弃）',
    },
  },
  events: {
    onVisibleChange: {
      description: '固定状态改变时触发的回调函数',
      params: [{ name: 'visible', type: 'boolean' }],
    },
  },
  slots: {},
  children: {
    type: 'node',
    description: '固定内容',
  },
};

// App
export const appContract: ComponentContract = {
  componentType: 'App',
  runtimeType: 'antd.App',
  category: 'other',
  icon: 'AppWindow',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    component: {
      type: 'any',
      default: false,
      description: '配置 ConfigProvider 的 component 属性',
    },
    direction: {
      type: 'enum',
      enum: ['ltr', 'rtl'],
      default: 'ltr',
      allowExpression: true,
      description: '设置组件的布局方向',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'nodes',
    description: '应用内容',
  },
};

// ConfigProvider
export const configProviderContract: ComponentContract = {
  componentType: 'ConfigProvider',
  runtimeType: 'antd.ConfigProvider',
  category: 'other',
  icon: 'Settings',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    autoInsertSpaceInButton: {
      type: 'boolean',
      allowExpression: true,
      description: '设置 Button 的子元素在两个汉字之间是否添加空格',
    },
    componentDisabled: {
      type: 'boolean',
      allowExpression: true,
      description: '设置所有子组件的 disabled',
    },
    componentSize: {
      type: 'enum',
      enum: ['small', 'middle', 'large'],
      allowExpression: true,
      description: '设置所有子组件的大小',
    },
    csp: {
      type: 'object',
      allowExpression: true,
      description: '设置 Content Security Policy 配置',
    },
    direction: {
      type: 'enum',
      enum: ['ltr', 'rtl'],
      default: 'ltr',
      allowExpression: true,
      description: '设置组件的布局方向',
    },
    getPopupContainer: {
      type: 'function',
      description: '指定弹出框的父级容器',
    },
    getTargetContainer: {
      type: 'function',
      description: '设置 Affix 的目标容器',
    },
    locale: {
      type: 'object',
      allowExpression: true,
      description: '语言包配置',
    },
    popupMatchSelectWidth: {
      type: 'any',
      default: true,
      allowExpression: true,
      description: '下拉菜单和选择器同宽',
    },
    popupOverflow: {
      type: 'enum',
      enum: ['viewport', 'scroll'],
      default: 'viewport',
      allowExpression: true,
      description: 'Select 类组件弹层展示逻辑',
    },
    prefixCls: {
      type: 'string',
      default: 'ant',
      allowExpression: true,
      description: '设置统一样式前缀',
    },
    renderEmpty: {
      type: 'function',
      description: '自定义组件空状态',
    },
    theme: {
      type: 'object',
      allowExpression: true,
      description: '设置主题',
    },
    virtual: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '设置虚拟滚动',
    },
    warning: {
      type: 'object',
      allowExpression: true,
      description: '设置警告等级',
    },
    form: {
      type: 'object',
      allowExpression: true,
      description: '设置 Form 的配置',
    },
    input: {
      type: 'object',
      allowExpression: true,
      description: '设置 Input 的配置',
    },
    pagination: {
      type: 'object',
      allowExpression: true,
      description: '设置 Pagination 的配置',
    },
    space: {
      type: 'object',
      allowExpression: true,
      description: '设置 Space 的配置',
    },
    table: {
      type: 'object',
      allowExpression: true,
      description: '设置 Table 的配置',
    },
    select: {
      type: 'object',
      allowExpression: true,
      description: '设置 Select 的配置',
    },
    button: {
      type: 'object',
      allowExpression: true,
      description: '设置 Button 的配置',
    },
    wave: {
      type: 'object',
      allowExpression: true,
      description: '设置水波纹效果配置',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'nodes',
    description: '应用内容',
  },
};

// BackTop (已集成到 FloatButton.BackTop，这里单独提供)
export const backTopContract: ComponentContract = {
  componentType: 'BackTop',
  runtimeType: 'antd.BackTop',
  category: 'other',
  icon: 'ArrowUp',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    duration: {
      type: 'number',
      default: 450,
      allowExpression: true,
      description: '回到顶部所需时间（ms）',
    },
    target: {
      type: 'function',
      description: '设置需要监听滚动事件的元素',
    },
    visibilityHeight: {
      type: 'number',
      default: 400,
      allowExpression: true,
      description: '滚动高度达到此参数值才出现',
    },
  },
  events: {
    onClick: {
      description: '点击按钮的回调函数',
      params: [],
    },
  },
  slots: {},
  children: {
    type: 'node',
    description: '自定义内容',
  },
};

// ConfigProvider.config (静态方法)
// 跳过：ConfigProvider.config 是全局静态配置方法

// App.useApp (Hook 返回静态方法)
// 跳过：useApp 是 Hook，不作为组件契约
