import type { PageSchema } from '@shenbi/schema';

export const descriptionsSkeletonSchema: PageSchema = {
  id: 'descriptions-skeleton',
  name: 'Descriptions 详情页',
  state: {
    detail: {
      default: {
        id: 'U-1001',
        name: 'Alice',
        email: 'alice@shenbi.dev',
        status: 'enabled',
        role: 'admin',
        department: 'Finance',
        updatedAt: '2026-02-23 10:20:00',
      },
    },
  },
  methods: {
    toggleStatus: {
      body: [
        {
          type: 'setState',
          key: 'detail.status',
          value: '{{state.detail.status === "enabled" ? "disabled" : "enabled"}}',
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
        props: { title: 'Descriptions 场景（详情展示）' },
        children: [
          {
            component: 'Space',
            children: [
              {
                component: 'Button',
                props: { type: 'primary' },
                children: '切换状态',
                events: {
                  onClick: [{ type: 'callMethod', name: 'toggleStatus' }],
                },
              },
            ],
          },
          {
            component: 'Descriptions',
            props: {
              bordered: true,
              column: 2,
            },
            children: [
              {
                component: 'Descriptions.Item',
                props: { label: '用户ID' },
                children: '{{state.detail.id}}',
              },
              {
                component: 'Descriptions.Item',
                props: { label: '姓名' },
                children: '{{state.detail.name}}',
              },
              {
                component: 'Descriptions.Item',
                props: { label: '邮箱' },
                children: '{{state.detail.email}}',
              },
              {
                component: 'Descriptions.Item',
                props: { label: '角色' },
                children: '{{state.detail.role}}',
              },
              {
                component: 'Descriptions.Item',
                props: { label: '部门' },
                children: '{{state.detail.department}}',
              },
              {
                component: 'Descriptions.Item',
                props: { label: '更新时间' },
                children: '{{state.detail.updatedAt}}',
              },
              {
                component: 'Descriptions.Item',
                props: { label: '状态' },
                children: [
                  {
                    component: 'Tag',
                    props: {
                      color: '{{state.detail.status === "enabled" ? "green" : "default"}}',
                    },
                    children: '{{state.detail.status === "enabled" ? "启用" : "停用"}}',
                  },
                ],
              },
            ],
          },
          {
            component: 'Alert',
            props: {
              type: 'info',
              showIcon: true,
              message: '{{"当前状态: " + state.detail.status}}',
            },
          },
        ],
      },
    ],
  },
};
