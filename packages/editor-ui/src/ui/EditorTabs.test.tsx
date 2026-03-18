import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EditorTabs } from './EditorTabs';

describe('EditorTabs', () => {
  it('does not render a placeholder tab when both tabs and label are missing', () => {
    const { container } = render(<EditorTabs />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/untitled|未命名/i)).not.toBeInTheDocument();
  });

  it('still renders the legacy single tab when an explicit label is provided', () => {
    render(<EditorTabs label="Scenario Page" />);

    expect(screen.getByText('Scenario Page')).toBeInTheDocument();
  });
});
