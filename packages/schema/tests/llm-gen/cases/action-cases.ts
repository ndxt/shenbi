import type { TestCase } from './types';

/**
 * Action 测试用例 - L1 级别
 */
export const actionCasesL1: TestCase[] = [
  // ==================== setState ====================
  {
    id: 'action-setstate-001',
    name: 'Action - setState 设置字符串',
    category: 'action',
    subCategory: 'setState',
    level: 'L1',
    prompt: '创建一个按钮，点击时设置 state 的 name 字段为"张三"',
    expectedActions: ['setState'],
  },
  {
    id: 'action-setstate-002',
    name: 'Action - setState 设置数字',
    category: 'action',
    subCategory: 'setState',
    level: 'L1',
    prompt: '创建一个按钮，点击时设置 state 的 count 字段为 0',
    expectedActions: ['setState'],
  },
  {
    id: 'action-setstate-003',
    name: 'Action - setState 设置布尔值',
    category: 'action',
    subCategory: 'setState',
    level: 'L1',
    prompt: '创建一个按钮，点击时设置 state 的 loading 字段为 true',
    expectedActions: ['setState'],
  },
  {
    id: 'action-setstate-004',
    name: 'Action - setState 设置表达式',
    category: 'action',
    subCategory: 'setState',
    level: 'L1',
    prompt: '创建一个按钮，点击时设置 state 的 doubled 字段为 {{state.count * 2}}',
    expectedActions: ['setState'],
  },

  // ==================== callMethod ====================
  {
    id: 'action-callmethod-001',
    name: 'Action - callMethod 调用方法',
    category: 'action',
    subCategory: 'callMethod',
    level: 'L1',
    prompt: '创建一个按钮，点击时调用页面的 handleSubmit 方法',
    expectedActions: ['callMethod'],
  },
  {
    id: 'action-callmethod-002',
    name: 'Action - callMethod 带参数',
    category: 'action',
    subCategory: 'callMethod',
    level: 'L1',
    prompt: '创建一个按钮，点击时调用 loadData 方法并传入参数',
    expectedActions: ['callMethod'],
  },

  // ==================== fetch ====================
  {
    id: 'action-fetch-001',
    name: 'Action - fetch GET 请求',
    category: 'action',
    subCategory: 'fetch',
    level: 'L1',
    prompt: '创建一个按钮，点击时发起 GET 请求获取用户列表',
    expectedActions: ['fetch'],
  },
  {
    id: 'action-fetch-002',
    name: 'Action - fetch POST 请求',
    category: 'action',
    subCategory: 'fetch',
    level: 'L1',
    prompt: '创建一个按钮，点击时发起 POST 请求提交表单数据',
    expectedActions: ['fetch'],
  },
  {
    id: 'action-fetch-003',
    name: 'Action - fetch 带成功回调',
    category: 'action',
    subCategory: 'fetch',
    level: 'L1',
    prompt: '创建一个按钮，点击时请求数据，成功后显示提示消息',
    expectedActions: ['fetch', 'message'],
  },

  // ==================== navigate ====================
  {
    id: 'action-navigate-001',
    name: 'Action - navigate 页面跳转',
    category: 'action',
    subCategory: 'navigate',
    level: 'L1',
    prompt: '创建一个按钮，点击时跳转到首页',
    expectedActions: ['navigate'],
  },
  {
    id: 'action-navigate-002',
    name: 'Action - navigate 返回上一页',
    category: 'action',
    subCategory: 'navigate',
    level: 'L1',
    prompt: '创建一个按钮，点击时返回上一页',
    expectedActions: ['navigate'],
  },
  {
    id: 'action-navigate-003',
    name: 'Action - navigate 带参数跳转',
    category: 'action',
    subCategory: 'navigate',
    level: 'L1',
    prompt: '创建一个按钮，点击时跳转到用户详情页，传入用户 ID',
    expectedActions: ['navigate'],
  },

  // ==================== message ====================
  {
    id: 'action-message-001',
    name: 'Action - message 信息提示',
    category: 'action',
    subCategory: 'message',
    level: 'L1',
    prompt: '创建一个按钮，点击时显示"操作成功"提示',
    expectedActions: ['message'],
  },
  {
    id: 'action-message-002',
    name: 'Action - message 成功提示',
    category: 'action',
    subCategory: 'message',
    level: 'L1',
    prompt: '创建一个按钮，点击时显示成功类型的提示消息',
    expectedActions: ['message'],
  },
  {
    id: 'action-message-003',
    name: 'Action - message 错误提示',
    category: 'action',
    subCategory: 'message',
    level: 'L1',
    prompt: '创建一个按钮，点击时显示错误类型的提示消息',
    expectedActions: ['message'],
  },
  {
    id: 'action-message-004',
    name: 'Action - message 警告提示',
    category: 'action',
    subCategory: 'message',
    level: 'L1',
    prompt: '创建一个按钮，点击时显示警告类型的提示消息',
    expectedActions: ['message'],
  },

  // ==================== notification ====================
  {
    id: 'action-notification-001',
    name: 'Action - notification 通知提醒',
    category: 'action',
    subCategory: 'notification',
    level: 'L1',
    prompt: '创建一个按钮，点击时显示通知提醒，包含标题和描述',
    expectedActions: ['notification'],
  },
  {
    id: 'action-notification-002',
    name: 'Action - notification 成功通知',
    category: 'action',
    subCategory: 'notification',
    level: 'L1',
    prompt: '创建一个按钮，点击时显示成功类型的通知',
    expectedActions: ['notification'],
  },

  // ==================== confirm ====================
  {
    id: 'action-confirm-001',
    name: 'Action - confirm 确认对话框',
    category: 'action',
    subCategory: 'confirm',
    level: 'L1',
    prompt: '创建一个按钮，点击时弹出确认对话框',
    expectedActions: ['confirm'],
  },
  {
    id: 'action-confirm-002',
    name: 'Action - confirm 删除确认',
    category: 'action',
    subCategory: 'confirm',
    level: 'L1',
    prompt: '创建一个删除按钮，点击时弹出"确认删除吗？"的对话框',
    expectedActions: ['confirm'],
  },
  {
    id: 'action-confirm-003',
    name: 'Action - confirm 带回调',
    category: 'action',
    subCategory: 'confirm',
    level: 'L1',
    prompt: '创建一个按钮，点击弹出确认框，确认后执行删除操作',
    expectedActions: ['confirm', 'fetch'],
  },

  // ==================== modal ====================
  {
    id: 'action-modal-001',
    name: 'Action - modal 打开弹窗',
    category: 'action',
    subCategory: 'modal',
    level: 'L1',
    prompt: '创建一个按钮，点击时打开 ID 为 userModal 的弹窗',
    expectedActions: ['modal'],
  },
  {
    id: 'action-modal-002',
    name: 'Action - modal 关闭弹窗',
    category: 'action',
    subCategory: 'modal',
    level: 'L1',
    prompt: '创建一个按钮，点击时关闭 ID 为 userModal 的弹窗',
    expectedActions: ['modal'],
  },

  // ==================== drawer ====================
  {
    id: 'action-drawer-001',
    name: 'Action - drawer 打开抽屉',
    category: 'action',
    subCategory: 'drawer',
    level: 'L1',
    prompt: '创建一个按钮，点击时打开 ID 为 detailDrawer 的抽屉',
    expectedActions: ['drawer'],
  },
  {
    id: 'action-drawer-002',
    name: 'Action - drawer 关闭抽屉',
    category: 'action',
    subCategory: 'drawer',
    level: 'L1',
    prompt: '创建一个按钮，点击时关闭 ID 为 detailDrawer 的抽屉',
    expectedActions: ['drawer'],
  },

  // ==================== validate ====================
  {
    id: 'action-validate-001',
    name: 'Action - validate 表单验证',
    category: 'action',
    subCategory: 'validate',
    level: 'L1',
    prompt: '创建一个提交按钮，点击时验证 ID 为 formRef 的表单',
    expectedActions: ['validate'],
  },
  {
    id: 'action-validate-002',
    name: 'Action - validate 验证成功回调',
    category: 'action',
    subCategory: 'validate',
    level: 'L1',
    prompt: '创建一个按钮，点击时验证表单，验证成功后提交数据',
    expectedActions: ['validate', 'fetch'],
  },

  // ==================== resetForm ====================
  {
    id: 'action-resetform-001',
    name: 'Action - resetForm 重置表单',
    category: 'action',
    subCategory: 'resetForm',
    level: 'L1',
    prompt: '创建一个重置按钮，点击时重置 ID 为 formRef 的表单',
    expectedActions: ['resetForm'],
  },
  {
    id: 'action-resetform-002',
    name: 'Action - resetForm 重置指定字段',
    category: 'action',
    subCategory: 'resetForm',
    level: 'L1',
    prompt: '创建一个按钮，点击时重置表单的 username 和 email 字段',
    expectedActions: ['resetForm'],
  },

  // ==================== condition ====================
  {
    id: 'action-condition-001',
    name: 'Action - condition 条件判断',
    category: 'action',
    subCategory: 'condition',
    level: 'L1',
    prompt: '创建一个按钮，点击时判断如果 count 大于 0 则显示提示',
    expectedActions: ['condition', 'message'],
  },
  {
    id: 'action-condition-002',
    name: 'Action - condition 分支处理',
    category: 'action',
    subCategory: 'condition',
    level: 'L1',
    prompt: '创建一个按钮，根据条件执行不同的操作，成立时提交，失败时提示',
    expectedActions: ['condition'],
  },

  // ==================== loop ====================
  {
    id: 'action-loop-001',
    name: 'Action - loop 循环处理',
    category: 'action',
    subCategory: 'loop',
    level: 'L1',
    prompt: '创建一个按钮，点击时遍历 items 数组并处理每个元素',
    expectedActions: ['loop'],
  },
  {
    id: 'action-loop-002',
    name: 'Action - loop 带索引',
    category: 'action',
    subCategory: 'loop',
    level: 'L1',
    prompt: '创建一个按钮，点击时循环数据列表，需要访问索引',
    expectedActions: ['loop'],
  },

  // ==================== script ====================
  {
    id: 'action-script-001',
    name: 'Action - script 执行脚本',
    category: 'action',
    subCategory: 'script',
    level: 'L1',
    prompt: '创建一个按钮，点击时执行一段 JavaScript 代码计算总和',
    expectedActions: ['script'],
  },
  {
    id: 'action-script-002',
    name: 'Action - script 操作数据',
    category: 'action',
    subCategory: 'script',
    level: 'L1',
    prompt: '创建一个按钮，点击时执行脚本处理 state 数据',
    expectedActions: ['script'],
  },

  // ==================== copy ====================
  {
    id: 'action-copy-001',
    name: 'Action - copy 复制文本',
    category: 'action',
    subCategory: 'copy',
    level: 'L1',
    prompt: '创建一个复制按钮，点击时复制邀请码到剪贴板',
    expectedActions: ['copy'],
  },
  {
    id: 'action-copy-002',
    name: 'Action - copy 复制表达式',
    category: 'action',
    subCategory: 'copy',
    level: 'L1',
    prompt: '创建一个按钮，点击时复制 state.url 的值到剪贴板',
    expectedActions: ['copy'],
  },

  // ==================== debounce ====================
  {
    id: 'action-debounce-001',
    name: 'Action - debounce 防抖搜索',
    category: 'action',
    subCategory: 'debounce',
    level: 'L1',
    prompt: '创建一个输入框，输入时防抖 500ms 后执行搜索请求',
    expectedActions: ['debounce', 'fetch'],
  },
  {
    id: 'action-debounce-002',
    name: 'Action - debounce 防抖保存',
    category: 'action',
    subCategory: 'debounce',
    level: 'L1',
    prompt: '创建一个自动保存功能，防抖 1000ms 后保存数据',
    expectedActions: ['debounce', 'fetch'],
  },

  // ==================== throttle ====================
  {
    id: 'action-throttle-001',
    name: 'Action - throttle 节流点击',
    category: 'action',
    subCategory: 'throttle',
    level: 'L1',
    prompt: '创建一个按钮，节流 1000ms 内只能点击一次',
    expectedActions: ['throttle'],
  },
  {
    id: 'action-throttle-002',
    name: 'Action - throttle 节流滚动',
    category: 'action',
    subCategory: 'throttle',
    level: 'L1',
    prompt: '创建一个滚动监听，节流 200ms 后加载数据',
    expectedActions: ['throttle', 'fetch'],
  },

  // ==================== emit ====================
  {
    id: 'action-emit-001',
    name: 'Action - emit 触发事件',
    category: 'action',
    subCategory: 'emit',
    level: 'L1',
    prompt: '创建一个按钮，点击时触发自定义事件 onUserChange',
    expectedActions: ['emit'],
  },
  {
    id: 'action-emit-002',
    name: 'Action - emit 带数据',
    category: 'action',
    subCategory: 'emit',
    level: 'L1',
    prompt: '创建一个按钮，点击时触发事件并传递用户数据',
    expectedActions: ['emit'],
  },

  // ==================== download ====================
  {
    id: 'action-download-001',
    name: 'Action - download 下载文件',
    category: 'action',
    subCategory: 'download',
    level: 'L1',
    prompt: '创建一个下载按钮，点击下载 PDF 文件',
    expectedActions: ['download'],
  },
  {
    id: 'action-download-002',
    name: 'Action - download 指定文件名',
    category: 'action',
    subCategory: 'download',
    level: 'L1',
    prompt: '创建一个下载按钮，下载文件并指定保存文件名',
    expectedActions: ['download'],
  },
];

