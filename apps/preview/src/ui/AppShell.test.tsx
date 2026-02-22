import { render, screen } from '@testing-library/react';
import { AppShell } from './AppShell';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

// Mock lucide-react to avoid issues in test environment
vi.mock('lucide-react', () => ({
  FileText: () => <div data-testid="icon-filetext" />,
  Search: () => <div data-testid="icon-search" />,
  Database: () => <div data-testid="icon-database" />,
  BugPlay: () => <div data-testid="icon-bug" />,
  Package: () => <div data-testid="icon-package" />,
  Settings: () => <div data-testid="icon-settings" />,
  ChevronRight: () => <div data-testid="icon-chevron-right" />,
  ChevronDown: () => <div data-testid="icon-chevron-down" />,
  MoreHorizontal: () => <div data-testid="icon-more" />,
  MousePointer2: () => <div data-testid="icon-select" />,
  Hand: () => <div data-testid="icon-pan" />,
  Monitor: () => <div data-testid="icon-desktop" />,
  Tablet: () => <div data-testid="icon-tablet" />,
  Smartphone: () => <div data-testid="icon-mobile" />,
  Play: () => <div data-testid="icon-run" />,
  Code2: () => <div data-testid="icon-code" />,
  Share2: () => <div data-testid="icon-share" />,
}));

describe('AppShell', () => {
  it('renders all main shell regions', () => {
    render(
      <AppShell>
        <div data-testid="test-content">Content</div>
      </AppShell>
    );

    // Verify regions by presence of characteristic text or roles
    expect(screen.getByText('Explorer')).toBeInTheDocument();
    expect(screen.getByText('Inspector')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Run')).toBeInTheDocument();
    expect(screen.getByTestId('test-content')).toBeInTheDocument();
  });
});
