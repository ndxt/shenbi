import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GatewayHostAdapter } from '../gateway-host-adapter';
import { GatewayEditor } from './GatewayEditor';

vi.mock('./GatewayCanvas', () => ({
  GatewayCanvas: () => <div data-testid="gateway-canvas" />,
}));

function createHostAdapter(overrides?: Partial<GatewayHostAdapter>): GatewayHostAdapter {
  return {
    fileId: 'api-1',
    fileName: 'Billing API',
    loadDocument: vi.fn(async () => ({
      id: 'api-1',
      name: 'Billing API',
      type: 'api-gateway',
      nodes: [],
      edges: [],
    })),
    saveDocument: vi.fn(async () => undefined),
    notifyError: vi.fn(),
    ...overrides,
  };
}

describe('GatewayEditor', () => {
  it('does not reload the document when hostAdapter identity changes for the same file', async () => {
    const firstAdapter = createHostAdapter();
    const { rerender } = render(<GatewayEditor hostAdapter={firstAdapter} />);

    await waitFor(() => {
      expect(firstAdapter.loadDocument).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('gateway-canvas')).toBeInTheDocument();

    const secondAdapter = createHostAdapter({
      loadDocument: vi.fn(async () => ({
        id: 'api-1',
        name: 'Billing API',
        type: 'api-gateway',
        nodes: [],
        edges: [],
      })),
    });

    rerender(<GatewayEditor hostAdapter={secondAdapter} />);

    await waitFor(() => {
      expect(firstAdapter.loadDocument).toHaveBeenCalledTimes(1);
    });
    expect(secondAdapter.loadDocument).not.toHaveBeenCalled();
  });

  it('reloads the document when the hostAdapter points at a different file', async () => {
    const firstAdapter = createHostAdapter();
    const { rerender } = render(<GatewayEditor hostAdapter={firstAdapter} />);

    await waitFor(() => {
      expect(firstAdapter.loadDocument).toHaveBeenCalledTimes(1);
    });

    const secondAdapter = createHostAdapter({
      fileId: 'api-2',
      fileName: 'Orders API',
      loadDocument: vi.fn(async () => ({
        id: 'api-2',
        name: 'Orders API',
        type: 'api-gateway',
        nodes: [],
        edges: [],
      })),
    });

    rerender(<GatewayEditor hostAdapter={secondAdapter} />);

    await waitFor(() => {
      expect(secondAdapter.loadDocument).toHaveBeenCalledTimes(1);
    });
  });
});
