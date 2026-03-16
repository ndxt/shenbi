import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReActStepList } from './ReActStepList';

describe('ReActStepList', () => {
  it('renders steps in a compact mode and expands details on demand', () => {
    render(
      <ReActStepList
        steps={[
          {
            stepIndex: 0,
            timestamp: '2026-03-16T05:07:39.278Z',
            action: 'listWorkspaceFiles',
            actionInput: {},
            observation: JSON.stringify([{ id: 'page-1', name: 'Shell Page' }], null, 2),
          },
        ]}
      />,
    );

    expect(screen.getByText('listWorkspaceFiles')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand step details' })).toBeInTheDocument();
    expect(screen.queryByText((content, element) => element?.tagName === 'PRE' && content.includes('"id": "page-1"'))).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Expand step details' }));

    expect(screen.getByRole('button', { name: 'Collapse step details' })).toBeInTheDocument();
    expect(screen.getByText((content, element) => element?.tagName === 'PRE' && content.includes('"id": "page-1"'))).toBeInTheDocument();
  });
});
