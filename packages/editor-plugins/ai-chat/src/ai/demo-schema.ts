import type { PageSchema } from '@shenbi/schema';

export function createAIDemoSchema(): PageSchema {
  return {
    id: 'ai-demo-page',
    name: 'AI 生成演示页面',
    body: [
      {
        id: 'ai-generated-card',
        component: 'Card',
        props: {
          title: 'AI 生成演示页面',
        },
        children: [
          {
            id: 'ai-generated-alert',
            component: 'Alert',
            props: {
              title: '已通过 AI Bridge 执行 schema.replace',
              type: 'success',
              showIcon: true,
            },
          },
          {
            id: 'ai-generated-button',
            component: 'Button',
            props: {
              type: 'primary',
            },
            children: '开始使用',
          },
        ],
      },
    ],
  };
}
