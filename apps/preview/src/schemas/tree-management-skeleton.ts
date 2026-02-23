import type { PageSchema } from '@shenbi/schema';

export const treeManagementSkeletonSchema: PageSchema = {
  id: 'tree-management-skeleton',
  name: 'Tree 管理骨架',
  state: {
    treeData: {
      default: [
        {
          title: '总部',
          key: 'hq',
          children: [
            { title: '产品部', key: 'dept-product' },
            { title: '技术部', key: 'dept-tech' },
          ],
        },
        {
          title: '分部',
          key: 'branch',
          children: [
            { title: '华东区', key: 'region-east' },
            { title: '华南区', key: 'region-south' },
          ],
        },
      ],
    },
    selectedKeys: { default: [] },
  },
  body: {
    component: 'Container',
    props: { direction: 'column', gap: 16 },
    children: [
      {
        component: 'Card',
        props: { title: 'Tree 场景（最小骨架）' },
        children: [
          {
            component: 'Tree',
            props: {
              treeData: '{{state.treeData}}',
              selectedKeys: '{{state.selectedKeys}}',
              defaultExpandAll: true,
              checkable: true,
            },
            events: {
              onSelect: [{ type: 'setState', key: 'selectedKeys', value: '{{event[0] ?? []}}' }],
            },
          },
          {
            component: 'Alert',
            props: {
              type: 'info',
              showIcon: true,
              message: '{{"当前选中节点数: " + (state.selectedKeys?.length ?? 0)}}',
            },
          },
        ],
      },
    ],
  },
};
