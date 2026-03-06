import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Inspector } from './Inspector';
import type { InspectorTabContribution } from './inspector-tabs';

describe('Inspector', () => {
  it('默认不内置业务 tabs', () => {
    render(<Inspector />);

    expect(screen.queryByText('Props')).toBeNull();
    expect(screen.queryByText('Style')).toBeNull();
  });

  it('支持渲染插件注入 tab', () => {
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
