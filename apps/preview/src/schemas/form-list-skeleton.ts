import type { PageSchema } from '@shenbi/schema';

export const formListSkeletonSchema: PageSchema = {
  id: 'form-list-skeleton',
  name: 'Form.List 场景骨架',
  methods: {
    openDialog: {
      body: [{ type: 'modal', id: 'formListDialog', open: true }],
    },
    closeDialog: {
      body: [{ type: 'modal', id: 'formListDialog', open: false }],
    },
  },
  body: {
    component: 'Container',
    props: { direction: 'column', gap: 16 },
    children: [
      {
        component: 'Card',
        props: { title: 'Form.List 场景（最小骨架）' },
        children: [
          {
            component: 'Alert',
            props: {
              type: 'warning',
              showIcon: true,
              message: '该场景用于占位 Phase2：待补充 Form.List render-props 的完整表达能力。',
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
        title: '联系方式（Form.List 骨架）',
        destroyOnClose: true,
      },
      events: {
        onCancel: [{ type: 'callMethod', name: 'closeDialog' }],
      },
      children: [
        {
          component: 'Form',
          props: { layout: 'vertical' },
          children: [
            {
              component: 'Form.Item',
              props: { label: '说明' },
              children: [
                {
                  component: 'Alert',
                  props: {
                    type: 'info',
                    message: 'Phase2 将在此替换为 Form.List 的动态增删实现。',
                    showIcon: true,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
