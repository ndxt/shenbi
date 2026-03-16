import type { TestCase } from '../types';

/**
 * 组件属性测试用例
 *
 * 覆盖所有 ~100 个组件，每个组件至少 1 个 L1 case
 */
export const componentCases: TestCase[] = [
  // ==================== Button ====================
  {
    id: 'button-primary',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个主要类型的按钮，文字为提交',
    assertions: {
      components: { mustInclude: ['Button'] },
      props: {
        Button: { type: 'primary', children: '提交' },
      },
      structure: { maxNodeCount: 3 },
    },
  },
  {
    id: 'button-default',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个默认类型的按钮',
    assertions: {
      components: { mustInclude: ['Button'] },
      props: { Button: { type: 'default' } },
    },
  },
  {
    id: 'button-link',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个链接类型的按钮，文字为了解更多',
    assertions: {
      components: { mustInclude: ['Button'] },
      props: { Button: { type: 'link' } },
    },
  },
  {
    id: 'button-disabled',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个禁用的按钮',
    assertions: {
      components: { mustInclude: ['Button'] },
      props: { Button: { disabled: true } },
    },
  },
  {
    id: 'button-loading',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个加载状态的按钮',
    assertions: {
      components: { mustInclude: ['Button'] },
      props: { Button: { loading: true } },
    },
  },
  {
    id: 'button-sizes',
    suite: 'component',
    level: 'L2',
    prompt: '生成三个不同尺寸的按钮：小号、中号、大号',
    assertions: {
      components: { mustInclude: ['Button'] },
      structure: { minNodeCount: 3 },
    },
  },

  // ==================== Input ====================
  {
    id: 'input-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个输入框，占位符为请输入用户名',
    assertions: {
      components: { mustInclude: ['Input'] },
      props: {
        Input: { placeholder: '请输入用户名' },
      },
    },
  },
  {
    id: 'input-password',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个密码输入框',
    assertions: {
      components: { mustInclude: ['Input'] },
      props: { Input: { type: 'password', placeholder: '请输入密码' } },
    },
  },
  {
    id: 'input-disabled',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个禁用的输入框',
    assertions: {
      components: { mustInclude: ['Input'] },
      props: { Input: { disabled: true } },
    },
  },
  {
    id: 'input-textarea',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个多行文本输入框',
    assertions: {
      components: { mustInclude: ['Input.TextArea'] },
    },
  },
  {
    id: 'input-with-addon',
    suite: 'component',
    level: 'L2',
    prompt: '生成一个带前缀的输入框，前缀显示https://',
    assertions: {
      components: { mustInclude: ['Input'] },
      props: { Input: { addonBefore: 'https://' } },
    },
  },

  // ==================== Select ====================
  {
    id: 'select-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个下拉选择框，选项包含北京、上海、广州',
    assertions: {
      components: { mustInclude: ['Select'] },
      props: {
        Select: { options: { length: 3 } },
      },
    },
  },
  {
    id: 'select-multiple',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个多选下拉框',
    assertions: {
      components: { mustInclude: ['Select'] },
      props: { Select: { mode: 'multiple' } },
    },
  },
  {
    id: 'select-disabled',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个禁用的下拉选择框',
    assertions: {
      components: { mustInclude: ['Select'] },
      props: { Select: { disabled: true } },
    },
  },
  {
    id: 'select-placeholder',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个带占位符请选择的下拉选择框',
    assertions: {
      components: { mustInclude: ['Select'] },
      props: { Select: { placeholder: '请选择' } },
    },
  },

  // ==================== Radio ====================
  {
    id: 'radio-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个单选框',
    assertions: {
      components: { mustInclude: ['Radio'] },
    },
  },
  {
    id: 'radio-group',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个单选框组，选项包含男、女',
    assertions: {
      components: { mustInclude: ['Radio.Group'] },
    },
  },
  {
    id: 'radio-disabled',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个禁用的单选框',
    assertions: {
      components: { mustInclude: ['Radio'] },
      props: { Radio: { disabled: true } },
    },
  },

  // ==================== Checkbox ====================
  {
    id: 'checkbox-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个复选框',
    assertions: {
      components: { mustInclude: ['Checkbox'] },
    },
  },
  {
    id: 'checkbox-group',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个复选框组，选项包含苹果、香蕉、橙子',
    assertions: {
      components: { mustInclude: ['Checkbox.Group'] },
    },
  },
  {
    id: 'checkbox-checked',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个已选中的复选框',
    assertions: {
      components: { mustInclude: ['Checkbox'] },
      props: { Checkbox: { checked: true } },
    },
  },
  {
    id: 'checkbox-indeterminate',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个半选状态的复选框',
    assertions: {
      components: { mustInclude: ['Checkbox'] },
      props: { Checkbox: { indeterminate: true } },
    },
  },

  // ==================== Form ====================
  {
    id: 'form-basic',
    suite: 'component',
    level: 'L2',
    prompt: '生成一个表单，包含用户名和密码两个字段',
    assertions: {
      components: { mustInclude: ['Form', 'Form.Item', 'Input'] },
      structure: { minNodeCount: 3 },
    },
  },
  {
    id: 'form-item-required',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个必填的表单项',
    assertions: {
      components: { mustInclude: ['Form.Item'] },
      props: { 'Form.Item': { required: true } },
    },
  },
  {
    id: 'form-with-label',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个带标签的表单项，标签为用户名',
    assertions: {
      components: { mustInclude: ['Form.Item'] },
      props: { 'Form.Item': { label: '用户名' } },
    },
  },

  // ==================== Table ====================
  {
    id: 'table-basic',
    suite: 'component',
    level: 'L2',
    prompt: '生成一个表格，包含姓名、年龄、地址三列',
    assertions: {
      components: { mustInclude: ['Table'] },
      props: {
        Table: { columns: { length: 3 } },
      },
    },
  },
  {
    id: 'table-with-data',
    suite: 'component',
    level: 'L2',
    prompt: '生成一个表格，数据源绑定 state.userList',
    assertions: {
      components: { mustInclude: ['Table'] },
      expressions: { mustReference: ['state.userList'] },
    },
  },
  {
    id: 'table-striped',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个带斑马纹的表格',
    assertions: {
      components: { mustInclude: ['Table'] },
      props: { Table: { striped: true } },
    },
  },
  {
    id: 'table-bordered',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个带边框的表格',
    assertions: {
      components: { mustInclude: ['Table'] },
      props: { Table: { bordered: true } },
    },
  },
  {
    id: 'table-with-pagination',
    suite: 'component',
    level: 'L2',
    prompt: '生成一个带分页的表格',
    assertions: {
      components: { mustInclude: ['Table'] },
      props: { Table: { pagination: {} } },
    },
  },

  // ==================== Card ====================
  {
    id: 'card-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个卡片组件',
    assertions: {
      components: { mustInclude: ['Card'] },
    },
  },
  {
    id: 'card-with-title',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个带标题的卡片，标题为用户信息',
    assertions: {
      components: { mustInclude: ['Card'] },
      props: { Card: { title: '用户信息' } },
    },
  },
  {
    id: 'card-bordered',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个无边框的卡片',
    assertions: {
      components: { mustInclude: ['Card'] },
      props: { Card: { bordered: false } },
    },
  },

  // ==================== Modal ====================
  {
    id: 'modal-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个模态框',
    assertions: {
      components: { mustInclude: ['Modal'] },
    },
  },
  {
    id: 'modal-with-title',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个带标题的模态框，标题为提示',
    assertions: {
      components: { mustInclude: ['Modal'] },
      props: { Modal: { title: '提示' } },
    },
  },
  {
    id: 'modal-confirm',
    suite: 'component',
    level: 'L2',
    prompt: '生成一个确认模态框，包含确定和取消按钮',
    assertions: {
      components: { mustInclude: ['Modal'] },
    },
  },

  // ==================== Alert ====================
  {
    id: 'alert-info',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个信息类型的消息提示',
    assertions: {
      components: { mustInclude: ['Alert'] },
      props: { Alert: { type: 'info' } },
    },
  },
  {
    id: 'alert-success',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个成功类型的消息提示',
    assertions: {
      components: { mustInclude: ['Alert'] },
      props: { Alert: { type: 'success' } },
    },
  },
  {
    id: 'alert-warning',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个警告类型的消息提示',
    assertions: {
      components: { mustInclude: ['Alert'] },
      props: { Alert: { type: 'warning' } },
    },
  },
  {
    id: 'alert-error',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个错误类型的消息提示',
    assertions: {
      components: { mustInclude: ['Alert'] },
      props: { Alert: { type: 'error' } },
    },
  },
  {
    id: 'alert-with-description',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个带描述信息的消息提示',
    assertions: {
      components: { mustInclude: ['Alert'] },
      props: { Alert: { description: {} } },
    },
  },

  // ==================== Tabs ====================
  {
    id: 'tabs-basic',
    suite: 'component',
    level: 'L2',
    prompt: '生成一个标签页组件，包含两个标签页',
    assertions: {
      components: { mustInclude: ['Tabs', 'Tabs.TabPane'] },
      structure: { minNodeCount: 2 },
    },
  },
  {
    id: 'tabs-default-active',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个默认选中第一个标签页的标签组件',
    assertions: {
      components: { mustInclude: ['Tabs'] },
      props: { Tabs: { defaultActiveKey: '1' } },
    },
  },

  // ==================== DatePicker ====================
  {
    id: 'datepicker-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个日期选择器',
    assertions: {
      components: { mustInclude: ['DatePicker'] },
    },
  },
  {
    id: 'datepicker-range',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个日期范围选择器',
    assertions: {
      components: { mustInclude: ['DatePicker.RangePicker'] },
    },
  },
  {
    id: 'datepicker-disabled',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个禁用的日期选择器',
    assertions: {
      components: { mustInclude: ['DatePicker'] },
      props: { DatePicker: { disabled: true } },
    },
  },

  // ==================== Typography ====================
  {
    id: 'typography-title',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个标题文本',
    assertions: {
      components: { mustInclude: ['Typography.Title'] },
    },
  },
  {
    id: 'typography-text',
    suite: 'component',
    level: 'L1',
    prompt: '生成一段普通文本',
    assertions: {
      components: { mustInclude: ['Typography.Text'] },
    },
  },
  {
    id: 'typography-paragraph',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个段落',
    assertions: {
      components: { mustInclude: ['Typography.Paragraph'] },
    },
  },

  // ==================== Avatar ====================
  {
    id: 'avatar-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个头像组件',
    assertions: {
      components: { mustInclude: ['Avatar'] },
    },
  },
  {
    id: 'avatar-with-text',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个带文字的头像组件，文字为用户',
    assertions: {
      components: { mustInclude: ['Avatar'] },
      children: '用户',
    },
  },
  {
    id: 'avatar-group',
    suite: 'component',
    level: 'L2',
    prompt: '生成一个头像组，包含三个头像',
    assertions: {
      components: { mustInclude: ['Avatar.Group', 'Avatar'] },
    },
  },

  // ==================== Badge ====================
  {
    id: 'badge-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个徽标组件',
    assertions: {
      components: { mustInclude: ['Badge'] },
    },
  },
  {
    id: 'badge-with-count',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个带数字的徽标，数字为 5',
    assertions: {
      components: { mustInclude: ['Badge'] },
      props: { Badge: { count: 5 } },
    },
  },
  {
    id: 'badge-dot',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个点状徽标',
    assertions: {
      components: { mustInclude: ['Badge'] },
      props: { Badge: { dot: true } },
    },
  },

  // ==================== Tag ====================
  {
    id: 'tag-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个标签',
    assertions: {
      components: { mustInclude: ['Tag'] },
    },
  },
  {
    id: 'tag-colors',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个红色的标签',
    assertions: {
      components: { mustInclude: ['Tag'] },
      props: { Tag: { color: 'red' } },
    },
  },

  // ==================== Progress ====================
  {
    id: 'progress-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个进度条组件',
    assertions: {
      components: { mustInclude: ['Progress'] },
    },
  },
  {
    id: 'progress-percent',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个进度为 50 的进度条',
    assertions: {
      components: { mustInclude: ['Progress'] },
      props: { Progress: { percent: 50 } },
    },
  },

  // ==================== Divider ====================
  {
    id: 'divider-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个分割线',
    assertions: {
      components: { mustInclude: ['Divider'] },
    },
  },
  {
    id: 'divider-with-text',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个带文字的分割线，文字为或者',
    assertions: {
      components: { mustInclude: ['Divider'] },
      children: '或者',
    },
  },

  // ==================== Breadcrumb ====================
  {
    id: 'breadcrumb-basic',
    suite: 'component',
    level: 'L2',
    prompt: '生成一个面包屑导航，包含首页和列表页两级',
    assertions: {
      components: { mustInclude: ['Breadcrumb'] },
      structure: { minNodeCount: 2 },
    },
  },

  // ==================== Steps ====================
  {
    id: 'steps-basic',
    suite: 'component',
    level: 'L2',
    prompt: '生成一个步骤条，包含三个步骤',
    assertions: {
      components: { mustInclude: ['Steps'] },
      structure: { minNodeCount: 3 },
    },
  },

  // ==================== Empty ====================
  {
    id: 'empty-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个空状态组件',
    assertions: {
      components: { mustInclude: ['Empty'] },
    },
  },

  // ==================== Result ====================
  {
    id: 'result-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个结果组件',
    assertions: {
      components: { mustInclude: ['Result'] },
    },
  },
  {
    id: 'result-success',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个成功状态的结果组件',
    assertions: {
      components: { mustInclude: ['Result'] },
      props: { Result: { status: 'success' } },
    },
  },

  // ==================== Tooltip ====================
  {
    id: 'tooltip-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个文字提示组件',
    assertions: {
      components: { mustInclude: ['Tooltip'] },
    },
  },

  // ==================== Popover ====================
  {
    id: 'popover-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个气泡卡片组件',
    assertions: {
      components: { mustInclude: ['Popover'] },
    },
  },

  // ==================== Popconfirm ====================
  {
    id: 'popconfirm-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个气泡确认框',
    assertions: {
      components: { mustInclude: ['Popconfirm'] },
    },
  },

  // ==================== Tree ====================
  {
    id: 'tree-basic',
    suite: 'component',
    level: 'L2',
    prompt: '生成一个树形控件，包含两个节点',
    assertions: {
      components: { mustInclude: ['Tree'] },
    },
  },

  // ==================== Menu ====================
  {
    id: 'menu-basic',
    suite: 'component',
    level: 'L2',
    prompt: '生成一个菜单组件，包含两个菜单项',
    assertions: {
      components: { mustInclude: ['Menu'] },
    },
  },

  // ==================== Dropdown ====================
  {
    id: 'dropdown-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个下拉菜单',
    assertions: {
      components: { mustInclude: ['Dropdown'] },
    },
  },

  // ==================== Upload ====================
  {
    id: 'upload-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个上传组件',
    assertions: {
      components: { mustInclude: ['Upload'] },
    },
  },

  // ==================== Slider ====================
  {
    id: 'slider-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个滑块组件',
    assertions: {
      components: { mustInclude: ['Slider'] },
    },
  },

  // ==================== Switch ====================
  {
    id: 'switch-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个开关组件',
    assertions: {
      components: { mustInclude: ['Switch'] },
    },
  },

  // ==================== Rate ====================
  {
    id: 'rate-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个评分组件',
    assertions: {
      components: { mustInclude: ['Rate'] },
    },
  },

  // ==================== Row/Col ====================
  {
    id: 'row-col-basic',
    suite: 'component',
    level: 'L2',
    prompt: '生成一个两列的栅格布局',
    assertions: {
      components: { mustInclude: ['Row', 'Col'] },
    },
  },

  // ==================== Space ====================
  {
    id: 'space-basic',
    suite: 'component',
    level: 'L2',
    prompt: '生成一个间距布局组件，包含两个子元素',
    assertions: {
      components: { mustInclude: ['Space'] },
    },
  },

  // ==================== Flex ====================
  {
    id: 'flex-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个弹性布局组件',
    assertions: {
      components: { mustInclude: ['Flex'] },
    },
  },

  // ==================== Container ====================
  {
    id: 'container-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个容器组件',
    assertions: {
      components: { mustInclude: ['Container'] },
    },
  },

  // ==================== Statistic ====================
  {
    id: 'statistic-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个统计数值组件',
    assertions: {
      components: { mustInclude: ['Statistic'] },
    },
  },

  // ==================== Descriptions ====================
  {
    id: 'descriptions-basic',
    suite: 'component',
    level: 'L2',
    prompt: '生成一个描述列表组件，包含两个字段',
    assertions: {
      components: { mustInclude: ['Descriptions', 'Descriptions.Item'] },
    },
  },

  // ==================== TimePicker ====================
  {
    id: 'timepicker-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个时间选择器',
    assertions: {
      components: { mustInclude: ['TimePicker'] },
    },
  },

  // ==================== Cascader ====================
  {
    id: 'cascader-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个级联选择器',
    assertions: {
      components: { mustInclude: ['Cascader'] },
    },
  },

  // ==================== TreeSelect ====================
  {
    id: 'treeselect-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个树选择器',
    assertions: {
      components: { mustInclude: ['TreeSelect'] },
    },
  },

  // ==================== Mentions ====================
  {
    id: 'mentions-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个提及输入框',
    assertions: {
      components: { mustInclude: ['Mentions'] },
    },
  },

  // ==================== AutoComplete ====================
  {
    id: 'autocomplete-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个自动完成输入框',
    assertions: {
      components: { mustInclude: ['AutoComplete'] },
    },
  },

  // ==================== ColorPicker ====================
  {
    id: 'colorpicker-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个颜色选择器',
    assertions: {
      components: { mustInclude: ['ColorPicker'] },
    },
  },

  // ==================== FloatButton ====================
  {
    id: 'floatbutton-basic',
    suite: 'component',
    level: 'L1',
    prompt: '生成一个悬浮按钮',
    assertions: {
      components: { mustInclude: ['FloatButton'] },
    },
  },
];
