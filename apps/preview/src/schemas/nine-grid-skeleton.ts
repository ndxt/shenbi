import type { PageSchema } from '@shenbi/schema';

export const nineGridSkeletonSchema: PageSchema = {
  id: 'nine-grid-skeleton',
  name: '九宫格布局骨架',
  state: {
    activeGridId: { default: null },
    gridItems: {
      default: [
        { id: 'orders', title: '订单数', value: 1286, unit: '单', level: 'high' },
        { id: 'revenue', title: '今日营收', value: 32.8, unit: '万', level: 'high' },
        { id: 'users', title: '新增用户', value: 186, unit: '人', level: 'medium' },
        { id: 'conversion', title: '转化率', value: 12.4, unit: '%', level: 'medium' },
        { id: 'retention', title: '留存率', value: 78.3, unit: '%', level: 'medium' },
        { id: 'refund', title: '退款率', value: 1.2, unit: '%', level: 'low' },
        { id: 'latency', title: '接口延迟', value: 84, unit: 'ms', level: 'low' },
        { id: 'errors', title: '错误数', value: 3, unit: '次', level: 'low' },
        { id: 'tickets', title: '工单待处理', value: 27, unit: '个', level: 'medium' },
      ],
    },
  },
  body: {
    component: 'Container',
    props: { direction: 'column', gap: 16 },
    children: [
      {
        component: 'Layout',
        props: {
          style: {
            background: '#ffffff',
            border: '1px solid #f0f0f0',
            borderRadius: 8,
            overflow: 'hidden',
          },
        },
        children: [
          {
            component: 'Layout.Header',
            props: {
              style: {
                color: '#0f172a',
                fontWeight: 600,
                fontSize: 16,
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
              },
            },
            children: '九宫格布局（Layout + Grid）',
          },
          {
            component: 'Layout.Content',
            props: {
              style: { padding: 16 },
            },
            children: [
              {
                component: 'Alert',
                props: {
                  type: 'info',
                  showIcon: true,
                  message: '使用 Row/Col 的 span=8 形成 3x3 常用看板布局。',
                },
              },
              {
                component: 'Row',
                props: {
                  gutter: [16, 16],
                  style: { marginTop: 12 },
                },
                children: [
                  {
                    component: 'Col',
                    loop: {
                      data: '{{state.gridItems}}',
                      key: '{{item.id}}',
                    },
                    props: { span: 8 },
                    children: [
                      {
                        component: 'Card',
                        props: { hoverable: true },
                        events: {
                          onClick: [{ type: 'setState', key: 'activeGridId', value: '{{item.id}}' }],
                        },
                        children: [
                          {
                            component: 'Statistic',
                            props: {
                              title: '{{item.title}}',
                              value: '{{item.value}}',
                              suffix: '{{item.unit}}',
                            },
                          },
                          {
                            component: 'Tag',
                            props: {
                              color:
                                '{{item.level === "high" ? "red" : item.level === "medium" ? "blue" : "green"}}',
                              style: { marginTop: 10 },
                            },
                            children:
                              '{{item.level === "high" ? "高优先" : item.level === "medium" ? "中优先" : "低优先"}}',
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            component: 'Layout.Footer',
            props: {
              style: {
                background: '#ffffff',
                borderTop: '1px solid #f1f5f9',
                padding: 12,
              },
            },
            children: [
              {
                component: 'Alert',
                if: '{{state.activeGridId != null}}',
                props: {
                  type: 'success',
                  showIcon: true,
                  message: '{{"当前选中指标: " + state.activeGridId}}',
                },
              },
            ],
          },
        ],
      },
    ],
  },
};
