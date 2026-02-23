import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useResize } from './useResize';

function ResizeHarness() {
  const { startResize } = useResize(240, 120, 640);
  return (
    <button
      type="button"
      data-testid="resize-handle"
      onMouseDown={(event) => startResize(event, 'horizontal')}
    >
      resize
    </button>
  );
}

describe('useResize', () => {
  it('mouseUp 后会恢复 body 样式', () => {
    render(<ResizeHarness />);
    fireEvent.mouseDown(screen.getByTestId('resize-handle'), { clientX: 120 });

    expect(document.body.style.cursor).toBe('col-resize');
    expect(document.body.style.userSelect).toBe('none');

    fireEvent.mouseUp(document);
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });

  it('组件卸载时会清理拖拽副作用', () => {
    const view = render(<ResizeHarness />);
    fireEvent.mouseDown(screen.getByTestId('resize-handle'), { clientX: 120 });

    expect(document.body.style.cursor).toBe('col-resize');
    expect(document.body.style.userSelect).toBe('none');

    view.unmount();
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });
});
