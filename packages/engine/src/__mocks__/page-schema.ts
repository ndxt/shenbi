import type { PageSchema } from '@shenbi/schema';

export const mockPageSchema: PageSchema = {
  id: 'demo_page',
  name: 'Demo Page',
  state: {
    loading: { default: false },
    keyword: { default: '' },
    submitText: { default: 'Submit' },
    tags: {
      default: [
        { id: 1, label: 'A', color: 'blue' },
        { id: 2, label: 'B', color: 'gold' }
      ]
    }
  },
  methods: {
    handleSubmit: {
      body: [
        {
          type: 'setState',
          key: 'loading',
          value: true
        }
      ]
    }
  },
  body: {
    id: 'root',
    component: 'Container',
    children: [
      {
        id: 'submit_button',
        component: 'Button',
        props: {
          type: 'primary',
          loading: '{{state.loading}}'
        },
        children: '{{state.submitText}}',
        events: {
          onClick: [{ type: 'callMethod', name: 'handleSubmit' }]
        }
      }
    ]
  }
};