/**
 * Action 测试用例 - L2 级别（组合场景）
 */
export const actionCasesL2: TestCase[] = [
  // ==================== 表单提交场景 ====================
  {
    id: 'action-l2-form-001',
    name: 'Action - 表单提交流程',
    category: 'action',
    subCategory: 'form-submit',
    level: 'L2',
    prompt: '创建一个表单提交按钮：先验证表单，验证成功后发起 POST 请求提交数据，成功后显示提示并跳转到列表页',
    expectedActions: ['validate', 'fetch', 'message', 'navigate'],
  },
  {
    id: 'action-l2-form-002',
    name: 'Action - 表单重置流程',
    category: 'action',
    subCategory: 'form-reset',
    level: 'L2',
    prompt: '创建一个重置按钮：重置表单后清空错误提示',
    expectedActions: ['resetForm'],
  },

  // ==================== 删除确认场景 ====================
  {
    id: 'action-l2-delete-001',
    name: 'Action - 删除确认流程',
    category: 'action',
    subCategory: 'delete',
    level: 'L2',
    prompt: '创建一个删除按钮：点击弹出确认框，确认后发起 DELETE 请求，成功后显示成功提示并刷新列表',
    expectedActions: ['confirm', 'fetch', 'message'],
  },

  // ==================== 数据加载场景 ====================
  {
    id: 'action-l2-load-001',
    name: 'Action - 数据加载流程',
    category: 'action',
    subCategory: 'data-load',
    level: 'L2',
    prompt: '创建一个加载按钮：点击时设置 loading 状态为 true，发起 GET 请求获取数据，成功后更新 state 并设置 loading 为 false，失败时显示错误提示',
    expectedActions: ['setState', 'fetch', 'message'],
  },

  // ==================== 弹窗操作场景 ====================
  {
    id: 'action-l2-modal-001',
    name: 'Action - 弹窗编辑流程',
    category: 'action',
    subCategory: 'modal-edit',
    level: 'L2',
    prompt: '创建编辑功能：点击编辑按钮打开弹窗并传入选中数据，弹窗内表单提交后关闭弹窗并刷新列表',
    expectedActions: ['modal', 'validate', 'fetch'],
  },
  {
    id: 'action-l2-drawer-001',
    name: 'Action - 抽屉详情流程',
    category: 'action',
    subCategory: 'drawer-detail',
    level: 'L2',
    prompt: '创建详情查看：点击按钮打开抽屉并传入记录 ID，抽屉内加载详情数据',
    expectedActions: ['drawer', 'fetch'],
  },

  // ==================== 搜索过滤场景 ====================
  {
    id: 'action-l2-search-001',
    name: 'Action - 搜索防抖流程',
    category: 'action',
    subCategory: 'search',
    level: 'L2',
    prompt: '创建搜索功能：输入框内容变化时防抖 500ms 后发起搜索请求，更新数据列表',
    expectedActions: ['debounce', 'fetch', 'setState'],
  },

  // ==================== 批量操作场景 ====================
  {
    id: 'action-l2-batch-001',
    name: 'Action - 批量删除流程',
    category: 'action',
    subCategory: 'batch-delete',
    level: 'L2',
    prompt: '创建批量删除按钮：选中多条数据后点击删除，弹出确认框，确认后批量删除选中的数据',
    expectedActions: ['confirm', 'fetch', 'message'],
  },

  // ==================== 导出导入场景 ====================
  {
    id: 'action-l2-export-001',
    name: 'Action - 数据导出流程',
    category: 'action',
    subCategory: 'export',
    level: 'L2',
    prompt: '创建导出按钮：点击时发起导出请求，完成后下载生成的文件',
    expectedActions: ['fetch', 'download', 'message'],
  },

  // ==================== 条件处理场景 ====================
  {
    id: 'action-l2-condition-001',
    name: 'Action - 库存检查流程',
    category: 'action',
    subCategory: 'stock-check',
    level: 'L2',
    prompt: '创建购买按钮：点击时检查库存是否充足，充足则提交订单，不足则显示提示',
    expectedActions: ['condition', 'fetch', 'message'],
  },

  // ==================== 联动场景 ====================
  {
    id: 'action-l2-cascade-001',
    name: 'Action - 省市区联动',
    category: 'action',
    subCategory: 'cascade',
    level: 'L2',
    prompt: '创建省市区选择器：选择省份后加载城市列表，选择城市后加载区县列表',
    expectedActions: ['setState', 'fetch'],
  },

  // ==================== 计时器场景 ====================
  {
    id: 'action-l2-timer-001',
    name: 'Action - 倒计时流程',
    category: 'action',
    subCategory: 'countdown',
    level: 'L2',
    prompt: '创建发送验证码按钮：点击后发送请求，然后开始 60 秒倒计时，期间按钮禁用',
    expectedActions: ['fetch', 'setState', 'message'],
  },

  // ==================== 权限校验场景 ====================
  {
    id: 'action-l2-permission-001',
    name: 'Action - 权限校验流程',
    category: 'action',
    subCategory: 'permission',
    level: 'L2',
    prompt: '创建敏感操作按钮：点击时先检查用户权限，有权限则执行操作，无权限则显示无权提示',
    expectedActions: ['condition', 'message'],
  },
];

/**
 * 所有 Action 测试用例（L1 + L2）
 */
export const actionCases: TestCase[] = [
  ...actionCasesL1,
  ...actionCasesL2,
];
