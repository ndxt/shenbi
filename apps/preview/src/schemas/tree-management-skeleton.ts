import type { PageSchema } from '@shenbi/schema';

export const treeManagementSkeletonSchema: PageSchema = {
  id: 'tree-management-skeleton',
  name: 'Tree 管理',
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
    expandedKeys: { default: ['hq', 'branch'] },
    checkedKeys: { default: [] },
    loadedKeys: { default: [] },
  },
  methods: {
    markLoaded: {
      params: ['nodeKey'],
      body: [
        {
          type: 'setState',
          key: 'loadedKeys',
          value: '{{state.loadedKeys.includes(params.nodeKey) ? state.loadedKeys : [...state.loadedKeys, params.nodeKey]}}',
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
        props: { title: 'Tree 场景（选中/展开/勾选/异步）' },
        children: [
          {
            component: 'Tree',
            props: {
              treeData: '{{state.treeData}}',
              selectedKeys: '{{state.selectedKeys}}',
              expandedKeys: '{{state.expandedKeys}}',
              checkedKeys: '{{state.checkedKeys}}',
              checkable: true,
              loadData: {
                type: 'JSFunction',
                params: ['treeNode'],
                body: 'return Promise.resolve(treeNode);',
              },
            },
            events: {
              onSelect: [{ type: 'setState', key: 'selectedKeys', value: '{{event[0] ?? []}}' }],
              onExpand: [{ type: 'setState', key: 'expandedKeys', value: '{{event[0] ?? []}}' }],
              onCheck: [{ type: 'setState', key: 'checkedKeys', value: '{{event[0] ?? event ?? []}}' }],
              onLoad: [
                {
                  type: 'callMethod',
                  name: 'markLoaded',
                  params: { nodeKey: '{{event[0]?.key ?? null}}' },
                },
              ],
            },
          },
          {
            component: 'Alert',
            props: {
              type: 'info',
              showIcon: true,
              title: '{{"当前选中节点数: " + (state.selectedKeys?.length ?? 0)}}',
            },
          },
          {
            component: 'Alert',
            props: {
              type: 'success',
              showIcon: true,
              title: '{{"当前展开节点数: " + (state.expandedKeys?.length ?? 0)}}',
            },
          },
          {
            component: 'Alert',
            props: {
              type: 'warning',
              showIcon: true,
              title: '{{"当前勾选节点数: " + (state.checkedKeys?.length ?? 0)}}',
            },
          },
        ],
      },
    ],
  },
};
