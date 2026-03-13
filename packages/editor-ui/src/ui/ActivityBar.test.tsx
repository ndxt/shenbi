import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Rocket } from 'lucide-react';
import { ActivityBar } from './ActivityBar';
import type { ActivityBarItemContribution } from './activitybar-items';

describe('ActivityBar', () => {
  it('默认渲染内置图标项（fallback）', () => {
    render(<ActivityBar />);

    const explorer = screen.getByLabelText('Components');
    expect(explorer).toBeInTheDocument();
    expect(explorer).toHaveAttribute('aria-pressed', 'true');
    expect(explorer).not.toHaveAttribute('title');
    expect(screen.getByLabelText('Outline')).toBeInTheDocument();
    expect(screen.getByLabelText('Data')).toBeInTheDocument();
    expect(screen.getByLabelText('Debug')).toBeInTheDocument();
    expect(screen.getByLabelText('Extensions')).toBeInTheDocument();
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  });

  it('支持新增自定义图标项', () => {
    const items: ActivityBarItemContribution[] = [
      {
        id: 'rocket',
        label: 'Rocket',
        icon: Rocket,
        order: 99,
        section: 'main',
      },
    ];
    render(<ActivityBar items={items} />);

    expect(screen.getByLabelText('Rocket')).toBeInTheDocument();
  });

  it('支持覆盖内置图标项并响应点击', () => {
    const onClick = vi.fn();
    const items: ActivityBarItemContribution[] = [
      {
        id: 'debug',
        label: '调试台',
        icon: Rocket,
        order: 40,
        section: 'main',
        onClick,
      },
    ];
    render(<ActivityBar items={items} />);

    const debugItem = screen.getByLabelText('调试台');
    fireEvent.click(debugItem);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(debugItem).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText('Debug')).toBeNull();
  });

  it('点击图标后切换激活态', () => {
    render(<ActivityBar />);

    const explorer = screen.getByLabelText('Components');
    const search = screen.getByLabelText('Outline');
    expect(explorer).toHaveAttribute('aria-pressed', 'true');
    expect(search).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(search);
    expect(search).toHaveAttribute('aria-pressed', 'true');
    expect(explorer).toHaveAttribute('aria-pressed', 'false');
  });

  it('点击时会透传 onSelectItem 回调', () => {
    const onSelectItem = vi.fn();
    render(<ActivityBar onSelectItem={onSelectItem} />);

    fireEvent.click(screen.getByLabelText('Outline'));
    expect(onSelectItem).toHaveBeenCalledTimes(1);
    expect(onSelectItem.mock.calls[0]?.[0]?.id).toBe('search');
  });
});
