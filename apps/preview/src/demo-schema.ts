import type { PageSchema } from '@shenbi/schema';

/**
 * Demo Schema — 覆盖 6 个基础组件验证场景：
 * 1. Button:  静态 props + 事件 + loading 表达式
 * 2. Input:   value 双向绑定（onChange → setState）
 * 3. Select:  options 数据驱动 + onChange
 * 4. Card:    children 嵌套 + slots (title/extra)
 * 5. Tag+loop: 循环渲染 + if 条件过滤 + 表达式 color
 * 6. Alert+if: 条件渲染 + 动态 message
 */
export const demoPageSchema: PageSchema = {
  id: 'demo_page',
  name: 'Shenbi Demo',
  state: {
    loading: { default: false },
    keyword: { default: '' },
    submitText: { default: '提交' },
    selectedCity: { default: undefined },
    tags: {
      default: [
        { id: 1, label: 'React', color: 'blue', visible: true },
        { id: 2, label: 'Vue', color: 'green', visible: true },
        { id: 3, label: 'Angular', color: 'red', visible: false },
        { id: 4, label: 'Svelte', color: 'orange', visible: true },
      ],
    },
    showAlert: { default: true },
  },
  methods: {
    handleSubmit: {
      body: [
        { type: 'setState', key: 'loading', value: true },
        {
          type: 'message',
          level: 'success',
          content: '提交成功',
        },
      ],
    },
  },
  body: {
    id: 'root',
    component: 'Container',
    props: { direction: 'column', gap: 16 },
    children: [
      // 场景 4 - Card: children 嵌套 + slots
      {
        id: 'main_card',
        component: 'Card',
        slots: {
          title: {
            id: 'card_title',
            component: '__fragment',
            children: 'Shenbi 低代码引擎 Demo',
          },
          extra: {
            id: 'card_extra',
            component: 'Button',
            props: { type: 'link', size: 'small' },
            children: '更多',
          },
        },
        children: [
          // 场景 2 - Input: value 双向绑定
          {
            id: 'search_input',
            component: 'Input',
            props: {
              placeholder: '搜索关键词...',
              value: '{{state.keyword}}',
              allowClear: true,
            },
            events: {
              onChange: [
                {
                  type: 'setState',
                  key: 'keyword',
                  value: '{{event.target.value}}',
                },
              ],
            },
          },
          // 场景 3 - Select: options 数据驱动
          {
            id: 'city_select',
            component: 'Select',
            props: {
              placeholder: '选择城市',
              value: '{{state.selectedCity}}',
              style: { width: 200 },
              options: [
                { label: '北京', value: 'beijing' },
                { label: '上海', value: 'shanghai' },
                { label: '广州', value: 'guangzhou' },
              ],
            },
            events: {
              onChange: [
                {
                  type: 'setState',
                  key: 'selectedCity',
                  value: '{{event}}',
                },
              ],
            },
          },
          // 场景 5 - Tag + loop: 循环渲染 + if 条件过滤
          {
            id: 'tag_container',
            component: 'Container',
            props: { direction: 'row', gap: 8, wrap: 'wrap' },
            children: [
              {
                id: 'tag_loop',
                component: 'Tag',
                loop: {
                  data: '{{state.tags}}',
                  itemKey: 'item',
                  indexKey: 'index',
                  key: '{{item.id}}',
                },
                if: '{{item.visible}}',
                props: {
                  color: '{{item.color}}',
                },
                children: '{{item.label}}',
              },
            ],
          },
          // 场景 6 - Alert + if: 条件渲染 + 动态 message
          {
            id: 'alert_info',
            component: 'Alert',
            if: '{{state.showAlert}}',
            props: {
              type: 'info',
              showIcon: true,
              message: '{{state.keyword ? "搜索: " + state.keyword : "请输入搜索关键词"}}',
            },
          },
          // 场景 1 - Button: 静态 props + 事件 + loading 表达式
          {
            id: 'submit_btn',
            component: 'Button',
            props: {
              type: 'primary',
              loading: '{{state.loading}}',
            },
            children: '{{state.submitText}}',
            events: {
              onClick: [{ type: 'callMethod', name: 'handleSubmit' }],
            },
          },
        ],
      },
    ],
  },
};
