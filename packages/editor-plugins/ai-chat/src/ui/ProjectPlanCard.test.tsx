import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectPlanCard } from './ProjectPlanCard';

describe('ProjectPlanCard', () => {
  it('groups pages by module and toggles evidence excerpts on demand', () => {
    render(
      <ProjectPlanCard
        projectPlan={{
          projectName: '订单管理后台',
          pages: [
            {
              pageId: 'order-list',
              pageName: '订单列表页',
              action: 'create',
              group: '订单管理',
              description: '展示订单列表与筛选',
              evidence: '文档要求支持状态筛选、导出和行内编辑。',
            },
            {
              pageId: 'role-list',
              pageName: '角色管理页',
              action: 'create',
              group: '系统管理',
              description: '管理角色与权限',
            },
          ],
        }}
        pages={[]}
        phase="awaiting_confirmation"
        planRevisionRequested={false}
        onConfirm={vi.fn()}
        onRequestRevision={vi.fn()}
        onCancelRevision={vi.fn()}
        onSubmitRevision={vi.fn()}
      />,
    );

    expect(screen.getByText('订单管理')).toBeInTheDocument();
    expect(screen.getByText('系统管理')).toBeInTheDocument();
    expect(screen.queryByText('文档要求支持状态筛选、导出和行内编辑。')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('show evidence'));
    expect(screen.getByText('文档要求支持状态筛选、导出和行内编辑。')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('hide evidence'));
    expect(screen.queryByText('文档要求支持状态筛选、导出和行内编辑。')).not.toBeInTheDocument();
  });
});
