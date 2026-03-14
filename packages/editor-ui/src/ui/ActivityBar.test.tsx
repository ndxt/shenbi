import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Rocket } from 'lucide-react';
import { ActivityBar } from './ActivityBar';
import {
  resolveActivityBarItems,
  type ActivityBarItemContribution,
} from './activitybar-items';

describe('ActivityBar', () => {
  it('默认渲染内置图标项（fallback）', () => {
    render(<ActivityBar />);

    const builtinItems = resolveActivityBarItems();
    const activeItem = builtinItems.find((item) => item.active);
    expect(activeItem).toBeDefined();
    const activeButton = screen.getByLabelText(activeItem!.label);
    expect(activeButton).toBeInTheDocument();
    expect(activeButton).toHaveAttribute('aria-pressed', 'true');
    expect(activeButton).not.toHaveAttribute('title');

    builtinItems.forEach((item) => {
      expect(screen.getByLabelText(item.label)).toBeInTheDocument();
    });
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

    const builtinItems = resolveActivityBarItems();
    const activeItem = builtinItems.find((item) => item.active)!;
    const inactiveItem = builtinItems.find((item) => item.section === activeItem.section && item.id !== activeItem.id)!;
    const activeButton = screen.getByLabelText(activeItem.label);
    const inactiveButton = screen.getByLabelText(inactiveItem.label);
    expect(activeButton).toHaveAttribute('aria-pressed', 'true');
    expect(inactiveButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(inactiveButton);
    expect(inactiveButton).toHaveAttribute('aria-pressed', 'true');
    expect(activeButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('点击时会透传 onSelectItem 回调', () => {
    const onSelectItem = vi.fn();
    render(<ActivityBar onSelectItem={onSelectItem} />);

    const targetItem = resolveActivityBarItems()[1]!;
    fireEvent.click(screen.getByLabelText(targetItem.label));
    expect(onSelectItem).toHaveBeenCalledTimes(1);
    expect(onSelectItem.mock.calls[0]?.[0]?.id).toBe(targetItem.id);
  });
});
