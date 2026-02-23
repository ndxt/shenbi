import type { PageSchema } from '@shenbi/schema';

export const drawerDetailSkeletonSchema: PageSchema = {
  id: 'drawer-detail-skeleton',
  name: 'Drawer 详情骨架',
  state: {
    drawerOpen: { default: false },
    detail: {
      default: {
        id: 'ORD-2026-0001',
        customer: 'Shenbi Demo Inc.',
        amount: '¥12,800.00',
        status: 'processing',
      },
    },
  },
  methods: {
    openDrawer: {
      body: [{ type: 'setState', key: 'drawerOpen', value: true }],
    },
    closeDrawer: {
      body: [{ type: 'setState', key: 'drawerOpen', value: false }],
    },
  },
  body: {
    component: 'Container',
    props: { direction: 'column', gap: 16 },
    children: [
      {
        component: 'Card',
        props: { title: 'Drawer 场景（最小骨架）' },
        children: [
          {
            component: 'Space',
            children: [
              {
                component: 'Button',
                props: { type: 'primary' },
                children: '打开侧边详情',
                events: {
                  onClick: [{ type: 'callMethod', name: 'openDrawer' }],
                },
              },
            ],
          },
        ],
      },
      {
        component: 'Drawer',
        props: {
          title: '订单详情',
          width: 420,
          open: '{{state.drawerOpen}}',
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
                children: '{{state.detail.id}}',
              },
              {
                component: 'Descriptions.Item',
                props: { label: '客户' },
                children: '{{state.detail.customer}}',
              },
              {
                component: 'Descriptions.Item',
                props: { label: '金额' },
                children: '{{state.detail.amount}}',
              },
              {
                component: 'Descriptions.Item',
                props: { label: '状态' },
                children: '{{state.detail.status}}',
              },
            ],
          },
        ],
      },
    ],
  },
};
