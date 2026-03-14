import { describe, expect, it, vi } from 'vitest';
import { createFilesPlugin } from './plugin';

describe('createFilesPlugin', () => {
  it('creates a manifest with a files primary panel and activity item', () => {
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
    expect(plugin.contributes?.activityBarItems?.map((item) => item.id)).toEqual(['files']);
    expect(plugin.contributes?.primaryPanels?.map((panel) => panel.id)).toEqual(['files']);
    expect(plugin.contributes?.sidebarTabs).toBeUndefined();
  });
});
