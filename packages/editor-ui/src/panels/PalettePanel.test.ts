import type React from 'react';
import { describe, expect, it } from 'vitest';
import { beginPaletteDrag, readPaletteDragPayload, type PaletteDragPayload } from './PalettePanel';

function createDataTransferMock(initial: Record<string, string> = {}): DataTransfer {
  const store = new Map(Object.entries(initial));
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

describe('palette drag payload helpers', () => {
  it('encodes and decodes palette payloads through DataTransfer', () => {
    const payload: PaletteDragPayload = {
      kind: 'component',
      type: 'Button',
      label: '按钮',
      description: '普通按钮',
      icon: 'MousePointer2',
    };
    const dataTransfer = createDataTransferMock();
    const event = {
      dataTransfer,
    } as unknown as React.DragEvent<HTMLElement>;

    beginPaletteDrag(event, payload);

    expect(dataTransfer.effectAllowed).toBe('copy');
    expect(dataTransfer.getData('text/plain')).toBe('Button');
    expect(readPaletteDragPayload(dataTransfer)).toEqual(payload);
  });

  it('returns null for malformed payloads', () => {
    const dataTransfer = createDataTransferMock({
      'application/x-shenbi-palette-item': '{"kind":"component"}',
    });

    expect(readPaletteDragPayload(dataTransfer)).toBeNull();
  });
});
