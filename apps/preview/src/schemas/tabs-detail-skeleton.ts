import type { PageSchema } from '@shenbi/schema';

export const tabsDetailSkeletonSchema: PageSchema = {
  id: 'tabs-detail-skeleton',
  name: 'Tabs 详情页',
  state: {
    activeTab: { default: 'basic' },
    visitedTabs: { default: ['basic'] },
    tabItems: {
      default: [
        { key: 'basic', label: '基本信息', children: '用户基础资料与状态信息' },
        { key: 'logs', label: '操作日志', children: '最近 20 条关键操作日志' },
        { key: 'perm', label: '权限配置', children: '角色与数据范围配置' },
      ],
    },
  },
  body: {
    component: 'Container',
    props: { direction: 'column', gap: 16 },
    children: [
      {
        component: 'Card',
        props: { title: 'Tabs 场景（可切换+懒展示）' },
        children: [
          {
            component: 'Tabs',
            props: {
              activeKey: '{{state.activeTab}}',
              items: '{{state.tabItems}}',
            },
            events: {
              onChange: [
                { type: 'setState', key: 'activeTab', value: '{{event}}' },
                {
                  type: 'setState',
                  key: 'visitedTabs',
                  value: '{{state.visitedTabs.includes(event) ? state.visitedTabs : [...state.visitedTabs, event]}}',
                },
              ],
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
          {
            component: 'Alert',
            props: {
              type: 'info',
              showIcon: true,
              message: '{{"已访问标签: " + state.visitedTabs.join(", ")}}',
            },
          },
          {
            component: 'Card',
            if: '{{state.activeTab === "basic" && state.visitedTabs.includes("basic")}}',
            props: { size: 'small', title: 'Basic 内容区（懒展示）' },
            children: [
              {
                component: 'Descriptions',
                props: { column: 2, bordered: true },
                children: [
                  {
                    component: 'Descriptions.Item',
                    props: { label: '用户ID' },
                    children: 'U-1001',
                  },
                  {
                    component: 'Descriptions.Item',
                    props: { label: '状态' },
                    children: 'enabled',
                  },
                ],
              },
            ],
          },
          {
            component: 'Card',
            if: '{{state.activeTab === "logs" && state.visitedTabs.includes("logs")}}',
            props: { size: 'small', title: 'Logs 内容区（懒展示）' },
            children: [
              {
                component: 'Alert',
                props: {
                  type: 'warning',
                  showIcon: true,
                  message: '2026-02-22 10:31:22 更新了权限组',
                },
              },
            ],
          },
          {
            component: 'Card',
            if: '{{state.activeTab === "perm" && state.visitedTabs.includes("perm")}}',
            props: { size: 'small', title: 'Permission 内容区（懒展示）' },
            children: [
              {
                component: 'Tag',
                props: { color: 'blue' },
                children: 'finance-admin',
              },
            ],
          },
        ],
      },
    ],
  },
};
