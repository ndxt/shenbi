import {
  COMPONENT_CONTRACT_V1_VERSION,
  type ComponentContract,
} from '../types/contract';

// Tabs 组件
export const tabsContract: ComponentContract = {
  componentType: 'Tabs',
  runtimeType: 'antd.Tabs',
  category: 'navigation',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    activeKey: {
      type: 'string',
      allowExpression: true,
      description: '当前激活 tab 面板的 key',
    },
    defaultActiveKey: {
      type: 'string',
      description: '初始化选中面板的 key',
    },
    type: {
      type: 'enum',
      enum: ['line', 'card', 'editable-card'],
      default: 'line',
      allowExpression: true,
      description: '页签的基本样式',
    },
    size: {
      type: 'enum',
      enum: ['large', 'middle', 'small'],
      default: 'middle',
      allowExpression: true,
      description: '大小',
    },
    tabPlacement: {
      type: 'enum',
      enum: ['top', 'end', 'bottom', 'start'],
      default: 'top',
      allowExpression: true,
      description: '页签位置',
    },
    tabPosition: {
      type: 'enum',
      enum: ['top', 'right', 'bottom', 'left'],
      default: 'top',
      allowExpression: true,
      deprecated: true,
      deprecatedMessage: '请使用 tabPlacement 替换',
      description: '页签位置（已废弃）',
    },
    centered: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '标签居中显示',
    },
    animated: {
      type: 'any',
      default: { inkBar: true, tabPane: false },
      allowExpression: true,
      description: '是否启用动画',
    },
    items: {
      type: 'array',
      allowExpression: true,
      description: '配置选项卡内容',
    },
    tabBarGutter: {
      type: 'number',
      allowExpression: true,
      description: 'Tab 之间的间隙',
    },
    tabBarStyle: {
      type: 'object',
      description: 'TabBar 的样式对象',
    },
    tabBarExtraContent: {
      type: 'SchemaNode',
      description: 'TabBar 上额外渲染的元素',
    },
    hideAdd: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否隐藏加号图标',
    },
    addIcon: {
      type: 'SchemaNode',
      description: '自定义添加按钮',
    },
    removeIcon: {
      type: 'SchemaNode',
      description: '自定义删除图标',
    },
    destroyOnHidden: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '隐藏时销毁 DOM',
    },
    destroyInactiveTabPane: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      deprecated: true,
      deprecatedMessage: '请使用 destroyOnHidden 替换',
      description: '隐藏时销毁 DOM（已废弃）',
    },
    renderTabBar: {
      type: 'function',
      description: '替换 TabBar',
    },
    indicator: {
      type: 'object',
      allowExpression: true,
      description: '自定义指示器的大小和位置',
    },
    more: {
      type: 'object',
      allowExpression: true,
      description: '自定义折叠下拉菜单',
    },
  },
  events: {
    onChange: {
      description: '切换面板的回调',
      params: [{ name: 'activeKey', type: 'string' }],
    },
    onEdit: {
      description: '新增/删除页签的回调',
      params: [
        { name: 'targetKey', type: 'string | MouseEvent' },
        { name: 'action', type: "'add' | 'remove'" },
      ],
    },
    onTabClick: {
      description: 'tab 被点击的回调',
      params: [
        { name: 'key', type: 'string' },
        { name: 'event', type: 'MouseEvent' },
      ],
    },
    onTabScroll: {
      description: 'tab 滚动时回调',
      params: [{ name: 'info', type: "{ direction: 'left' | 'right' | 'top' | 'bottom' }" }],
    },
  },
  slots: {},
  children: {
    type: 'none',
    description: '使用 items 属性配置',
  },
};

// Tabs.TabPane（使用 items 配置时的 TabItemType）
export const tabPaneContract: ComponentContract = {
  componentType: 'Tabs.TabPane',
  runtimeType: 'antd.Tabs.TabPane',
  category: 'navigation',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    key: {
      type: 'string',
      description: '对应 activeKey',
    },
    label: {
      type: 'SchemaNode',
      description: '选项卡头显示文字',
    },
    icon: {
      type: 'SchemaNode',
      description: '选项卡头显示图标',
    },
    disabled: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '禁用此选项卡',
    },
    closable: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否显示关闭按钮',
    },
    closeIcon: {
      type: 'SchemaNode',
      description: '自定义关闭图标',
    },
    forceRender: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '被隐藏时是否渲染 DOM 结构',
    },
    destroyOnHidden: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '隐藏时销毁 DOM',
    },
  },
  events: {},
  slots: {},
  children: {
    type: 'nodes',
    description: '选项卡内容',
  },
};
