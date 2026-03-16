import type { TestCase } from '../types';

/**
 * Action 行为测试用例
 *
 * 覆盖 19 种 Action，每种至少 1 个 L1 case
 */
export const actionCases: TestCase[] = [
  // ==================== setState ====================
  {
    id: 'action-setstate-basic',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后将 state.count 设为 0',
    assertions: {
      actions: {
        mustInclude: [{ type: 'setState', key: 'count' }],
      },
      state: { mustDeclare: ['count'] },
    },
  },
  {
    id: 'action-setstate-string',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后将 state.name 设为张三',
    assertions: {
      actions: {
        mustInclude: [{ type: 'setState', key: 'name' }],
      },
      state: { mustDeclare: ['name'] },
    },
  },
  {
    id: 'action-setstate-boolean',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后将 state.loading 设为 true',
    assertions: {
      actions: {
        mustInclude: [{ type: 'setState', key: 'loading' }],
      },
      state: { mustDeclare: ['loading'] },
    },
  },
  {
    id: 'action-setstate-conditional',
    suite: 'action',
    level: 'L2',
    prompt: '生成一个按钮，点击后根据条件设置 state.value，如果大于 0 则设为 1，否则设为 0',
    assertions: {
      actions: {
        mustInclude: [{ type: 'setState', key: 'value' }, { type: 'condition' }],
      },
    },
  },

  // ==================== callMethod ====================
  {
    id: 'action-callmethod-basic',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后调用 refresh 方法',
    assertions: {
      actions: {
        mustInclude: [{ type: 'callMethod', name: 'refresh' }],
      },
      methods: { mustDeclare: ['refresh'] },
    },
  },
  {
    id: 'action-callmethod-with-params',
    suite: 'action',
    level: 'L2',
    prompt: '生成一个按钮，点击后调用 save 方法并传入参数 name 和 age',
    assertions: {
      actions: {
        mustInclude: [{ type: 'callMethod', name: 'save' }],
      },
    },
  },

  // ==================== fetch ====================
  {
    id: 'action-fetch-basic',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后请求 /api/users',
    assertions: {
      actions: {
        mustInclude: [{ type: 'fetch' }],
      },
    },
  },
  {
    id: 'action-fetch-onSuccess',
    suite: 'action',
    level: 'L2',
    prompt: '生成一个按钮，点击后请求 /api/users，成功后弹出成功消息',
    assertions: {
      actions: {
        mustInclude: [{ type: 'fetch' }, { type: 'message', level: 'success' }],
      },
    },
  },
  {
    id: 'action-fetch-onError',
    suite: 'action',
    level: 'L2',
    prompt: '生成一个按钮，点击后请求 /api/data，失败后显示错误提示',
    assertions: {
      actions: {
        mustInclude: [{ type: 'fetch' }, { type: 'message', level: 'error' }],
      },
    },
  },
  {
    id: 'action-fetch-post',
    suite: 'action',
    level: 'L2',
    prompt: '生成一个按钮，点击后向 /api/users 发送 POST 请求',
    assertions: {
      actions: {
        mustInclude: [{ type: 'fetch' }],
      },
    },
  },

  // ==================== navigate ====================
  {
    id: 'action-navigate-basic',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后跳转到 /home 页面',
    assertions: {
      actions: {
        mustInclude: [{ type: 'navigate' }],
      },
    },
  },
  {
    id: 'action-navigate-with-params',
    suite: 'action',
    level: 'L2',
    prompt: '生成一个按钮，点击后跳转到 /user/123 页面',
    assertions: {
      actions: {
        mustInclude: [{ type: 'navigate' }],
      },
    },
  },
  {
    id: 'action-navigate-external',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后打开外部链接 https://example.com',
    assertions: {
      actions: {
        mustInclude: [{ type: 'navigate' }],
      },
    },
  },

  // ==================== message ====================
  {
    id: 'action-message-info',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后弹出普通消息提示',
    assertions: {
      actions: {
        mustInclude: [{ type: 'message' }],
      },
    },
  },
  {
    id: 'action-message-success',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后弹出成功消息',
    assertions: {
      actions: {
        mustInclude: [{ type: 'message', level: 'success' }],
      },
    },
  },
  {
    id: 'action-message-error',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后弹出错误消息',
    assertions: {
      actions: {
        mustInclude: [{ type: 'message', level: 'error' }],
      },
    },
  },
  {
    id: 'action-message-warning',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后弹出警告消息',
    assertions: {
      actions: {
        mustInclude: [{ type: 'message', level: 'warning' }],
      },
    },
  },

  // ==================== notification ====================
  {
    id: 'action-notification-basic',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后弹出通知',
    assertions: {
      actions: {
        mustInclude: [{ type: 'notification' }],
      },
    },
  },
  {
    id: 'action-notification-with-description',
    suite: 'action',
    level: 'L2',
    prompt: '生成一个按钮，点击后弹出带描述的通知',
    assertions: {
      actions: {
        mustInclude: [{ type: 'notification' }],
      },
    },
  },

  // ==================== confirm ====================
  {
    id: 'action-confirm-basic',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后显示确认对话框',
    assertions: {
      actions: {
        mustInclude: [{ type: 'confirm' }],
      },
    },
  },
  {
    id: 'action-confirm-onOk',
    suite: 'action',
    level: 'L2',
    prompt: '生成一个按钮，点击后显示确认框，点击确定后删除数据',
    assertions: {
      actions: {
        mustInclude: [{ type: 'confirm' }],
      },
    },
  },
  {
    id: 'action-confirm-onOk-onCancel',
    suite: 'action',
    level: 'L2',
    prompt: '生成一个按钮，点击后显示确认框，包含确定和取消的处理逻辑',
    assertions: {
      actions: {
        mustInclude: [{ type: 'confirm' }],
      },
    },
  },

  // ==================== modal ====================
  {
    id: 'action-modal-open',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后打开弹窗',
    assertions: {
      actions: {
        mustInclude: [{ type: 'modal' }],
      },
    },
  },
  {
    id: 'action-modal-with-payload',
    suite: 'action',
    level: 'L2',
    prompt: '生成一个按钮，点击后打开弹窗并传递数据',
    assertions: {
      actions: {
        mustInclude: [{ type: 'modal' }],
      },
    },
  },

  // ==================== drawer ====================
  {
    id: 'action-drawer-open',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后打开抽屉',
    assertions: {
      actions: {
        mustInclude: [{ type: 'drawer' }],
      },
    },
  },
  {
    id: 'action-drawer-with-title',
    suite: 'action',
    level: 'L2',
    prompt: '生成一个按钮，点击后打开带标题的抽屉',
    assertions: {
      actions: {
        mustInclude: [{ type: 'drawer' }],
      },
    },
  },

  // ==================== validate ====================
  {
    id: 'action-validate-basic',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后验证表单',
    assertions: {
      actions: {
        mustInclude: [{ type: 'validate' }],
      },
    },
  },
  {
    id: 'action-validate-onSuccess',
    suite: 'action',
    level: 'L2',
    prompt: '生成一个按钮，点击后验证表单，成功后提交数据',
    assertions: {
      actions: {
        mustInclude: [{ type: 'validate' }, { type: 'fetch' }],
      },
    },
  },
  {
    id: 'action-validate-onError',
    suite: 'action',
    level: 'L2',
    prompt: '生成一个按钮，点击后验证表单，失败后显示错误',
    assertions: {
      actions: {
        mustInclude: [{ type: 'validate' }],
      },
    },
  },

  // ==================== resetForm ====================
  {
    id: 'action-resetform-basic',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后重置表单',
    assertions: {
      actions: {
        mustInclude: [{ type: 'resetForm' }],
      },
    },
  },
  {
    id: 'action-resetform-with-fields',
    suite: 'action',
    level: 'L2',
    prompt: '生成一个按钮，点击后重置表单的指定字段',
    assertions: {
      actions: {
        mustInclude: [{ type: 'resetForm' }],
      },
    },
  },

  // ==================== condition ====================
  {
    id: 'action-condition-basic',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后根据条件执行不同操作',
    assertions: {
      actions: {
        mustInclude: [{ type: 'condition' }],
      },
    },
  },
  {
    id: 'action-condition-if-then-else',
    suite: 'action',
    level: 'L2',
    prompt: '生成一个按钮，点击后如果 state.count 大于 0 则增加，否则设为 1',
    assertions: {
      actions: {
        mustInclude: [{ type: 'condition' }, { type: 'setState' }],
      },
    },
  },

  // ==================== loop ====================
  {
    id: 'action-loop-basic',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后循环处理数据',
    assertions: {
      actions: {
        mustInclude: [{ type: 'loop' }],
      },
    },
  },

  // ==================== script ====================
  {
    id: 'action-script-basic',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后执行自定义脚本',
    assertions: {
      actions: {
        mustInclude: [{ type: 'script' }],
      },
    },
  },

  // ==================== copy ====================
  {
    id: 'action-copy-basic',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后复制文本到剪贴板',
    assertions: {
      actions: {
        mustInclude: [{ type: 'copy' }],
      },
    },
  },

  // ==================== debounce ====================
  {
    id: 'action-debounce-basic',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后防抖执行操作',
    assertions: {
      actions: {
        mustInclude: [{ type: 'debounce' }],
      },
    },
  },

  // ==================== throttle ====================
  {
    id: 'action-throttle-basic',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后节流执行操作',
    assertions: {
      actions: {
        mustInclude: [{ type: 'throttle' }],
      },
    },
  },

  // ==================== emit ====================
  {
    id: 'action-emit-basic',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后触发自定义事件',
    assertions: {
      actions: {
        mustInclude: [{ type: 'emit' }],
      },
    },
  },

  // ==================== download ====================
  {
    id: 'action-download-basic',
    suite: 'action',
    level: 'L1',
    prompt: '生成一个按钮，点击后下载文件',
    assertions: {
      actions: {
        mustInclude: [{ type: 'download' }],
      },
    },
  },
];
