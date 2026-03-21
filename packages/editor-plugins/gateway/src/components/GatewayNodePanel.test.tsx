import React from 'react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readPaletteDragPayload } from '@shenbi/editor-ui';
import { GatewayNodePanel } from './GatewayNodePanel';

afterEach(() => {
  cleanup();
});

function createDataTransferMock(): DataTransfer {
  const store = new Map<string, string>();
  return {
    dropEffect: 'none',
    effectAllowed: 'all',
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: [],
    clearData(format?: string) {
      if (format) {
        store.delete(format);
        return;
      }
      store.clear();
    },
    getData(format: string) {
      return store.get(format) ?? '';
    },
    setData(format: string, data: string) {
      store.set(format, data);
    },
    setDragImage() {},
  } as unknown as DataTransfer;
}

describe('GatewayNodePanel', () => {
  it('filters items by search keyword', () => {
    render(<GatewayNodePanel />);

    fireEvent.change(screen.getByPlaceholderText(/search components|搜索组件/i), {
      target: { value: 'SQL' },
    });

    expect(screen.getByText('SQL 查询')).toBeInTheDocument();
    expect(screen.queryByText('条件分支')).not.toBeInTheDocument();
  });

  it('starts dragging with the shared palette payload', () => {
    render(<GatewayNodePanel />);

    const dragItem = screen.getAllByText('SQL 查询')[0]?.closest('[draggable="true"]');
    expect(dragItem).not.toBeNull();

    const dataTransfer = createDataTransferMock();
    fireEvent.dragStart(dragItem!, { dataTransfer });

    expect(readPaletteDragPayload(dataTransfer)).toEqual({
      kind: 'gateway-node',
      type: 'sql-query',
      label: 'SQL 查询',
      description: '执行 SQL 查询语句',
      icon: 'Database',
      meta: {
        color: '#f59e0b',
      },
    });
  });
});
