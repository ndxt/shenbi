import type { PageSchema } from '@shenbi/schema';

export const tabsDetailSkeletonSchema: PageSchema = {
  id: 'tabs-detail-skeleton',
  name: 'Tabs 详情页骨架',
  state: {
    activeTab: { default: 'basic' },
    tabItems: {
      default: [
        { key: 'basic', label: '基本信息', children: '这里展示基本信息内容' },
        { key: 'logs', label: '操作日志', children: '这里展示操作日志内容' },
        { key: 'perm', label: '权限配置', children: '这里展示权限配置内容' },
      ],
    },
  },
  body: {
    component: 'Container',
    props: { direction: 'column', gap: 16 },
    children: [
      {
        component: 'Card',
        props: { title: 'Tabs 场景（最小骨架）' },
        children: [
          {
            component: 'Tabs',
            props: {
              activeKey: '{{state.activeTab}}',
              items: '{{state.tabItems}}',
            },
            events: {
              onChange: [{ type: 'setState', key: 'activeTab', value: '{{event}}' }],
            },
          },
          {
            component: 'Alert',
            props: {
              type: 'success',
              showIcon: true,
              message: '{{"当前激活标签: " + state.activeTab}}',
            },
          },
        ],
      },
    ],
  },
};
