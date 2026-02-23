import {
  COMPONENT_CONTRACT_V1_VERSION,
  type ComponentContract,
} from '../types/contract';

// Transfer
export const transferContract: ComponentContract = {
  componentType: 'Transfer',
  runtimeType: 'antd.Transfer',
  category: 'data-entry',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    dataSource: {
      type: 'array',
      allowExpression: true,
      description: '数据源',
    },
    disabled: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否禁用',
    },
    filterOption: {
      type: 'function',
      description: '根据搜索内容筛选数据项',
    },
    listStyle: {
      type: 'any',
      allowExpression: true,
      description: '两个穿梭框的自定义样式',
    },
    locale: {
      type: 'object',
      allowExpression: true,
      description: '各种语言',
    },
    oneWay: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '单向样式',
    },
    operations: {
      type: 'array',
      default: ['>', '<'],
      allowExpression: true,
      description: '操作集合',
    },
    operationStyle: {
      type: 'object',
      allowExpression: true,
      description: '操作栏的自定义样式',
    },
    pagination: {
      type: 'any',
      allowExpression: true,
      description: '分页配置',
    },
    render: {
      type: 'function',
      description: '每行数据渲染函数',
    },
    selectedKeys: {
      type: 'array',
      allowExpression: true,
      description: '设置哪些项应该被选中',
    },
    showSearch: {
      type: 'any',
      default: false,
      allowExpression: true,
      description: '是否显示搜索框',
    },
    showSelectAll: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否展示全选勾选框',
    },
    status: {
      type: 'enum',
      enum: ['error', 'warning'],
      allowExpression: true,
      description: '校验状态',
    },
    targetKeys: {
      type: 'array',
      allowExpression: true,
      description: '显示在右侧框数据的 key 集合',
    },
    titles: {
      type: 'array',
      allowExpression: true,
      description: '标题集合',
    },
  },
  events: {
    onChange: {
      description: '选项在两栏之间转移时的回调函数',
      params: [
        { name: 'targetKeys', type: 'any[]' },
        { name: 'direction', type: 'string' },
        { name: 'moveKeys', type: 'any[]' },
      ],
    },
    onScroll: {
      description: '选项列表滚动时的回调函数',
      params: [
        { name: 'direction', type: 'string' },
        { name: 'event', type: 'Event' },
      ],
    },
    onSearch: {
      description: '搜索框内容时改变时的回调函数',
      params: [
        { name: 'direction', type: 'string' },
        { name: 'value', type: 'string' },
      ],
    },
    onSelectChange: {
      description: '选中项发生改变时的回调函数',
      params: [
        { name: 'sourceSelectedKeys', type: 'any[]' },
        { name: 'targetSelectedKeys', type: 'any[]' },
      ],
    },
  },
  slots: {},
  children: {
    type: 'none',
  },
};

