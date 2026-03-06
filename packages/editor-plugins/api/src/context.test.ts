import { describe, expect, it, vi } from 'vitest';
import {
  executePluginCommand,
  getPluginDocumentPatchService,
  getPluginNotifications,
  getPluginSchema,
  getPluginSelectedNode,
  getPluginSelectedNodeId,
  replacePluginSchema,
  type PluginContext,
} from './context';

describe('plugin context helpers', () => {
  it('prefers service-based schema and selection accessors', () => {
    const selectedNode = { id: 'node-1', component: 'Button' } as const;
    const context: PluginContext = {
      document: {
        getSchema: () => ({ id: 'page-1', body: [] }),
      },
      selection: {
        getSelectedNode: () => selectedNode,
        getSelectedNodeId: () => selectedNode.id,
      },
    };

    expect(getPluginSchema(context)?.id).toBe('page-1');
    expect(getPluginSelectedNode(context)).toBe(selectedNode);
    expect(getPluginSelectedNodeId(context)).toBe('node-1');
  });

  it('falls back to deprecated patch aliases when document service is absent', () => {
    const props = vi.fn();
    const style = vi.fn();
    const context: PluginContext = {
      patchNodeProps: props,
      patchNodeStyle: style,
    };

    const patchService = getPluginDocumentPatchService(context);

    expect(patchService?.props).toBe(props);
    expect(patchService?.style).toBe(style);
  });

  it('prefers service-based commands and notifications', () => {
    const execute = vi.fn();
    const success = vi.fn();
    const context: PluginContext = {
      commands: {
        execute,
      },
      notifications: {
        success,
      },
      executeCommand: vi.fn(),
      notify: {
        success: vi.fn(),
      },
    };

    executePluginCommand(context, 'cmd.run', { ok: true });
    getPluginNotifications(context)?.success?.('done');

    expect(execute).toHaveBeenCalledWith('cmd.run', { ok: true });
    expect(success).toHaveBeenCalledWith('done');
  });

  it('replacePluginSchema falls back to deprecated replaceSchema alias', () => {
    const replaceSchema = vi.fn();
    const handled = replacePluginSchema(
      {
        replaceSchema,
      },
      { id: 'page-2', body: [] },
    );

    expect(handled).toBe(true);
    expect(replaceSchema).toHaveBeenCalledWith({ id: 'page-2', body: [] });
  });

  it('replacePluginSchema returns false when no replacement service exists', () => {
    const handled = replacePluginSchema(
      {},
      { id: 'page-3', body: [] },
    );

    expect(handled).toBe(false);
  });
});
