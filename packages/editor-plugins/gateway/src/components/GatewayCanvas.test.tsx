import React from 'react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GatewayCanvas } from './GatewayCanvas';
import type { GatewayNode } from '../types';

afterEach(() => {
  cleanup();
});

class ResizeObserverMock {
  observe() {}
  disconnect() {}
  unobserve() {}
}

describe('GatewayCanvas', () => {
  it('renders the shared tool rail with gateway-specific actions', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);

    const nodes: GatewayNode[] = [
      {
        id: 'node-1',
        type: 'sql-query',
        position: { x: 100, y: 120 },
        selected: true,
        data: {
          kind: 'sql-query',
          label: 'SQL 查询',
          config: {},
        },
      } as GatewayNode,
    ];

    render(
      <GatewayCanvas
        nodes={nodes}
        edges={[]}
        onNodesChange={vi.fn()}
        onEdgesChange={vi.fn()}
      />,
    );

    expect(screen.getByTitle('Selection Tool (V)')).toBeInTheDocument();
    expect(screen.getByTitle('Hand Tool (H)')).toBeInTheDocument();
    expect(screen.getByTitle('Fit Graph (Shift+1)')).toBeInTheDocument();
    expect(screen.getByTitle('Focus Selected Nodes (Shift+3)')).toBeInTheDocument();
  });
});
