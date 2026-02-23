import type { PageSchema } from '@shenbi/schema';

export const formListSkeletonSchema: PageSchema = {
  id: 'form-list-skeleton',
  name: 'Form.List 场景',
  state: {
    contactRows: {
      default: [{ id: 1 }, { id: 2 }],
    },
    nextContactId: { default: 3 },
    submittedContacts: { default: [] },
    draftValues: { default: {} },
  },
  methods: {
    openDialog: {
      body: [{ type: 'modal', id: 'formListDialog', open: true }],
    },
    closeDialog: {
      body: [{ type: 'modal', id: 'formListDialog', open: false }],
    },
    addContactRow: {
      body: [
        {
          type: 'setState',
          key: 'contactRows',
          value: '{{[...state.contactRows, { id: state.nextContactId }]}}',
        },
        {
          type: 'setState',
          key: 'nextContactId',
          value: '{{state.nextContactId + 1}}',
        },
      ],
    },
    removeContactRow: {
      params: ['rowId'],
      body: [
        {
          type: 'setState',
          key: 'contactRows',
          value: '{{state.contactRows.filter((row) => row.id !== params.rowId)}}',
        },
      ],
    },
    moveContactRowUp: {
      params: ['rowId'],
      body: [
        {
          type: 'setState',
          key: 'contactRows',
          value:
            '{{(() => { const rows = [...state.contactRows]; const idx = rows.findIndex((row) => row.id === params.rowId); if (idx <= 0) return rows; const current = rows[idx]; rows[idx] = rows[idx - 1]; rows[idx - 1] = current; return rows; })()}}',
        },
      ],
    },
    moveContactRowDown: {
      params: ['rowId'],
      body: [
        {
          type: 'setState',
          key: 'contactRows',
          value:
            '{{(() => { const rows = [...state.contactRows]; const idx = rows.findIndex((row) => row.id === params.rowId); if (idx < 0 || idx >= rows.length - 1) return rows; const current = rows[idx]; rows[idx] = rows[idx + 1]; rows[idx + 1] = current; return rows; })()}}',
        },
      ],
    },
    submitContacts: {
      body: [
        {
          type: 'validate',
          formRef: 'contact-list-form',
          onSuccess: [
            {
              type: 'setState',
              key: 'submittedContacts',
              value:
                '{{state.contactRows.map((row) => ({ id: row.id, name: values["contactName_" + row.id], phone: values["contactPhone_" + row.id] }))}}',
            },
            { type: 'message', level: 'success', content: '联系方式保存成功' },
            { type: 'callMethod', name: 'closeDialog' },
          ],
          onError: [{ type: 'message', level: 'error', content: '请先补全联系方式' }],
        },
      ],
    },
  },
  body: {
    component: 'Container',
    props: { direction: 'column', gap: 16 },
    children: [
      {
        component: 'Card',
        props: { title: 'Form.List 场景（动态增删）' },
        children: [
          {
            component: 'Alert',
            props: {
              type: 'info',
              showIcon: true,
              message: '在弹窗中维护联系方式：支持新增、删除、上下移动与逐行校验。',
            },
          },
          {
            component: 'Space',
            children: [
              {
                component: 'Button',
                props: { type: 'primary' },
                children: '打开联系人弹窗',
                events: {
                  onClick: [{ type: 'callMethod', name: 'openDialog' }],
                },
              },
            ],
          },
          {
            component: 'Alert',
            props: {
              type: 'success',
              showIcon: true,
              message: '{{"最近提交条数: " + (state.submittedContacts?.length ?? 0)}}',
            },
          },
          {
            component: 'Alert',
            if: '{{(state.submittedContacts?.length ?? 0) > 0}}',
            props: {
              type: 'info',
              showIcon: true,
              message:
                '{{"最近提交: " + state.submittedContacts.map((item) => item.name + "(" + item.phone + ")").join("，")}}',
            },
          },
        ],
      },
    ],
  },
  dialogs: [
    {
      id: 'formListDialog',
      component: 'Modal',
      props: {
        open: true,
        title: '联系方式（Form.List 验证）',
        destroyOnClose: true,
        maskClosable: false,
      },
      events: {
        onCancel: [{ type: 'callMethod', name: 'closeDialog' }],
      },
      slots: {
        footer: {
          component: 'Space',
          children: [
            {
              component: 'Button',
              children: '取消',
              events: {
                onClick: [{ type: 'callMethod', name: 'closeDialog' }],
              },
            },
            {
              component: 'Button',
              children: '添加一行',
              events: {
                onClick: [{ type: 'callMethod', name: 'addContactRow' }],
              },
            },
            {
              component: 'Button',
              props: { type: 'primary' },
              children: '提交',
              events: {
                onClick: [{ type: 'callMethod', name: 'submitContacts' }],
              },
            },
          ],
        },
      },
      children: [
        {
          id: 'contact-list-form',
          component: 'Form',
          props: { layout: 'vertical' },
          events: {
            onValuesChange: [
              {
                type: 'setState',
                key: 'draftValues',
                value: '{{event[1]}}',
              },
            ],
          },
          children: [
            {
              component: 'Container',
              loop: {
                data: '{{state.contactRows}}',
                key: '{{item.id}}',
              },
              children: [
                {
                  component: 'Card',
                  props: {
                    size: 'small',
                    style: { marginBottom: 12 },
                    title: '{{"联系方式 #" + (index + 1)}}',
                  },
                  children: [
                    {
                      component: 'Form.Item',
                      props: {
                        name: '{{"contactName_" + item.id}}',
                        label: '联系人',
                        rules: [{ required: true, message: '请输入联系人姓名' }],
                      },
                      children: [{ component: 'Input', props: { placeholder: '请输入姓名' } }],
                    },
                    {
                      component: 'Form.Item',
                      props: {
                        name: '{{"contactPhone_" + item.id}}',
                        label: '联系电话',
                        rules: [
                          { required: true, message: '请输入联系电话' },
                          { pattern: '^1\\d{10}$', message: '请输入 11 位手机号' },
                        ],
                      },
                      children: [{ component: 'Input', props: { placeholder: '例如：13800138000' } }],
                    },
                    {
                      component: 'Space',
                      children: [
                        {
                          component: 'Button',
                          children: '上移',
                          if: '{{index > 0}}',
                          events: {
                            onClick: [
                              {
                                type: 'callMethod',
                                name: 'moveContactRowUp',
                                params: { rowId: '{{item.id}}' },
                              },
                            ],
                          },
                        },
                        {
                          component: 'Button',
                          children: '下移',
                          if: '{{index < state.contactRows.length - 1}}',
                          events: {
                            onClick: [
                              {
                                type: 'callMethod',
                                name: 'moveContactRowDown',
                                params: { rowId: '{{item.id}}' },
                              },
                            ],
                          },
                        },
                        {
                          component: 'Button',
                          props: { danger: true },
                          children: '删除',
                          events: {
                            onClick: [
                              {
                                type: 'callMethod',
                                name: 'removeContactRow',
                                params: { rowId: '{{item.id}}' },
                              },
                            ],
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              component: 'Alert',
              props: {
                type: 'warning',
                showIcon: true,
                message: '{{"当前草稿字段数: " + Object.keys(state.draftValues ?? {}).length}}',
              },
            },
          ],
        },
      ],
    },
  ],
};
