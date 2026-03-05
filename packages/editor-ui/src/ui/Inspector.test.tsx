import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Inspector } from './Inspector';
import type { InspectorTabContribution } from './inspector-tabs';

describe('Inspector', () => {
  it('默认使用内置 tabs（fallback）', () => {
    render(<Inspector />);

    expect(screen.getByText('Props')).toBeInTheDocument();
    expect(screen.getByText('Style')).toBeInTheDocument();
    expect(screen.getByText('Events')).toBeInTheDocument();
    expect(screen.getByText('Logic')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('支持按 id 覆盖内置 tab', () => {
    const tabs: InspectorTabContribution[] = [
      {
        id: 'events',
        label: '事件配置',
        order: 30,
        render: () => <div>自定义事件面板</div>,
      },
    ];

    render(<Inspector tabs={tabs} />);

    fireEvent.click(screen.getByText('事件配置'));
    expect(screen.getByText('自定义事件面板')).toBeInTheDocument();
    expect(screen.queryByText('Events')).toBeNull();
  });

  it('支持新增自定义 tab', () => {
    const tabs: InspectorTabContribution[] = [
      {
        id: 'advanced',
        label: 'Advanced',
        order: 99,
        render: () => <div>Advanced Panel</div>,
      },
    ];

    render(<Inspector tabs={tabs} />);

    fireEvent.click(screen.getByText('Advanced'));
    expect(screen.getByText('Advanced Panel')).toBeInTheDocument();
  });
});
