import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Focus } from 'lucide-react';
import { CanvasToolRail } from './CanvasToolRail';

function createProps() {
  return {
    activeTool: 'select' as const,
    spacePanActive: false,
    focusSelectionDisabled: false,
    onSelectTool: vi.fn(),
    onPanTool: vi.fn(),
    onFit: vi.fn(),
    onCenter: vi.fn(),
    onFocusSelection: vi.fn(),
  };
}

describe('CanvasToolRail', () => {
  it('renders default actions for the page canvas', () => {
    render(<CanvasToolRail {...createProps()} />);

    expect(screen.getByTitle('Fit View (Shift+1)')).toBeInTheDocument();
    expect(screen.getByTitle('Center Stage (Shift+2)')).toBeInTheDocument();
    expect(screen.getByTitle('Focus Selected Node (Shift+3)')).toBeInTheDocument();
  });

  it('renders custom secondary actions when provided', () => {
    const onCustomAction = vi.fn();

    render(
      <CanvasToolRail
        {...createProps()}
        actions={[
          {
            id: 'fit',
            title: 'Fit Graph',
            icon: <Focus size={14} />,
            onClick: onCustomAction,
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByTitle('Fit Graph'));
    expect(onCustomAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByTitle('Center Stage (Shift+2)')).toBeNull();
  });
});
