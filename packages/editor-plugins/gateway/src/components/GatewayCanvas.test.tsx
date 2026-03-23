import React from 'react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GatewayCanvas } from './GatewayCanvas';
import type { GatewayNode } from '../types';
import { createDefaultGatewayDocument, gatewayDocumentToGraph } from '../gateway-document';

afterEach(() => {
  cleanup();
});

class ResizeObserverMock {
  observe() {}
  disconnect() {}
  unobserve() {}
}

class DOMMatrixReadOnlyMock {
  m22 = 1;

  constructor(_transform?: string) {}
}

function createDataTransferMock(initial: Record<string, string> = {}): DataTransfer {
  const store = new Map<string, string>(Object.entries(initial));

  return {
    dropEffect: 'none',
    effectAllowed: 'all',
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: Array.from(store.keys()),
    clearData(format?: string) {
      if (format) {
        store.delete(format);
      } else {
        store.clear();
      }
      this.types = Array.from(store.keys());
    },
    getData(format: string) {
      return store.get(format) ?? '';
    },
    setData(format: string, data: string) {
      store.set(format, data);
      this.types = Array.from(store.keys());
    },
    setDragImage() {},
  } as unknown as DataTransfer;
}

describe('GatewayCanvas', () => {
  it('renders the shared tool rail with gateway-specific actions', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    vi.stubGlobal('DOMMatrixReadOnly', DOMMatrixReadOnlyMock);

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

  it('renders gateway nodes as visible elements when dimensions are provided', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    vi.stubGlobal('DOMMatrixReadOnly', DOMMatrixReadOnlyMock);

    const nodes: GatewayNode[] = [
      {
        id: 'start-1',
        type: 'start',
        position: { x: 100, y: 200 },
        width: 200,
        height: 60,
        data: {
          kind: 'start',
          label: '开始',
          config: {},
        },
      } as GatewayNode,
      {
        id: 'end-1',
        type: 'end',
        position: { x: 600, y: 200 },
        width: 200,
        height: 60,
        data: {
          kind: 'end',
          label: '返回结果',
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

    await waitFor(() => {
      expect(screen.getByTestId('rf__node-start-1')).toHaveStyle({ visibility: 'visible' });
      expect(screen.getByTestId('rf__node-end-1')).toHaveStyle({ visibility: 'visible' });
    });
  });

  it('renders default gateway edges when nodes include runtime handles', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    vi.stubGlobal('DOMMatrixReadOnly', DOMMatrixReadOnlyMock);

    const graph = gatewayDocumentToGraph(createDefaultGatewayDocument('api-3', 'Edge API'));

    render(
      <GatewayCanvas
        nodes={graph.nodes}
        edges={graph.edges}
        onNodesChange={vi.fn()}
        onEdgesChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector('.react-flow__edge')).toBeInTheDocument();
    });
  });

  it('adds dropped nodes with runtime dimensions and contract-derived handles', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    vi.stubGlobal('DOMMatrixReadOnly', DOMMatrixReadOnlyMock);

    const onNodesChange = vi.fn();

    const { container } = render(
      <GatewayCanvas
        nodes={[]}
        edges={[]}
        onNodesChange={onNodesChange}
        onEdgesChange={vi.fn()}
      />,
    );

    const canvas = container.querySelector('.react-flow');
    expect(canvas).not.toBeNull();

    const dataTransfer = createDataTransferMock({
      'application/x-shenbi-palette-item': JSON.stringify({
        kind: 'gateway-node',
        type: 'sql-query',
        label: 'SQL 查询',
        description: '执行 SQL 查询语句',
        icon: 'Database',
        meta: {
          color: '#f59e0b',
        },
      }),
    });

    canvas!.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      width: 1200,
      height: 800,
      top: 0,
      left: 0,
      right: 1200,
      bottom: 800,
      toJSON: () => ({}),
    });

    await waitFor(() => {
      expect(document.querySelector('.react-flow__viewport')).toBeInTheDocument();
    });

    fireEvent.dragOver(canvas!, {
      dataTransfer,
      clientX: 320,
      clientY: 180,
    });

    fireEvent.drop(canvas!, {
      dataTransfer,
      clientX: 320,
      clientY: 180,
    });

    await waitFor(() => {
      expect(onNodesChange).toHaveBeenCalledTimes(1);
    });

    const nextNodes = onNodesChange.mock.calls[0]?.[0] as GatewayNode[];
    expect(nextNodes).toHaveLength(1);
    expect(nextNodes[0]).toEqual(expect.objectContaining({
      type: 'sql-query',
      width: 200,
      height: 60,
      data: expect.objectContaining({
        kind: 'sql-query',
        label: 'SQL 查询',
      }),
    }));
    expect(nextNodes[0]?.handles).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'params',
        type: 'target',
      }),
      expect.objectContaining({
        id: 'rows',
        type: 'source',
      }),
    ]));
  });
});
