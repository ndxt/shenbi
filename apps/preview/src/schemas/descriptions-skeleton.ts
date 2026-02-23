import type { PageSchema } from '@shenbi/schema';

export const descriptionsSkeletonSchema: PageSchema = {
  id: 'descriptions-skeleton',
  name: 'Descriptions 骨架',
  state: {
    detail: {
      default: {
        id: 'U-1001',
        name: 'Alice',
        email: 'alice@shenbi.dev',
        status: 'enabled',
        role: 'admin',
      },
    },
  },
  body: {
    component: 'Container',
    props: { direction: 'column', gap: 16 },
    children: [
      {
        component: 'Card',
        props: { title: 'Descriptions 场景（最小骨架）' },
        children: [
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
        ],
      },
    ],
  },
};
