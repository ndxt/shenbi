import type { PageSchema } from '@shenbi/schema';

export const drawerDetailSkeletonSchema: PageSchema = {
  id: 'drawer-detail-skeleton',
  name: 'Drawer 详情页',
  state: {
    orders: {
      default: {
        list: [
          { id: 'ORD-2026-0001', customer: 'Shenbi Demo Inc.', amount: '¥12,800.00', status: 'processing' },
          { id: 'ORD-2026-0002', customer: 'Oceanic Tech', amount: '¥7,300.00', status: 'done' },
          { id: 'ORD-2026-0003', customer: 'Nova Studio', amount: '¥2,050.00', status: 'pending' },
        ],
      },
    },
  },
  methods: {
    openDrawer: {
      params: ['record'],
      body: [
        {
          type: 'drawer',
          id: 'orderDetailDrawer',
          open: true,
          payload: '{{params.record}}',
        },
      ],
    },
    closeDrawer: {
      body: [{ type: 'drawer', id: 'orderDetailDrawer', open: false }],
    },
  },
  body: {
    component: 'Container',
    props: { direction: 'column', gap: 16 },
    children: [
      {
        component: 'Card',
        props: { title: 'Drawer 场景（独立验证）' },
        children: [
          {
            component: 'Alert',
            props: {
              type: 'info',
              showIcon: true,
              title: '点击“查看详情”后以 page.dialogs 的 Drawer 展示详情。',
            },
          },
          {
            component: 'Container',
            loop: {
              data: '{{state.orders.list}}',
              key: '{{item.id}}',
            },
            props: { direction: 'column', gap: 8 },
            children: [
              {
                component: 'Card',
                props: { size: 'small' },
                children: [
                  {
                    component: 'Space',
                    props: {
                      style: { width: '100%', justifyContent: 'space-between' },
                    },
                    children: [
                      {
                        component: 'Alert',
                        props: {
                          type: 'success',
                          showIcon: true,
                          title: '{{item.id + " / " + item.customer + " / " + item.amount}}',
                        },
                      },
                      {
                        component: 'Button',
                        props: { type: 'primary' },
                        children: '查看详情',
                        events: {
                          onClick: [
                            {
                              type: 'callMethod',
                              name: 'openDrawer',
                              params: { record: '{{item}}' },
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
        ],
      },
    ],
  },
  dialogs: [
    {
      id: 'orderDetailDrawer',
      component: 'Drawer',
      props: {
        open: true,
        width: 460,
        placement: 'right',
        title: '{{"订单详情 - " + (dialogPayload?.id ?? "")}}',
      },
      events: {
        onClose: [{ type: 'callMethod', name: 'closeDrawer' }],
      },
      children: [
        {
          component: 'Descriptions',
          props: { column: 1, bordered: true },
          children: [
            {
              component: 'Descriptions.Item',
              props: { label: '订单号' },
              children: '{{dialogPayload?.id ?? "-"}}',
            },
            {
              component: 'Descriptions.Item',
              props: { label: '客户' },
              children: '{{dialogPayload?.customer ?? "-"}}',
            },
            {
              component: 'Descriptions.Item',
              props: { label: '金额' },
              children: '{{dialogPayload?.amount ?? "-"}}',
            },
            {
              component: 'Descriptions.Item',
              props: { label: '状态' },
              children: [
                {
                  component: 'Tag',
                  props: {
                    color:
                      '{{dialogPayload?.status === "done" ? "green" : dialogPayload?.status === "processing" ? "blue" : "default"}}',
                  },
                  children: '{{dialogPayload?.status ?? "-"}}',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
