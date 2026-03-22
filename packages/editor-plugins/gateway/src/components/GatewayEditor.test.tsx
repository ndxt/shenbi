import React from 'react';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GatewayHostAdapter } from '../gateway-host-adapter';
import { GatewayEditor } from './GatewayEditor';

const gatewayCanvasSpy = vi.fn();

vi.mock('./GatewayCanvas', () => ({
  GatewayCanvas: (props: unknown) => {
    gatewayCanvasSpy(props);
    return <div data-testid="gateway-canvas" />;
  },
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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
  it('persists gateway documents back through the host filesystem adapter as json', async () => {
    gatewayCanvasSpy.mockClear();
    const saveDocument = vi.fn(async () => undefined);
    const hostAdapter = createHostAdapter({ saveDocument });

    render(<GatewayEditor hostAdapter={hostAdapter} />);

    await waitFor(() => {
      expect(gatewayCanvasSpy).toHaveBeenCalled();
    });

    const latestProps = gatewayCanvasSpy.mock.calls.at(-1)?.[0] as {
      onDocumentChange?: (document: Record<string, unknown>) => void;
    };
    expect(latestProps.onDocumentChange).toBeTypeOf('function');

    latestProps.onDocumentChange?.({
      id: 'api-1',
      name: 'Billing API',
      type: 'api-gateway',
      nodes: [
        {
          id: 'start-1',
          kind: 'start',
          label: '开始',
          position: { x: 120, y: 200 },
          config: {},
        },
      ],
      edges: [],
      viewport: { x: 10, y: 20, zoom: 1.1 },
    });

    await waitFor(() => {
      expect(saveDocument).toHaveBeenCalledWith({
        id: 'api-1',
        name: 'Billing API',
        type: 'api-gateway',
        nodes: [
          {
            id: 'start-1',
            kind: 'start',
            label: '开始',
            position: { x: 120, y: 200 },
            config: {},
          },
        ],
        edges: [],
        viewport: { x: 10, y: 20, zoom: 1.1 },
      });
    });
  });

  it('does not reload the document when hostAdapter identity changes for the same file', async () => {
    gatewayCanvasSpy.mockClear();
    const firstAdapter = createHostAdapter();
    const { rerender } = render(<GatewayEditor hostAdapter={firstAdapter} />);

    await waitFor(() => {
      expect(firstAdapter.loadDocument).toHaveBeenCalledTimes(1);
    });
    expect(screen.getAllByTestId('gateway-canvas').length).toBeGreaterThan(0);

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
    gatewayCanvasSpy.mockClear();
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

  it('cancels delayed saves from the previous file when switching tabs', async () => {
    vi.useFakeTimers();
    gatewayCanvasSpy.mockClear();
    const firstSaveDocument = vi.fn(async () => undefined);
    const firstAdapter = createHostAdapter({ saveDocument: firstSaveDocument });
    const { rerender } = render(<GatewayEditor hostAdapter={firstAdapter} />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(firstAdapter.loadDocument).toHaveBeenCalledTimes(1);

    let latestProps = gatewayCanvasSpy.mock.calls.at(-1)?.[0] as {
      onDocumentChange?: (document: Record<string, unknown>) => void;
    };
    latestProps.onDocumentChange?.({
      id: 'api-1',
      name: 'Billing API',
      type: 'api-gateway',
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
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
      saveDocument: vi.fn(async () => undefined),
    });

    rerender(<GatewayEditor hostAdapter={secondAdapter} />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(secondAdapter.loadDocument).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(200);

    expect(firstSaveDocument).not.toHaveBeenCalled();
    expect(secondAdapter.saveDocument).not.toHaveBeenCalled();
  });
});
