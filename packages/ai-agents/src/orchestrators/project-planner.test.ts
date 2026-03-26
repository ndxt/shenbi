import { describe, expect, it } from 'vitest';
import { normalizeProjectPlan } from './project-planner.ts';

describe('normalizeProjectPlan', () => {
  it('drops model-generated evidenceSourceIds so retrieval can bind trusted source ids later', () => {
    const plan = normalizeProjectPlan({
      projectName: '待办事项跟踪管理系统',
      pages: [
        {
          pageId: 'todo-list',
          pageName: '事项清单',
          action: 'create',
          description: '显示所有事项',
          evidence: '事项清单列表页面，显示所有待办事项',
          evidenceSourceIds: ['Snippet 1', 'Snippet 2'],
        },
      ],
    }, {
      componentSummary: 'Table, Form, Card',
      files: [],
    });

    expect(plan.pages[0]?.evidenceSourceIds).toBeUndefined();
    expect(plan.pages[0]?.evidence).toBe('事项清单列表页面，显示所有待办事项');
  });
});
