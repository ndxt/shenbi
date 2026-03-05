import { fireEvent, render, screen } from '@testing-library/react';
import { AppShell } from './AppShell';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

describe('AppShell', () => {
  it('renders all main shell regions', () => {
    render(
      <AppShell>
        <div data-testid="test-content">Content</div>
      </AppShell>
    );

    // Verify regions by presence of characteristic text or roles
    expect(screen.getByText('Components')).toBeInTheDocument();
    expect(screen.getByText('Props')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Run')).toBeInTheDocument();
    expect(screen.getByTestId('test-content')).toBeInTheDocument();
  });

  it('卸载时会清理挂载的主题 class', () => {
    const { unmount } = render(
      <AppShell>
        <div>Theme Content</div>
      </AppShell>,
    );

    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    unmount();
    expect(document.documentElement.classList.contains('theme-dark')).toBe(false);
  });

  it('点击画布节点会触发 onCanvasSelectNode', () => {
    const onCanvasSelectNode = vi.fn();
    render(
      <AppShell onCanvasSelectNode={onCanvasSelectNode}>
        <div data-shenbi-node-id="node-1">Canvas Node</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByText('Canvas Node'));
    expect(onCanvasSelectNode).toHaveBeenCalledWith('node-1');
  });
});
