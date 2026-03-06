import { describe, expect, it, vi } from 'vitest';
import { createFilesPlugin } from './plugin';

describe('createFilesPlugin', () => {
  it('creates a manifest with a files sidebar tab', () => {
    const plugin = createFilesPlugin({
      files: [],
      activeFileId: undefined,
      status: 'idle',
      onOpenFile: vi.fn(),
      onSaveFile: vi.fn(),
      onSaveAsFile: vi.fn(),
      onRefresh: vi.fn(),
    });

    expect(plugin.id).toBe('shenbi.plugin.files');
    expect(plugin.contributes?.sidebarTabs?.map((tab) => tab.id)).toEqual(['files']);
  });
});