// TreeSelect
export const treeSelectContract: ComponentContract = {
  componentType: 'TreeSelect',
  runtimeType: 'antd.TreeSelect',
  category: 'data-entry',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    allowClear: {
      type: 'any',
      default: false,
      allowExpression: true,
      description: '是否显示清除按钮',
    },
    autoClearSearchValue: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否在选中项后清空搜索框',
    },
    defaultValue: {
      type: 'any',
      description: '默认值',
    },
    disabled: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否禁用',
    },
    dropdownMatchSelectWidth: {
      type: 'any',
      default: true,
      allowExpression: true,
      description: '下拉菜单和选择器同宽',
    },
    dropdownRender: {
      type: 'function',
      description: '自定义下拉框内容',
    },
    fieldNames: {
      type: 'object',
      allowExpression: true,
      description: '自定义字段名',
    },
    filterTreeNode: {
      type: 'function',
      description: '筛选节点的方法',
    },
    labelInValue: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否把每个选项的 label 包装到 value 中',
    },
    loadData: {
      type: 'function',
      description: '异步加载数据',
    },
    maxTagCount: {
      type: 'any',
      allowExpression: true,
      description: '最多显示多少个 tag',
    },
    multiple: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否支持多选',
    },
    open: {
      type: 'boolean',
      allowExpression: true,
      description: '是否展开下拉菜单',
    },
    placeholder: {
      type: 'string',
      allowExpression: true,
      description: '输入框占位文本',
    },
    searchValue: {
      type: 'string',
      allowExpression: true,
      description: '搜索框的值',
    },
    showCheckedStrategy: {
      type: 'enum',
      enum: ['SHOW_ALL', 'SHOW_PARENT', 'SHOW_CHILD'],
      allowExpression: true,
      description: '回显策略',
    },
    showSearch: {
      type: 'any',
      default: false,
      allowExpression: true,
      description: '是否支持搜索',
    },
    size: {
      type: 'enum',
      enum: ['large', 'middle', 'small'],
      allowExpression: true,
      description: '选择器大小',
    },
    status: {
      type: 'enum',
      enum: ['error', 'warning'],
      allowExpression: true,
      description: '校验状态',
    },
    treeCheckable: {
      type: 'any',
      allowExpression: true,
      description: '是否显示 checkbox',
    },
    treeData: {
      type: 'array',
      allowExpression: true,
      description: 'treeNodes 数据',
    },
    treeDefaultExpandAll: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '默认展开所有树节点',
    },
    treeDefaultExpandedKeys: {
      type: 'array',
      allowExpression: true,
      description: '默认展开的树节点',
    },
    treeExpandedKeys: {
      type: 'array',
      allowExpression: true,
      description: '展开的树节点',
    },
    value: {
      type: 'any',
      allowExpression: true,
      description: '当前选中的值',
    },
  },
  events: {
    onChange: {
      description: '选中树节点时调用此函数',
      params: [
        { name: 'value', type: 'any' },
        { name: 'label', type: 'any' },
        { name: 'extra', type: 'object' },
      ],
    },
    onSearch: {
      description: '搜索时调用此函数',
      params: [{ name: 'value', type: 'string' }],
    },
    onSelect: {
      description: '选中树节点时调用此函数',
      params: [
        { name: 'value', type: 'any' },
        { name: 'node', type: 'object' },
        { name: 'extra', type: 'object' },
      ],
    },
    onTreeExpand: {
      description: '展开节点时调用此函数',
      params: [{ name: 'expandedKeys', type: 'any[]' }],
    },
    onDropdownVisibleChange: {
      description: '展开下拉菜单的回调',
      params: [{ name: 'visible', type: 'boolean' }],
    },
  },
  slots: {},
  children: {
    type: 'none',
  },
};

