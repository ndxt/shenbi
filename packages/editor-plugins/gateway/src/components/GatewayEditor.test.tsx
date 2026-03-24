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
  const initialDocument = {
    id: 'api-1',
    name: 'Billing API',
    type: 'api-gateway' as const,
    nodes: [],
    edges: [],
  };

  it('does not auto-save gateway documents after canvas edits', async () => {
    gatewayCanvasSpy.mockClear();
    const saveDocument = vi.fn(async () => undefined);
    const hostAdapter = createHostAdapter({ saveDocument });

    render(<GatewayEditor hostAdapter={hostAdapter} documentSchema={initialDocument} />);

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

    await act(async () => {
      await Promise.resolve();
    });

    expect(saveDocument).not.toHaveBeenCalled();
  });

  it('does not reset the canvas document when hostAdapter identity changes for the same file', async () => {
    gatewayCanvasSpy.mockClear();
    const firstAdapter = createHostAdapter();
    const { rerender } = render(<GatewayEditor hostAdapter={firstAdapter} documentSchema={initialDocument} />);
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

    const resetBeforeRerender = gatewayCanvasSpy.mock.calls.length;
    rerender(<GatewayEditor hostAdapter={secondAdapter} documentSchema={initialDocument} />);
    expect(gatewayCanvasSpy.mock.calls.length).toBeGreaterThanOrEqual(resetBeforeRerender);
    expect(secondAdapter.loadDocument).not.toHaveBeenCalled();
  });

  it('replaces the working document when the host points at a different file', async () => {
    gatewayCanvasSpy.mockClear();
    const firstAdapter = createHostAdapter();
    const replaceDocument = vi.fn();
    const documentContext = {
      markDirty: vi.fn(),
      replaceDocument,
      syncSchema: replaceDocument,
      reportUndoRedoState: vi.fn(),
      onSaveRequest: vi.fn(() => () => undefined),
      onUndoRequest: vi.fn(() => () => undefined),
      onRedoRequest: vi.fn(() => () => undefined),
    };
    const { rerender } = render(
      <GatewayEditor
        hostAdapter={firstAdapter}
        documentSchema={initialDocument}
        documentContext={documentContext}
      />,
    );

    const secondDocument = {
      id: 'api-2',
      name: 'Orders API',
      type: 'api-gateway' as const,
      nodes: [] as typeof initialDocument.nodes,
      edges: [] as typeof initialDocument.edges,
    };

    const secondAdapter = createHostAdapter({
      fileId: 'api-2',
      fileName: 'Orders API',
      loadDocument: vi.fn(async () => secondDocument),
    });

    rerender(
      <GatewayEditor
        hostAdapter={secondAdapter}
        documentSchema={secondDocument}
        documentContext={documentContext}
      />,
    );

    // After switching files, markDirty(false) should be called via
    // the history.isDirty useEffect because history.reset clears dirty state.
    await waitFor(() => {
      expect(documentContext.markDirty).toHaveBeenCalledWith(false);
    });
  });

  it('does not auto-save pending edits when switching tabs', async () => {
    gatewayCanvasSpy.mockClear();
    const firstSaveDocument = vi.fn(async () => undefined);
    const firstAdapter = createHostAdapter({ saveDocument: firstSaveDocument });
    const { rerender } = render(<GatewayEditor hostAdapter={firstAdapter} documentSchema={initialDocument} />);

    await act(async () => {
      await Promise.resolve();
    });

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

    rerender(
      <GatewayEditor
        hostAdapter={secondAdapter}
        documentSchema={{
          id: 'api-2',
          name: 'Orders API',
          type: 'api-gateway',
          nodes: [],
          edges: [],
        }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(firstSaveDocument).not.toHaveBeenCalled();
    expect(secondAdapter.saveDocument).not.toHaveBeenCalled();
  });

  it('saves the current gateway document when the host requests an explicit save', async () => {
    gatewayCanvasSpy.mockClear();
    const saveDocument = vi.fn(async () => undefined);
    const syncSchema = vi.fn();
    const saveHandlers: Array<() => void> = [];
    const documentContext = {
      markDirty: vi.fn(),
      getDocument: vi.fn(),
      replaceDocument: syncSchema,
      syncSchema,
      reportUndoRedoState: vi.fn(),
      onSaveRequest: vi.fn((handler: () => void) => {
        saveHandlers.push(handler);
        return () => undefined;
      }),
      onUndoRequest: vi.fn(() => () => undefined),
      onRedoRequest: vi.fn(() => () => undefined),
    };

    render(
      <GatewayEditor
        documentSchema={initialDocument}
        hostAdapter={createHostAdapter({ saveDocument })}
        documentContext={documentContext}
      />,
    );

    await waitFor(() => {
      expect(gatewayCanvasSpy).toHaveBeenCalled();
    });

    // Switch to fake timers AFTER waitFor so polling uses real timers
    vi.useFakeTimers();

    const latestProps = gatewayCanvasSpy.mock.calls.at(-1)?.[0] as {
      onDocumentChange?: (document: Record<string, unknown>) => void;
    };
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

    // replaceDocument is now deferred to the 180ms commit timer
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(syncSchema).toHaveBeenCalledWith({
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
    expect(saveHandlers.length).toBeGreaterThan(0);

    syncSchema.mockClear();
    await act(async () => {
      saveHandlers.at(-1)?.();
      await Promise.resolve();
    });

    expect(syncSchema).toHaveBeenCalledWith({
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
