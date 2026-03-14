import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Sidebar } from './Sidebar';
import {
  resolveSidebarTabs,
  type SidebarTabContribution,
} from './sidebar-tabs';

describe('Sidebar', () => {
  it('默认使用内置 tabs（fallback）', () => {
    render(<Sidebar />);

    resolveSidebarTabs().forEach((tab) => {
      expect(screen.getByText(tab.label)).toBeInTheDocument();
    });
  });

  it('支持按 id 覆盖内置 tab', () => {
    const tabs: SidebarTabContribution[] = [
      {
        id: 'data',
        label: '数据源',
        order: 30,
        render: () => <div>自定义数据面板</div>,
      },
    ];

    render(<Sidebar tabs={tabs} />);

    fireEvent.click(screen.getByText('数据源'));
    expect(screen.getByText('自定义数据面板')).toBeInTheDocument();
    expect(screen.queryByText('Data')).toBeNull();
  });

  it('支持新增自定义 tab', () => {
    const tabs: SidebarTabContribution[] = [
      {
        id: 'assets',
        label: 'Assets',
        order: 99,
        render: () => <div>Assets Panel</div>,
      },
    ];

    render(<Sidebar tabs={tabs} />);

    fireEvent.click(screen.getByText('Assets'));
    expect(screen.getByText('Assets Panel')).toBeInTheDocument();
  });
});