// Upload
export const uploadContract: ComponentContract = {
  componentType: 'Upload',
  runtimeType: 'antd.Upload',
  category: 'data-entry',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    accept: {
      type: 'string',
      allowExpression: true,
      description: '接受上传的文件类型',
    },
    action: {
      type: 'string',
      allowExpression: true,
      description: '上传的地址',
    },
    beforeUpload: {
      type: 'function',
      description: '上传文件之前的钩子',
    },
    data: {
      type: 'any',
      allowExpression: true,
      description: '上传所需额外参数或返回上传额外参数的方法',
    },
    defaultFileList: {
      type: 'array',
      description: '默认已经上传的文件列表',
    },
    directory: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '支持上传文件夹',
    },
    disabled: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否禁用',
    },
    fileList: {
      type: 'array',
      allowExpression: true,
      description: '已经上传的文件列表',
    },
    headers: {
      type: 'object',
      allowExpression: true,
      description: '设置上传的请求头部',
    },
    listType: {
      type: 'enum',
      enum: ['text', 'picture', 'picture-card'],
      default: 'text',
      allowExpression: true,
      description: '上传列表的内建样式',
    },
    maxCount: {
      type: 'number',
      allowExpression: true,
      description: '限制上传数量',
    },
    method: {
      type: 'enum',
      enum: ['POST', 'PUT', 'GET'],
      default: 'POST',
      allowExpression: true,
      description: '上传请求的 http method',
    },
    multiple: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否支持多选文件',
    },
    name: {
      type: 'string',
      default: 'file',
      allowExpression: true,
      description: '发到后台的文件参数名',
    },
    openFileDialogOnClick: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '点击打开文件对话框',
    },
    progress: {
      type: 'object',
      allowExpression: true,
      description: '进度条相关配置',
    },
    showUploadList: {
      type: 'any',
      default: true,
      allowExpression: true,
      description: '是否展示文件列表',
    },
    withCredentials: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '上传请求时是否携带 cookie',
    },
  },
  events: {
    onChange: {
      description: '上传文件改变时的状态',
      params: [{ name: 'info', type: 'UploadChangeParam' }],
    },
    onPreview: {
      description: '点击文件链接或预览图标时的回调',
      params: [{ name: 'file', type: 'UploadFile' }],
    },
    onRemove: {
      description: '点击移除文件时的回调',
      params: [{ name: 'file', type: 'UploadFile' }],
    },
    onDrop: {
      description: '拖拽文件时的回调',
      params: [{ name: 'event', type: 'DragEvent' }],
    },
  },
  slots: {},
  children: {
    type: 'node',
    description: '上传按钮',
  },
};

// Upload.Dragger
export const uploadDraggerContract: ComponentContract = {
  componentType: 'Upload.Dragger',
  runtimeType: 'antd.Upload.Dragger',
  category: 'data-entry',
  version: COMPONENT_CONTRACT_V1_VERSION,
  props: {
    accept: {
      type: 'string',
      allowExpression: true,
      description: '接受上传的文件类型',
    },
    action: {
      type: 'string',
      allowExpression: true,
      description: '上传的地址',
    },
    beforeUpload: {
      type: 'function',
      description: '上传文件之前的钩子',
    },
    data: {
      type: 'any',
      allowExpression: true,
      description: '上传所需额外参数',
    },
    defaultFileList: {
      type: 'array',
      description: '默认已经上传的文件列表',
    },
    disabled: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否禁用',
    },
    fileList: {
      type: 'array',
      allowExpression: true,
      description: '已经上传的文件列表',
    },
    headers: {
      type: 'object',
      allowExpression: true,
      description: '设置上传的请求头部',
    },
    listType: {
      type: 'enum',
      enum: ['text', 'picture', 'picture-card'],
      default: 'text',
      allowExpression: true,
      description: '上传列表的内建样式',
    },
    maxCount: {
      type: 'number',
      allowExpression: true,
      description: '限制上传数量',
    },
    multiple: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '是否支持多选文件',
    },
    name: {
      type: 'string',
      default: 'file',
      allowExpression: true,
      description: '发到后台的文件参数名',
    },
    progress: {
      type: 'object',
      allowExpression: true,
      description: '进度条相关配置',
    },
    showUploadList: {
      type: 'any',
      default: true,
      allowExpression: true,
      description: '是否展示文件列表',
    },
    withCredentials: {
      type: 'boolean',
      default: false,
      allowExpression: true,
      description: '上传请求时是否携带 cookie',
    },
  },
  events: {
    onChange: {
      description: '上传文件改变时的状态',
      params: [{ name: 'info', type: 'UploadChangeParam' }],
    },
    onPreview: {
      description: '点击文件链接或预览图标时的回调',
      params: [{ name: 'file', type: 'UploadFile' }],
    },
    onRemove: {
      description: '点击移除文件时的回调',
      params: [{ name: 'file', type: 'UploadFile' }],
    },
    onDrop: {
      description: '拖拽文件时的回调',
      params: [{ name: 'event', type: 'DragEvent' }],
    },
  },
  slots: {},
  children: {
    type: 'nodes',
    description: '拖拽区域内容',
  },
};
